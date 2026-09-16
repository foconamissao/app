import {sb} from './supabase.js';

const $=(s)=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const state={ctx:null,items:[],disciplines:[],topics:[],filtered:[],flashcardQuestion:null};

function fmtDate(value){
  if(!value)return '—';
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}
function answerText(q,letter){return q?.[`alternativa_${String(letter||'').toLowerCase()}`]||'';}
function fillFilters(){
  const ds=[...new Map(state.items.map(x=>[x.questoes?.disciplina_id,x.questoes?.disciplinas]).filter(([,d])=>d)).entries()];
  $('#errorDiscipline').innerHTML='<option value="">Todas</option>'+ds.map(([id,d])=>`<option value="${id}">${esc(d.nome)}</option>`).join('');
  fillTopics();
}
function fillTopics(){
  const did=Number($('#errorDiscipline').value)||null;
  const ts=[...new Map(state.items.filter(x=>!did||x.questoes?.disciplina_id===did).map(x=>[x.questoes?.assunto_id,x.questoes?.assuntos]).filter(([,t])=>t)).entries()];
  const current=$('#errorTopic').value;
  $('#errorTopic').innerHTML='<option value="">Todos</option>'+ts.map(([id,t])=>`<option value="${id}">${esc(t.nome)}</option>`).join('');
  if([...$('#errorTopic').options].some(o=>o.value===current))$('#errorTopic').value=current;
}
function updateStats(){
  const total=state.items.reduce((n,x)=>n+(Number(x.erros)||0),0);
  const pending=state.items.filter(x=>!x.dominado).length;
  const mastered=state.items.filter(x=>x.dominado).length;
  const byDiscipline=new Map();
  state.items.forEach(x=>{const name=x.questoes?.disciplinas?.nome||'Sem disciplina';byDiscipline.set(name,(byDiscipline.get(name)||0)+(Number(x.erros)||0));});
  const top=[...byDiscipline.entries()].sort((a,b)=>b[1]-a[1])[0];
  $('#errorOccurrences').textContent=total;
  $('#errorPending').textContent=pending;
  $('#errorMastered').textContent=mastered;
  $('#errorTopSubject').textContent=top?.[0]||'—';
  $('#errorTopSubjectDetail').textContent=top?`${top[1]} erro${top[1]===1?'':'s'}`:'sem dados';
}
function filterItems(){
  const search=$('#errorSearch').value.trim().toLowerCase();
  const did=Number($('#errorDiscipline').value)||null;
  const tid=Number($('#errorTopic').value)||null;
  const status=$('#errorStatus').value;
  state.filtered=state.items.filter(x=>{
    const q=x.questoes||{};
    const hay=[q.enunciado,q.comentario,q.palavra_chave,q.macete,q.disciplinas?.nome,q.assuntos?.nome].filter(Boolean).join(' ').toLowerCase();
    return (!search||hay.includes(search))&&(!did||q.disciplina_id===did)&&(!tid||q.assunto_id===tid)&&(status==='todos'||(status==='pendentes'&&!x.dominado)||(status==='dominadas'&&x.dominado));
  });
  renderList();
}
function renderList(){
  $('#errorVisibleCount').textContent=`${state.filtered.length} quest${state.filtered.length===1?'ão':'ões'}`;
  const el=$('#errorList');
  if(!state.filtered.length){el.innerHTML='<div class="card empty">Nenhuma questão encontrada com esses filtros.</div>';return;}
  el.innerHTML=state.filtered.map(x=>{
    const q=x.questoes||{};
    const wrong=x.ultima_resposta||'—';
    const correct=q.correta||'—';
    const recurrence=Number(x.erros)||1;
    return `<article class="card error-item ${x.dominado?'is-mastered':''}" data-id="${x.id}">
      <div class="error-item-head">
        <div><span class="eyebrow">${esc(q.disciplinas?.nome||'Sem disciplina')} ${q.assuntos?.nome?`· ${esc(q.assuntos.nome)}`:''}</span><h3>${x.dominado?'✅ Dominada':'❌ Em revisão'}</h3></div>
        <div class="error-badges"><span class="badge danger">${recurrence} erro${recurrence===1?'':'s'}</span><span class="badge">Último: ${fmtDate(x.ultimo_erro)}</span></div>
      </div>
      <div class="error-statement">${esc(q.enunciado||'Questão indisponível').replace(/\n/g,'<br>')}</div>
      <div class="error-answer-grid">
        <div class="error-answer wrong"><small>Sua última resposta</small><b>${esc(wrong)}${answerText(q,wrong)?` — ${esc(answerText(q,wrong))}`:''}</b></div>
        <div class="error-answer right"><small>Resposta correta</small><b>${esc(correct)}${answerText(q,correct)?` — ${esc(answerText(q,correct))}`:''}</b></div>
      </div>
      ${q.comentario?`<div class="error-explanation"><strong>💡 Comentário</strong><p>${esc(q.comentario).replace(/\n/g,'<br>')}</p></div>`:''}
      ${(q.palavra_chave||q.macete)?`<div class="feedback-tips">${q.palavra_chave?`<span><strong>🔑 Palavra-chave:</strong> ${esc(q.palavra_chave)}</span>`:''}${q.macete?`<span><strong>🧠 Macete:</strong> ${esc(q.macete)}</span>`:''}</div>`:''}
      <div class="error-actions">
        <a class="btn secondary" href="./questoes.html?questao=${q.id}&origem=erros">🔁 REFAZER QUESTÃO</a>
        <button class="btn secondary" type="button" data-action="flashcard" data-id="${x.id}">🧠 CRIAR FLASHCARD</button>
        <button class="btn ${x.dominado?'secondary':''}" type="button" data-action="master" data-id="${x.id}">${x.dominado?'↩ VOLTAR PARA PENDENTES':'✓ MARCAR COMO DOMINADA'}</button>
      </div>
    </article>`;
  }).join('');
}
async function load(){
  const {data,error}=await sb.from('caderno_erros').select(`id,questao_id,erros,ultima_resposta,dominado,ultimo_erro,questoes(id,disciplina_id,assunto_id,enunciado,alternativa_a,alternativa_b,alternativa_c,alternativa_d,alternativa_e,correta,comentario,palavra_chave,macete,disciplinas(nome),assuntos(nome))`).eq('user_id',state.ctx.user.id).order('ultimo_erro',{ascending:false});
  if(error)throw error;
  state.items=data||[];
  fillFilters();updateStats();filterItems();
}
async function toggleMaster(id){
  const item=state.items.find(x=>Number(x.id)===Number(id));if(!item)return;
  const next=!item.dominado;
  const {error}=await sb.from('caderno_erros').update({dominado:next}).eq('id',item.id).eq('user_id',state.ctx.user.id);
  if(error)return alert('Não foi possível atualizar esta questão.');
  item.dominado=next;updateStats();filterItems();
}
function openFlashcard(id){
  const item=state.items.find(x=>Number(x.id)===Number(id));if(!item)return;
  const q=item.questoes||{};state.flashcardQuestion=q;
  $('#flashcardQuestionId').value=q.id||'';
  $('#flashcardFront').value=q.enunciado||'';
  const correct=answerText(q,q.correta);
  $('#flashcardBack').value=[`Resposta correta: ${q.correta}${correct?` — ${correct}`:''}`,q.comentario?`\n${q.comentario}`:'',q.palavra_chave?`\nPalavra-chave: ${q.palavra_chave}`:'',q.macete?`\nMacete: ${q.macete}`:''].filter(Boolean).join('');
  $('#flashcardNotice').classList.add('hidden');
  $('#flashcardModal').classList.remove('hidden');
  setTimeout(()=>$('#flashcardFront').focus(),20);
}
function closeFlashcard(){state.flashcardQuestion=null;$('#flashcardModal').classList.add('hidden');}
async function saveFlashcard(e){
  e.preventDefault();const q=state.flashcardQuestion;if(!q)return;
  const front=$('#flashcardFront').value.trim(),back=$('#flashcardBack').value.trim();
  if(!front||!back)return;
  const btn=e.submitter;btn.disabled=true;btn.textContent='CRIANDO...';
  const {error}=await sb.from('flashcards').insert({user_id:state.ctx.user.id,disciplina_id:q.disciplina_id,assunto_id:q.assunto_id||null,frente:front,verso:back,origem_questao_id:q.id,ativo:true,created_by:state.ctx.user.id});
  btn.disabled=false;btn.textContent='CRIAR FLASHCARD';
  const note=$('#flashcardNotice');note.classList.remove('hidden');
  if(error){
    if(String(error.code)==='23505')note.textContent='Você já criou um flashcard para esta questão.';
    else note.textContent='Não foi possível criar o flashcard. Tente novamente.';
    note.className='notice error';return;
  }
  note.textContent='Flashcard criado. Ele já está disponível na sua área de revisão.';note.className='notice success';
  setTimeout(closeFlashcard,1100);
}
export async function initErros(ctx){
  state.ctx=ctx;
  try{await load();}catch(e){console.error(e);$('#errorList').innerHTML='<div class="card empty">Não foi possível carregar seu Caderno de Erros.</div>';}
  $('#errorDiscipline').addEventListener('change',()=>{fillTopics();filterItems();});
  $('#errorTopic').addEventListener('change',filterItems);$('#errorStatus').addEventListener('change',filterItems);$('#errorSearch').addEventListener('input',filterItems);
  $('#errorList').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;b.dataset.action==='master'?toggleMaster(b.dataset.id):openFlashcard(b.dataset.id);});
  $('#closeFlashcardModal').addEventListener('click',closeFlashcard);$('#cancelFlashcard').addEventListener('click',closeFlashcard);$('#flashcardForm').addEventListener('submit',saveFlashcard);
  $('#flashcardModal').addEventListener('click',e=>{if(e.target.id==='flashcardModal')closeFlashcard();});
}
