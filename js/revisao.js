import {sb} from './supabase.js';

const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

function reviewAction({index,icon,title,description,meta,href,primary=false}){
 return `<div class="review-mission-step ${primary?'is-primary':''}"><div class="review-step-number">${index}</div><div class="review-step-icon">${icon}</div><div class="review-step-copy"><b>${esc(title)}</b><small>${esc(description)}</small>${meta?`<span>${esc(meta)}</span>`:''}</div><a class="btn ${primary?'':'secondary'} mini-btn" href="${href}">REVISAR</a></div>`;
}

function renderEmptyMission(){
 $('#reviewHeadline').textContent='Revisão em dia';
 $('#reviewSummary').textContent='Seu histórico não apresenta pendências relevantes neste momento. Você pode seguir para a missão do dia ou continuar praticando pelo banco de questões.';
 $('#reviewStatus').textContent='EM DIA';
 $('#reviewMissionCount').textContent='0';
 $('#reviewMission').innerHTML=`<div class="review-clear"><span>✓</span><div><b>Nenhuma revisão prioritária agora</b><small>Mantenha a constância e volte depois de novas questões ou revisões.</small></div><a class="btn secondary" href="./missao.html">VER MISSÃO DO DIA</a></div>`;
}

export async function loadReview(ctx){
 const uid=ctx.user.id;
 try{
  const [{data:errs,error:ee},{data:cards,error:ce},{data:revs,error:re},{data:favs,error:fe},{data:resp,error:rse}]=await Promise.all([
   sb.from('caderno_erros').select('questao_id,erros,dominado,questoes(id,enunciado,disciplina_id,assunto_id,disciplinas(nome),assuntos(nome))').eq('user_id',uid),
   sb.from('flashcards').select('id,disciplina_id,assunto_id,user_id').eq('ativo',true),
   sb.from('flashcard_revisoes').select('flashcard_id,proxima_revisao,reviewed_at').eq('user_id',uid).order('reviewed_at',{ascending:false}),
   sb.from('favoritos').select('questao_id').eq('user_id',uid),
   sb.from('respostas').select('acertou,questao_id,created_at,questoes(assunto_id,disciplina_id,disciplinas(nome),assuntos(nome))').eq('user_id',uid)
  ]);
  if(ee||ce||re||fe||rse)throw ee||ce||re||fe||rse;

  const today=localDate();
  const latest=new Map();
  for(const r of revs||[])if(!latest.has(Number(r.flashcard_id)))latest.set(Number(r.flashcard_id),r);
  const due=(cards||[]).filter(c=>{const r=latest.get(Number(c.id));return !r||!r.proxima_revisao||r.proxima_revisao<=today});
  const recurring=(errs||[]).filter(e=>!e.dominado&&Number(e.erros)>=2).sort((a,b)=>Number(b.erros)-Number(a.erros));
  const favCount=(favs||[]).length;

  const map=new Map();
  for(const r of resp||[]){
   const q=r.questoes;if(!q?.assunto_id)continue;
   const k=Number(q.assunto_id),x=map.get(k)||{id:k,disciplineId:Number(q.disciplina_id)||null,name:q.assuntos?.nome||'Assunto',disc:q.disciplinas?.nome||'',n:0,h:0};
   x.n++;if(r.acertou)x.h++;map.set(k,x);
  }
  const weak=[...map.values()].filter(x=>x.n>=3).map(x=>({...x,acc:Math.round(x.h/x.n*100)})).filter(x=>x.acc<70).sort((a,b)=>a.acc-b.acc||b.n-a.n);

  const actions=[];
  if(recurring.length){
   const qty=clamp(recurring.length,5,20);
   actions.push({icon:'⚠️',title:'Refazer erros recorrentes',description:`Resolva até ${qty} questões que já se repetiram no seu Caderno de Erros.`,meta:`${recurring.length} pendente${recurring.length===1?'':'s'} · maior recorrência: ${Number(recurring[0].erros)} erro${Number(recurring[0].erros)===1?'':'s'}`,href:`./questoes.html?modo=erros&quantidade=${qty}`});
  }
  if(due.length){
   actions.push({icon:'🧠',title:'Revisar flashcards vencidos',description:'Faça uma rodada dos cartões que chegaram à data de revisão.',meta:`${due.length} flashcard${due.length===1?'':'s'} pendente${due.length===1?'':'s'}`,href:'./flashcards.html'});
  }
  if(weak.length){
   const w=weak[0],qty=10;
   actions.push({icon:'📉',title:`Reforçar ${w.name}`,description:'Faça uma sessão curta focada no assunto com menor aproveitamento consolidado.',meta:`${w.disc||'Disciplina'} · ${w.acc}% em ${w.n} respostas`,href:`./questoes.html?assunto=${w.id}&quantidade=${qty}`});
  }
  if(favCount){
   actions.push({icon:'📌',title:'Voltar às questões salvas',description:'Revise as questões que você marcou para consultar novamente.',meta:`${favCount} questão${favCount===1?'':'ões'} salva${favCount===1?'':'s'}`,href:`./questoes.html?modo=favoritas&quantidade=${clamp(favCount,5,20)}`});
  }

  if(actions.length){
   $('#reviewHeadline').textContent=actions.length===1?'Há 1 frente de revisão para hoje':`Há ${actions.length} frentes de revisão para hoje`;
   $('#reviewSummary').textContent='Comece pelo primeiro item e avance no seu ritmo. O roteiro é atualizado conforme seu histórico muda.';
   $('#reviewStatus').textContent='PRONTO';
   $('#reviewMissionCount').textContent=actions.length;
   $('#reviewMission').innerHTML=actions.map((a,i)=>reviewAction({...a,index:i+1,primary:i===0})).join('');
  }else renderEmptyMission();

  $('#reviewCards').innerHTML=[
   {i:'⚠️',t:'Erros recorrentes',n:recurring.length,d:'Questões erradas duas vezes ou mais.',href:'./questoes.html?modo=erros&quantidade=30'},
   {i:'🧠',t:'Flashcards vencidos',n:due.length,d:'Cartões disponíveis para revisão hoje.',href:'./flashcards.html'},
   {i:'📌',t:'Questões salvas',n:favCount,d:'Marcadas para consultar novamente.',href:'./questoes.html?modo=favoritas&quantidade=30'},
   {i:'📉',t:'Assuntos abaixo de 70%',n:weak.length,d:'Com pelo menos 3 respostas registradas.',href:'./desempenho.html'}
  ].map(x=>`<a class="card review-action-card" href="${x.href}"><span>${x.i}</span><div><b>${esc(x.t)}</b><small>${esc(x.d)}</small></div><strong>${x.n}</strong></a>`).join('');

  $('#reviewTopics').innerHTML=weak.length?weak.slice(0,6).map((x,i)=>`<div class="review-line"><span><b>${esc(x.name)}</b><small>${esc(x.disc)} · ${x.n} respostas</small></span><span class="review-line-actions"><strong>${x.acc}%</strong><a class="mini" href="./questoes.html?assunto=${x.id}&quantidade=10">Praticar</a></span></div>`).join(''):'<div class="empty compact">Nenhum assunto com histórico suficiente abaixo de 70%.</div>';

  $('#reviewErrors').innerHTML=recurring.length?recurring.slice(0,6).map(e=>`<div class="review-line"><span><b>${esc(e.questoes?.assuntos?.nome||e.questoes?.disciplinas?.nome||'Questão')}</b><small>${esc((e.questoes?.enunciado||'').slice(0,95))}${(e.questoes?.enunciado||'').length>95?'…':''}</small></span><a class="badge" href="./questoes.html?questao=${e.questao_id}">${e.erros} erros</a></div>`).join(''):'<div class="empty compact">Sem erros recorrentes pendentes.</div>';
 }catch(e){
  console.error(e);
  $('#reviewHeadline').textContent='Não foi possível preparar a revisão';
  $('#reviewSummary').textContent='Tente atualizar a página. Seus registros de estudo continuam preservados.';
  $('#reviewStatus').textContent='INDISPONÍVEL';
  $('#reviewMissionCount').textContent='—';
  $('#reviewMission').innerHTML='<div class="empty compact">Não foi possível carregar o roteiro agora.</div>';
  $('#reviewCards').innerHTML='<div class="card empty">Dados de revisão indisponíveis.</div>';
  $('#reviewTopics').innerHTML='<div class="empty compact">Dados indisponíveis.</div>';
  $('#reviewErrors').innerHTML='<div class="empty compact">Dados indisponíveis.</div>';
 }
}
