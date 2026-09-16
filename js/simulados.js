import {sb} from './supabase.js';

const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let ctx,simulations=[],attempts=[],active=null,questions=[],answers=new Map(),index=0,timer=null,finishing=false;
let securityEnabled=false,securityRequestInFlight=false,securityPendingWarning=null,securityFinalizedPending=false;

function notice(msg,type='success'){const el=$('#simulationNotice');if(!el)return;el.textContent=msg;el.className=`notice ${type}`;clearTimeout(notice.t);notice.t=setTimeout(()=>el.classList.add('hidden'),4500)}
function fmtDate(iso){return iso?new Date(iso).toLocaleString('pt-BR'):'—'}
function fmtTime(sec){sec=Math.max(0,Math.floor(sec));return `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
function simStatus(s){const now=Date.now(),start=s.data_liberacao?new Date(s.data_liberacao).getTime():0,end=s.data_encerramento?new Date(s.data_encerramento).getTime():Infinity;if(start&&now<start)return 'future';if(now>end)return 'closed';return 'open'}
function ownAttempts(id){return attempts.filter(a=>Number(a.simulado_id)===Number(id)).sort((a,b)=>Number(b.numero_tentativa||1)-Number(a.numero_tentativa||1))}
function latestAttempt(id){return ownAttempts(id)[0]||null}
function show(section){['#simulationListView','#simulationExamView','#simulationResultView'].forEach(s=>$(s)?.classList.toggle('hidden',s!==section))}
function securityModal(showIt=true){$('#simulationSecurityModal')?.classList.toggle('hidden',!showIt)}
function securityStatus(){
  const el=$('#simulationSecurityStatus'); if(!el)return;
  const strikes=Number(active?.violacoes_seguranca||0);
  if(!strikes){el.classList.add('hidden');el.textContent='';return}
  el.textContent=`⚠️ Atenção: ${strikes} ocorrência de saída da tela registrada. Uma nova ocorrência encerrará o simulado automaticamente.`;
  el.classList.remove('hidden');
}
async function registerSecurityViolation(){
  if(!securityEnabled||!active||finishing||securityRequestInFlight)return;
  securityRequestInFlight=true;
  const {data,error}=await sb.rpc('registrar_violacao_simulado',{p_tentativa_id:Number(active.id)});
  securityRequestInFlight=false;
  if(error){console.error('Falha ao registrar ocorrência de segurança:',error);return}
  const strikes=Number(data?.violacoes||data?.violacoes_seguranca||0);
  active.violacoes_seguranca=strikes;
  if(data?.finalizado||strikes>=2){
    securityEnabled=false;
    securityFinalizedPending=true;
    if(document.visibilityState==='visible')await showSecurityFinalization();
    return;
  }
  securityPendingWarning=true;
  if(document.visibilityState==='visible'){securityStatus();securityModal(true)}
}
async function showSecurityFinalization(){
  if(!securityFinalizedPending||!active)return;
  securityFinalizedPending=false;
  securityModal(false);
  await loadResult(active.id,'O simulado foi finalizado automaticamente por repetição de saída da tela. A pontuação considera somente o que havia sido respondido até aquele momento.');
}
function handleVisibilityChange(){
  if(document.visibilityState==='hidden'){
    registerSecurityViolation();
    return;
  }
  if(securityFinalizedPending){showSecurityFinalization();return}
  if(securityPendingWarning){securityPendingWarning=false;securityStatus();securityModal(true)}
}
function setAttemptUrl(id){const u=new URL(location.href);u.searchParams.set('tentativa',String(id));history.replaceState(null,'',u)}
function clearAttemptUrl(){const u=new URL(location.href);u.searchParams.delete('tentativa');history.replaceState(null,'',u.pathname+u.search+u.hash)}

async function loadList(){
  securityEnabled=false;securityPendingWarning=false;securityFinalizedPending=false;securityModal(false);
  document.body.classList.remove('simulation-lockdown');
  active=null;
  stopTimer();
  clearAttemptUrl();
  const [{data:sims,error},{data:ats,error:ae}]=await Promise.all([
    sb.from('simulados').select('*').eq('ativo',true).order('data_liberacao',{ascending:false}),
    sb.from('simulado_tentativas').select('*').eq('user_id',ctx.user.id).order('iniciada_em',{ascending:false})
  ]);
  if(error||ae){notice('Não foi possível carregar os simulados.','error');return}
  simulations=sims||[];attempts=ats||[];renderList();show('#simulationListView');
}
function renderList(){
  const box=$('#simulationCards'); if(!box)return;
  if(!simulations.length){box.innerHTML='<div class="card empty">Nenhum simulado oficial disponível.</div>';return}
  box.innerHTML=simulations.map(s=>{
    const st=simStatus(s),ats=ownAttempts(s.id),running=ats.find(a=>a.status==='em_andamento'),done=ats.filter(a=>a.status==='finalizada'),last=done[0];
    const status=st==='future'?'<span class="badge wait">Agendado</span>':st==='closed'?'<span class="badge off">Encerrado</span>':'<span class="badge ok">Disponível</span>';
    let action='';
    if(running)action=`<button class="btn" data-resume-sim="${s.id}" data-attempt="${running.id}">CONTINUAR</button>`;
    else if(st==='open'&&(!done.length||s.tentativas_multiplas))action=`<button class="btn" data-start-sim="${s.id}">${done.length?'NOVA TENTATIVA':'INICIAR'}</button>`;
    if(last)action+=`<button class="btn secondary" data-result-attempt="${last.id}">VER RESULTADO</button>`;
    return `<article class="card simulation-card"><div class="simulation-card-head"><div><div class="sim-badges">${status}<span class="badge">${s.total_questoes||0} questões</span><span class="badge">${s.duracao_minutos} min</span></div><h2>${esc(s.titulo)}</h2><p class="muted">${esc(s.descricao||'')}</p></div>${last?`<div class="sim-last-score"><small>Último resultado</small><b>${Number(last.pontuacao||0).toFixed(1)}%</b></div>`:''}</div><div class="simulation-meta"><span>📅 Liberação: ${fmtDate(s.data_liberacao)}</span>${s.data_encerramento?`<span>⏳ Encerramento: ${fmtDate(s.data_encerramento)}</span>`:''}<span>${s.tentativas_multiplas?'↻ Múltiplas tentativas':'① Tentativa única'}</span></div><div class="simulation-actions">${action||'<span class="muted">Nenhuma ação disponível no momento.</span>'}</div></article>`;
  }).join('');
}
async function startSimulation(simId){
  const btn=document.querySelector(`[data-start-sim="${simId}"]`);
  const oldText=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent='ABRINDO...'}
  const {data,error}=await sb.rpc('iniciar_ou_retomar_simulado',{p_simulado_id:Number(simId)});
  if(btn){btn.disabled=false;btn.textContent=oldText||'INICIAR'}
  if(error){
    console.error(error);
    const msg=String(error.message||'');
    if(msg.includes('SIMULADO_SEM_QUESTOES')) return notice('Este simulado ainda não possui questões vinculadas. A administração precisa revisar a importação.','error');
    if(msg.includes('SIMULADO_NAO_LIBERADO')) return notice('Este simulado ainda não foi liberado.','error');
    if(msg.includes('SIMULADO_ENCERRADO')) return notice('Este simulado não está mais disponível.','error');
    if(msg.includes('TENTATIVA_ENCERRADA')) return notice('Você já concluiu a tentativa permitida para este simulado.','error');
    return notice('Não foi possível iniciar o simulado. Tente novamente.','error');
  }
  const id=Number(data?.tentativa_id||data?.id||data);
  if(!id)return notice('Não foi possível abrir a tentativa.','error');
  await loadAttempt(id);
}
async function loadAttempt(attemptId){
  stopTimer();
  const {data:a,error}=await sb.from('simulado_tentativas').select('*,simulados(*)').eq('id',attemptId).eq('user_id',ctx.user.id).single();
  if(error||!a)return notice('Tentativa não encontrada.','error'); if(a.status==='finalizada')return loadResult(attemptId);
  active=a;
  securityEnabled=true;securityPendingWarning=false;securityFinalizedPending=false;
  document.body.classList.add('simulation-lockdown');
  setAttemptUrl(a.id);
  const [{data:links,error:qe},{data:resp,error:re}]=await Promise.all([
    sb.from('simulado_questoes').select('ordem,peso,questao_id,questoes(id,disciplina_id,assunto_id,enunciado,alternativa_a,alternativa_b,alternativa_c,alternativa_d,alternativa_e,banca,concurso,ano,disciplinas(nome),assuntos(nome))').eq('simulado_id',a.simulado_id).order('ordem'),
    sb.from('simulado_respostas').select('questao_id,resposta,marcada_revisao').eq('tentativa_id',attemptId)
  ]);
  if(qe||re)return notice('Não foi possível carregar a prova.','error');
  questions=(links||[]).map(x=>({...x.questoes,peso:x.peso,ordem:x.ordem})); answers=new Map((resp||[]).map(r=>[Number(r.questao_id),r]));
  index=Math.max(0,Math.min(questions.length-1,Number(a.current_question_index||0)));
  renderExam();securityStatus();show('#simulationExamView');startTimer();
}
function optionEntries(q){return ['A','B','C','D','E'].map(k=>[k,q[`alternativa_${k.toLowerCase()}`]]).filter(([,v])=>String(v||'').trim())}
function renderExam(){
  const q=questions[index];if(!q)return;
  $('#examTitle').textContent=active.simulados.titulo;$('#examCounter').textContent=`${index+1} / ${questions.length}`;$('#examProgress').style.width=`${Math.round(((index+1)/questions.length)*100)}%`;
  $('#examMeta').innerHTML=`<span class="badge">${esc(q.disciplinas?.nome||'')}</span>${q.assuntos?.nome?`<span class="badge">${esc(q.assuntos.nome)}</span>`:''}${q.banca?`<span class="badge">${esc(q.banca)}</span>`:''}`;
  $('#examStatement').textContent=q.enunciado;
  const saved=answers.get(Number(q.id));
  const locked=!!saved?.resposta;
  $('#examOptions').innerHTML=optionEntries(q).map(([k,v])=>`<label class="exam-option ${locked?'locked':''}"><input type="radio" name="sim-answer" value="${k}" ${saved?.resposta===k?'checked':''} ${locked?'disabled':''}><span class="option-letter">${k}</span><span>${esc(v)}</span></label>`).join('');
  const mark=$('#markReview');mark.classList.toggle('active',!!saved?.marcada_revisao);mark.textContent=saved?.marcada_revisao?'★ Marcada para revisar':'☆ Marcar para revisar';
  $('#prevQuestion').disabled=index===0;$('#nextQuestion').textContent=index===questions.length-1?'IR PARA FINALIZAÇÃO':'PRÓXIMA';renderNavigator();
}
function renderNavigator(){
  const nav=$('#examNavigator');nav.innerHTML=questions.map((q,i)=>{const a=answers.get(Number(q.id));return `<button type="button" class="nav-q ${i===index?'current':''} ${a?.resposta?'answered':''} ${a?.marcada_revisao?'marked':''}" data-goto-q="${i}">${i+1}</button>`}).join('');
  const answered=[...answers.values()].filter(a=>a.resposta).length;$('#answeredCount').textContent=`${answered}/${questions.length} respondidas`;
}
async function saveCurrent(patch={}){
  const q=questions[index];
  const current=answers.get(Number(q.id))||{questao_id:q.id,resposta:null,marcada_revisao:false};
  if(current.resposta&&patch.resposta&&patch.resposta!==current.resposta){
    notice('Esta questão já foi respondida e não pode mais ser alterada.','error');
    return false;
  }
  const next={...current,...patch};
  const {error}=await sb.rpc('salvar_resposta_simulado',{p_tentativa_id:Number(active.id),p_questao_id:Number(q.id),p_resposta:next.resposta||null,p_marcada:!!next.marcada_revisao});
  if(error){
    console.error(error);
    const msg=String(error.message||'');
    if(msg.includes('RESPOSTA_BLOQUEADA')) notice('Esta questão já foi respondida e não pode mais ser alterada.','error');
    else notice('Não foi possível salvar esta resposta. Verifique sua conexão.','error');
    return false;
  }
  answers.set(Number(q.id),next);
  renderNavigator();
  return true;
}
async function savePosition(i=index){
  if(!active)return;
  const next=Math.max(0,Math.min(questions.length-1,Number(i)||0));
  active.current_question_index=next;
  const {error}=await sb.rpc('salvar_posicao_simulado',{p_tentativa_id:Number(active.id),p_indice:next});
  if(error)console.error(error);
}
async function goToQuestion(i){
  if(!Number.isInteger(i)||i<0||i>=questions.length)return;
  index=i;
  renderExam();
  await savePosition(index);
}
async function answerAndAdvance(value){
  const q=questions[index];
  const existing=answers.get(Number(q.id));
  if(existing?.resposta)return;
  const ok=await saveCurrent({resposta:value});
  if(!ok)return;
  renderExam();
  if(index<questions.length-1){
    await goToQuestion(index+1);
  }else{
    await savePosition(index);
    $('#finishSimulation').scrollIntoView({behavior:'smooth',block:'center'});
  }
}
function startTimer(){
  const duration=Number(active.simulados.duracao_minutos||0)*60,start=new Date(active.iniciada_em).getTime();
  const tick=async()=>{const remaining=Math.ceil((start+duration*1000-Date.now())/1000);$('#examTimer').textContent=fmtTime(remaining);$('#examTimer').classList.toggle('timer-danger',remaining<=300);if(remaining<=0&&!finishing){stopTimer();await finishSimulation(true)}};
  tick();timer=setInterval(tick,1000);
}
function stopTimer(){if(timer){clearInterval(timer);timer=null}}
async function finishSimulation(auto=false){
  if(finishing)return;
  const blanks=questions.length-[...answers.values()].filter(a=>a.resposta).length;
  if(!auto&&!confirm(blanks?`Ainda há ${blanks} questão(ões) sem resposta. Finalizar mesmo assim?`:'Finalizar o simulado agora?'))return;
  securityEnabled=false;document.body.classList.remove('simulation-lockdown');
  finishing=true;$('#finishSimulation').disabled=true;
  const {data,error}=await sb.rpc('finalizar_simulado',{p_tentativa_id:Number(active.id)});finishing=false;$('#finishSimulation').disabled=false;
  if(error){
    console.error(error);
    securityEnabled=true;document.body.classList.add('simulation-lockdown');
    return notice('Não foi possível finalizar o simulado. Tente novamente.','error')
  }
  stopTimer();await loadResult(active.id,auto?'O tempo terminou e o simulado foi finalizado automaticamente.':null);
}
async function loadResult(attemptId,message=null){
  securityEnabled=false;securityPendingWarning=false;securityModal(false);
  document.body.classList.remove('simulation-lockdown');
  stopTimer();
  const {data:a,error}=await sb.from('simulado_tentativas').select('*,simulados(*)').eq('id',attemptId).eq('user_id',ctx.user.id).single();if(error||!a)return notice('Resultado não encontrado.','error');
  const [{data:resp},{data:links}]=await Promise.all([
    sb.from('simulado_respostas').select('questao_id,resposta,acertou,marcada_revisao,questoes(id,enunciado,correta,comentario,ponto_fixacao,base_legal,alternativa_a,alternativa_b,alternativa_c,alternativa_d,alternativa_e,disciplinas(nome),assuntos(nome))').eq('tentativa_id',attemptId),
    sb.from('simulado_questoes').select('questao_id,peso').eq('simulado_id',a.simulado_id)
  ]);
  const weights=Object.fromEntries((links||[]).map(x=>[x.questao_id,Number(x.peso||1)]));
  const byDisc={};(resp||[]).forEach(r=>{const n=r.questoes?.disciplinas?.nome||'Sem disciplina';if(!byDisc[n])byDisc[n]={total:0,hits:0,weight:0,hitWeight:0};const x=byDisc[n],w=weights[r.questao_id]||1;x.total++;x.weight+=w;if(r.acertou){x.hits++;x.hitWeight+=w}});
  const correction=a.simulados.correcao_modo==='imediata'||(a.simulados.data_encerramento&&Date.now()>=new Date(a.simulados.data_encerramento).getTime());
  $('#resultTitle').textContent=a.simulados.titulo;$('#resultScore').textContent=`${Number(a.pontuacao||0).toFixed(1)}%`;$('#resultHits').textContent=`${a.acertos||0}/${a.simulados.total_questoes||resp?.length||0}`;$('#resultTime').textContent=fmtTime(a.tempo_segundos||0);$('#resultAttempt').textContent=`Tentativa ${a.numero_tentativa||1}`;
  $('#resultMessage').innerHTML=message?`<div class="notice">${esc(message)}</div>`:'';
  $('#disciplineResult').innerHTML=Object.entries(byDisc).sort((a,b)=>b[1].total-a[1].total).map(([n,x])=>`<div class="sim-disc-row"><span>${esc(n)}</span><b>${x.hits}/${x.total}</b><strong>${x.weight?((x.hitWeight/x.weight)*100).toFixed(0):0}%</strong></div>`).join('')||'<div class="empty compact">Sem dados por disciplina.</div>';
  const corr=$('#simulationCorrection');
  if(correction){corr.innerHTML=(resp||[]).map((r,i)=>{const q=r.questoes,choice=r.resposta||'—';return `<article class="correction-item ${r.acertou?'correct':'wrong'}"><div class="correction-head"><b>Questão ${i+1}</b><span class="badge ${r.acertou?'ok':'off'}">${r.acertou?'Acertou':'Errou'}</span></div><p>${esc(q?.enunciado||'')}</p><div class="correction-answer"><span>Sua resposta: <b>${esc(choice)}</b></span><span>Gabarito: <b>${esc(q?.correta||'—')}</b></span></div>${q?.comentario?`<div class="correction-comment"><b>Comentário</b><p>${esc(q.comentario)}</p></div>`:''}${q?.ponto_fixacao?`<div class="fixation-block"><b>Ponto de fixação</b><p>${esc(q.ponto_fixacao)}</p></div>`:''}</article>`}).join('')||'<div class="empty">Correção indisponível.</div>';
  }else corr.innerHTML='<div class="card empty">A correção comentada será liberada após o encerramento deste simulado.</div>';
  $('#rankingSection').classList.toggle('hidden',!a.simulados.mostrar_ranking); if(a.simulados.mostrar_ranking)await loadRanking(a.simulado_id);
  show('#simulationResultView');
}
async function loadRanking(simId){
  const {data,error}=await sb.rpc('ranking_simulado_oficial',{p_simulado_id:Number(simId)});const box=$('#simulationRanking');
  if(error){box.innerHTML='<div class="empty compact">Ranking indisponível.</div>';return}
  box.innerHTML=(data||[]).length?`<div class="table-wrap"><table><thead><tr><th>#</th><th>Participante</th><th>Pontuação</th><th>Acertos</th><th>Tempo</th></tr></thead><tbody>${data.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.nome)}</b></td><td>${Number(r.pontuacao||0).toFixed(1)}%</td><td>${r.acertos}</td><td>${fmtTime(r.tempo_segundos)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty compact">Ainda não há resultados no ranking.</div>';
}

