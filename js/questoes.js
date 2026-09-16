import {sb} from './supabase.js';

const $ = (s) => document.querySelector(s);
const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const state = {
  ctx:null,
  disciplines:[],
  topics:[],
  questions:[],
  session:[],
  favorites:new Set(),
  errorCounts:new Map(),
  index:0,
  selected:null,
  answered:false,
  hits:0,
  startedAt:null
};

function notice(message,type='error'){
  const el=$('#questionSetupNotice');
  el.textContent=message;
  el.className=`notice ${type}`;
  el.classList.remove('hidden');
  clearTimeout(notice.timer);
  notice.timer=setTimeout(()=>el.classList.add('hidden'),4500);
}

function shuffle(list){
  const a=[...list];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

function fillDisciplines(){
  const el=$('#filterDiscipline');
  el.innerHTML='<option value="">Todas</option>'+state.disciplines.map(d=>`<option value="${d.id}">${esc(d.nome)}</option>`).join('');
  fillTopics();
}

function fillTopics(){
  const did=Number($('#filterDiscipline').value)||null;
  const el=$('#filterTopic');
  const options=state.topics.filter(t=>!did||t.disciplina_id===did);
  el.innerHTML='<option value="">Todos</option>'+options.map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('');
}

async function loadBase(){
  const [{data:disc,error:de},{data:top,error:te},{data:q,error:qe},{data:fav,error:fe},{data:errs,error:ee}]=await Promise.all([
    sb.from('disciplinas').select('id,nome,peso').eq('ativo',true).order('peso',{ascending:false}).order('nome'),
    sb.from('assuntos').select('id,disciplina_id,nome,recorrencia,dificuldade').eq('ativo',true).order('nome'),
    sb.from('questoes').select('id,disciplina_id,assunto_id,subassunto,banca,concurso,ano,recorrencia,dificuldade,enunciado,alternativa_a,alternativa_b,alternativa_c,alternativa_d,alternativa_e,correta,comentario,ponto_fixacao,base_legal,palavra_chave,macete,disciplinas(nome,peso),assuntos(nome,recorrencia,dificuldade)').eq('ativo',true),
    sb.from('favoritos').select('questao_id').eq('user_id',state.ctx.user.id),
    sb.from('caderno_erros').select('questao_id,erros,dominado').eq('user_id',state.ctx.user.id)
  ]);
  if(de||te||qe||fe||ee) throw de||te||qe||fe||ee;
  state.disciplines=disc||[];
  state.topics=top||[];
  state.questions=q||[];
  state.favorites=new Set((fav||[]).map(x=>Number(x.questao_id)));
  state.errorCounts=new Map((errs||[]).map(x=>[Number(x.questao_id),{erros:Number(x.erros)||0,dominado:!!x.dominado}]));
  fillDisciplines();
  updateAvailableCount();
}

async function filteredQuestions(){
  const did=Number($('#filterDiscipline').value)||null;
  const tid=Number($('#filterTopic').value)||null;
  const mode=$('#filterMode').value;
  let list=state.questions.filter(q=>(!did||q.disciplina_id===did)&&(!tid||q.assunto_id===tid));

  if(mode==='favoritas'){
    list=list.filter(q=>state.favorites.has(Number(q.id)));
  } else if(mode==='nao_respondidas'){
    const {data,error}=await sb.from('respostas').select('questao_id').eq('user_id',state.ctx.user.id);
    if(error) throw error;
    const answered=new Set((data||[]).map(x=>Number(x.questao_id)));
    list=list.filter(q=>!answered.has(Number(q.id)));
  } else if(mode==='erros'){
    const {data,error}=await sb.from('caderno_erros').select('questao_id').eq('user_id',state.ctx.user.id);
    if(error) throw error;
    const wrong=new Set((data||[]).map(x=>Number(x.questao_id)));
    list=list.filter(q=>wrong.has(Number(q.id)));
  }
  return list;
}

async function updateAvailableCount(){
  try{
    const list=await filteredQuestions();
    $('#availableCount').textContent=`${list.length} disponível${list.length===1?'':'is'}`;
  }catch{
    $('#availableCount').textContent='—';
  }
}

function showOnly(id){
  ['#questionSetup','#questionSession','#questionResult'].forEach(s=>$(s).classList.toggle('hidden',s!==id));
}

function currentQuestion(){return state.session[state.index]||null;}

function metaText(q){
  const parts=[q.disciplinas?.nome,q.assuntos?.nome,q.subassunto,q.banca,q.concurso,q.ano].filter(Boolean);
  return parts.join(' · ');
}

function renderQuestion(){
  const q=currentQuestion();
  if(!q)return finishSession();
  state.selected=null;
  state.answered=false;
  state.startedAt=Date.now();
  $('#questionMeta').textContent=metaText(q);
  $('#questionCounter').textContent=`Questão ${state.index+1} de ${state.session.length}`;
  $('#questionProgressBar').style.width=`${Math.round((state.index/state.session.length)*100)}%`;
  $('#questionStatement').innerHTML=esc(q.enunciado).replace(/\n/g,'<br>');
  const options=[['A',q.alternativa_a],['B',q.alternativa_b],['C',q.alternativa_c],['D',q.alternativa_d],['E',q.alternativa_e]].filter(([,txt])=>txt&&String(txt).trim());
  $('#questionAlternatives').innerHTML=options.map(([letter,txt])=>`<button class="question-option" type="button" data-letter="${letter}"><span>${letter}</span><b>${esc(txt)}</b></button>`).join('');
  $('#submitAnswer').disabled=true;
  $('#submitAnswer').classList.remove('hidden');
  $('#nextQuestion').classList.add('hidden');
  $('#questionFeedback').className='question-feedback hidden';
  $('#questionFeedback').innerHTML='';
  updateFavoriteButton();
}

function chooseAlternative(btn){
  if(state.answered)return;
  state.selected=btn.dataset.letter;
  document.querySelectorAll('.question-option').forEach(x=>x.classList.toggle('selected',x===btn));
  $('#submitAnswer').disabled=false;
}

async function registerError(q,answer){
  const {error}=await sb.rpc('registrar_erro',{p_questao_id:q.id,p_resposta:answer});
  if(error) throw error;
}

async function submitAnswer(){
  if(state.answered||!state.selected)return;
  const q=currentQuestion();
  const answer=state.selected;
  const correct=answer===q.correta;
  const elapsed=Math.max(1,Math.round((Date.now()-state.startedAt)/1000));
  $('#submitAnswer').disabled=true;

  const {error}=await sb.from('respostas').insert({user_id:state.ctx.user.id,questao_id:q.id,resposta:answer,acertou:correct,tempo_segundos:elapsed});
  if(error){
    $('#submitAnswer').disabled=false;
    return alert('Não foi possível registrar sua resposta. Tente novamente.');
  }

  if(!correct){
    try{await registerError(q,answer);}catch(e){console.error(e);}
  }else state.hits++;

  state.answered=true;
  document.querySelectorAll('.question-option').forEach(btn=>{
    btn.disabled=true;
    const l=btn.dataset.letter;
    if(l===q.correta)btn.classList.add('correct');
    if(l===answer&&!correct)btn.classList.add('wrong');
  });

  const feedback=$('#questionFeedback');
  feedback.className=`question-feedback ${correct?'correct-feedback':'wrong-feedback'}`;
  feedback.innerHTML=`
    <div class="feedback-head"><b>${correct?'✅ Resposta correta':'❌ Resposta incorreta'}</b><span>${correct?`Você marcou ${answer}.`:`Você marcou ${answer}. Correta: ${q.correta}.`}</span></div>
    ${q.comentario?`<div class="feedback-block"><strong>💡 Comentário</strong><p>${esc(q.comentario).replace(/\n/g,'<br>')}</p></div>`:''}
    ${q.ponto_fixacao?`<div class="feedback-block fixation-block"><strong>📌 Ponto de fixação</strong><p>${esc(q.ponto_fixacao).replace(/\n/g,'<br>')}</p></div>`:''}${q.base_legal?`<div class="feedback-block"><strong>⚖️ Base legal / referência</strong><p>${esc(q.base_legal).replace(/\n/g,'<br>')}</p></div>`:''}
    ${(q.palavra_chave||q.macete)?`<div class="feedback-tips">${q.palavra_chave?`<span><strong>🔑 Palavra-chave:</strong> ${esc(q.palavra_chave)}</span>`:''}${q.macete?`<span><strong>🧠 Macete:</strong> ${esc(q.macete)}</span>`:''}</div>`:''}`;
  $('#submitAnswer').classList.add('hidden');
  $('#nextQuestion').classList.remove('hidden');
  $('#questionProgressBar').style.width=`${Math.round(((state.index+1)/state.session.length)*100)}%`;
}

async function toggleFavorite(){
  const q=currentQuestion();
  if(!q)return;
  const id=Number(q.id);
  if(state.favorites.has(id)){
    const {error}=await sb.from('favoritos').delete().eq('user_id',state.ctx.user.id).eq('questao_id',id);
    if(error)return alert('Não foi possível remover dos favoritos.');
    state.favorites.delete(id);
  }else{
    const {error}=await sb.from('favoritos').insert({user_id:state.ctx.user.id,questao_id:id});
    if(error)return alert('Não foi possível favoritar a questão.');
    state.favorites.add(id);
  }
  updateFavoriteButton();
}

function updateFavoriteButton(){
  const q=currentQuestion();
  const on=q&&state.favorites.has(Number(q.id));
  const btn=$('#favoriteQuestion');
  btn.textContent=on?'★ Favoritada':'☆ Favoritar';
  btn.setAttribute('aria-pressed',String(!!on));
  btn.classList.toggle('is-favorite',!!on);
}

async function startSession(){
  const btn=$('#startQuestions');
  btn.disabled=true;btn.textContent='PREPARANDO...';
  try{
    const list=await filteredQuestions();
    const qty=Math.max(1,Number($('#filterQuantity').value)||20);
    const distribution=$('#filterDistribution')?.value||'inteligente';
    if(distribution==='inteligente'){
      const did=Number($('#filterDiscipline').value)||null;
      const tid=Number($('#filterTopic').value)||null;
      const mode=$('#filterMode').value||'todas';
      const {data,error}=await sb.rpc('selecionar_questoes_inteligentes',{p_disciplina_id:did,p_assunto_id:tid,p_filtro:mode,p_quantidade:qty});
      if(error)throw error;
      const map=new Map(list.map(q=>[Number(q.id),q]));
      state.session=(data||[]).map(x=>map.get(Number(x.questao_id??x.id))).filter(Boolean);
    }else state.session=shuffle(list).slice(0,qty);
    if(!state.session.length){notice('Nenhuma questão encontrada com esses filtros.');return;}
    state.index=0;state.hits=0;
    showOnly('#questionSession');
    renderQuestion();
  }catch(e){
    console.error(e);notice('Não foi possível preparar a sessão. Tente novamente.');
  }finally{btn.disabled=false;btn.textContent='INICIAR SESSÃO';}
}

function nextQuestion(){
  if(!state.answered)return;
  state.index++;
  if(state.index>=state.session.length)finishSession(); else renderQuestion();
}

function finishSession(){
  const total=Math.min(state.index+(state.answered?1:0),state.session.length);
  $('#resultTotal').textContent=total;
  $('#resultHits').textContent=state.hits;
  $('#resultAccuracy').textContent=total?`${Math.round((state.hits/total)*100)}%`:'0%';
  showOnly('#questionResult');
}

function resetSession(){
  state.session=[];state.index=0;state.selected=null;state.answered=false;state.hits=0;
  if(location.search)history.replaceState(null,'',location.pathname);
  showOnly('#questionSetup');
  updateAvailableCount();
}

export async function initQuestoes(ctx){
  state.ctx=ctx;
  try{
    await loadBase();
    const directId=Number(new URLSearchParams(location.search).get('questao'))||null;
    if(directId){
      const direct=state.questions.find(q=>Number(q.id)===directId);
      if(direct){
        state.session=[direct];state.index=0;state.hits=0;
        showOnly('#questionSession');renderQuestion();
      }else notice('Esta questão não está disponível para revisão.');
    }
  }
  catch(e){console.error(e);notice('Não foi possível carregar o banco de questões.');}

  $('#filterDiscipline').addEventListener('change',()=>{fillTopics();updateAvailableCount();});
  $('#filterTopic').addEventListener('change',updateAvailableCount);
  $('#filterMode').addEventListener('change',updateAvailableCount);
  $('#startQuestions').addEventListener('click',startSession);
  $('#questionAlternatives').addEventListener('click',e=>{const btn=e.target.closest('.question-option');if(btn)chooseAlternative(btn);});
  $('#submitAnswer').addEventListener('click',submitAnswer);
  $('#nextQuestion').addEventListener('click',nextQuestion);
  $('#favoriteQuestion').addEventListener('click',toggleFavorite);
  $('#newSession').addEventListener('click',resetSession);
  $('#exitSession').addEventListener('click',()=>{if(confirm('Encerrar esta sessão de questões?'))finishSession();});
}