export async function loadSimulados(context){
  ctx=context;
  const attemptParam=Number(new URLSearchParams(location.search).get('tentativa'));
  if(Number.isInteger(attemptParam)&&attemptParam>0) await loadAttempt(attemptParam); else await loadList();
  $('#simulationCards')?.addEventListener('click',e=>{const start=e.target.dataset.startSim,resume=e.target.dataset.resumeSim,result=e.target.dataset.resultAttempt;if(start)return startSimulation(start);if(resume)return loadAttempt(Number(e.target.dataset.attempt));if(result)return loadResult(Number(result))});
  $('#examOptions')?.addEventListener('change',e=>{if(e.target.name==='sim-answer')answerAndAdvance(e.target.value)});
  $('#markReview')?.addEventListener('click',()=>{const q=questions[index],a=answers.get(Number(q.id));saveCurrent({marcada_revisao:!a?.marcada_revisao}).then(renderExam)});
  $('#prevQuestion')?.addEventListener('click',()=>{if(index>0)goToQuestion(index-1)});
  $('#nextQuestion')?.addEventListener('click',()=>{if(index<questions.length-1)goToQuestion(index+1);else $('#finishSimulation').scrollIntoView({behavior:'smooth',block:'center'})});
  $('#examNavigator')?.addEventListener('click',e=>{const i=Number(e.target.dataset.gotoQ);if(Number.isInteger(i)&&i>=0&&i<questions.length)goToQuestion(i)});
  $('#finishSimulation')?.addEventListener('click',()=>finishSimulation(false));
  $('#backToSimulations')?.addEventListener('click',loadList);$('#backFromResult')?.addEventListener('click',loadList);
  $('#securityAcknowledge')?.addEventListener('click',()=>securityModal(false));
  document.addEventListener('click',e=>{
    if(!securityEnabled||!active)return;
    const link=e.target.closest('a[href]');
    if(!link)return;
    const href=link.getAttribute('href')||'';
    if(!href||href==='#'||href.startsWith('javascript:'))return;
    e.preventDefault();
    e.stopPropagation();
    registerSecurityViolation();
  },true);
  document.addEventListener('visibilitychange',handleVisibilityChange);
  window.addEventListener('pagehide',stopTimer,{once:true});
}
