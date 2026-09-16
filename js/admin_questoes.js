import {sb} from './supabase.js';

const $ = (s)=>document.querySelector(s);
const esc = (v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

let ctxRef=null, questions=[], disciplines=[], topics=[];

function fillSelects(){
  const active=disciplines.filter(d=>d.ativo);
  const qd=$('#questionDiscipline'), fd=$('#adminQuestionDiscipline');
  if(qd){
    const cur=qd.value;
    qd.innerHTML='<option value="">Selecione...</option>'+active.map(d=>`<option value="${d.id}">${esc(d.nome)}</option>`).join('');
    if(active.some(d=>String(d.id)===cur))qd.value=cur;
  }
  if(fd){
    const cur=fd.value;
    fd.innerHTML='<option value="">Todas</option>'+active.map(d=>`<option value="${d.id}">${esc(d.nome)}</option>`).join('');
    if(active.some(d=>String(d.id)===cur))fd.value=cur;
  }
  fillTopics();
}

function fillTopics(selected=null){
  const el=$('#questionTopic'); if(!el)return;
  const did=Number($('#questionDiscipline')?.value)||null;
  el.innerHTML='<option value="">Sem assunto específico</option>'+topics.filter(t=>t.ativo&&(!did||t.disciplina_id===did)).map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('');
  if(selected!=null)el.value=String(selected);
}

function filtered(){
  const term=($('#adminQuestionSearch')?.value||'').trim().toLowerCase();
  const did=Number($('#adminQuestionDiscipline')?.value)||null;
  const status=$('#adminQuestionStatus')?.value||'todos';
  return questions.filter(q=>{
    if(did&&q.disciplina_id!==did)return false;
    if(status==='ativo'&&!q.ativo)return false;
    if(status==='inativo'&&q.ativo)return false;
    if(term){
      const hay=[q.enunciado,q.banca,q.concurso,q.disciplinas?.nome,q.assuntos?.nome].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(term))return false;
    }
    return true;
  });
}

function render(){
  const el=$('#adminQuestionList'); if(!el)return;
  const list=filtered();
  $('#adminQuestionVisibleCount').textContent=list.length;
  if(!list.length){el.innerHTML='<div class="card empty">Nenhuma questão encontrada.</div>';return;}
  el.innerHTML=list.map(q=>`<article class="card admin-question-item ${q.ativo?'':'is-inactive'}">
    <div class="admin-question-head"><div><span class="eyebrow">#${q.id} · ${esc(q.disciplinas?.nome||'Sem disciplina')}</span><b>${esc(q.assuntos?.nome||'Sem assunto específico')}</b></div><span class="badge ${q.ativo?'ok':'off'}">${q.ativo?'Ativa':'Inativa'}</span></div>
    <p>${esc(q.enunciado).replace(/\n/g,'<br>')}</p>
    <div class="admin-question-meta">${q.banca?`<span>${esc(q.banca)}</span>`:''}${q.concurso?`<span>${esc(q.concurso)}</span>`:''}${q.ano?`<span>${q.ano}</span>`:''}<span>Correta: ${q.correta}</span></div>
    <div class="actions"><button class="mini" data-q-action="editar" data-id="${q.id}">Editar</button><button class="mini" data-q-action="toggle" data-id="${q.id}">${q.ativo?'Desativar':'Ativar'}</button><button class="mini danger-mini" data-q-action="excluir" data-id="${q.id}">Excluir</button></div>
  </article>`).join('');
}

async function load(){
  const [{data:d,error:de},{data:t,error:te},{data:q,error:qe}]=await Promise.all([
    sb.from('disciplinas').select('*').order('ordem').order('nome'),
    sb.from('assuntos').select('*').order('nome'),
    sb.from('questoes').select('*,disciplinas(nome),assuntos(nome)').order('created_at',{ascending:false}).limit(500)
  ]);
  if(de||te||qe)throw de||te||qe;
  disciplines=d||[];topics=t||[];questions=q||[];fillSelects();render();
}

function resetForm(){
  const f=$('#questionForm'); if(!f)return;
  f.reset(); f.elements.id.value='';
  $('#saveQuestion').textContent='SALVAR QUESTÃO';
  $('#cancelQuestion').classList.add('hidden');
  fillTopics();
}

function editQuestion(q){
  const f=$('#questionForm');
  f.elements.id.value=q.id;
  f.elements.disciplina_id.value=q.disciplina_id;
  fillTopics(q.assunto_id);
  ['banca','concurso','ano','enunciado','alternativa_a','alternativa_b','alternativa_c','alternativa_d','alternativa_e','correta','comentario','palavra_chave','macete'].forEach(k=>{if(f.elements[k])f.elements[k].value=q[k]??'';});
  $('#saveQuestion').textContent='ATUALIZAR QUESTÃO';
  $('#cancelQuestion').classList.remove('hidden');
  f.scrollIntoView({behavior:'smooth',block:'start'});
}

async function save(e,refreshSummary,notice){
  e.preventDefault();
  const f=e.currentTarget, id=f.elements.id.value;
  const fd=new FormData(f), payload=Object.fromEntries(fd.entries());
  delete payload.id;
  payload.disciplina_id=Number(payload.disciplina_id);
  payload.assunto_id=payload.assunto_id?Number(payload.assunto_id):null;
  payload.ano=payload.ano?Number(payload.ano):null;
  payload.alternativa_e=payload.alternativa_e?.trim()||null;
  payload.banca=payload.banca?.trim()||null;
  payload.concurso=payload.concurso?.trim()||null;
  payload.comentario=payload.comentario?.trim()||null;
  payload.palavra_chave=payload.palavra_chave?.trim()||null;
  payload.macete=payload.macete?.trim()||null;
  payload.enunciado=payload.enunciado.trim();
  ['alternativa_a','alternativa_b','alternativa_c','alternativa_d'].forEach(k=>payload[k]=payload[k].trim());
  if(payload.correta==='E'&&!payload.alternativa_e){notice('Preencha a alternativa E ou escolha outra resposta correta.','error');return;}
  if(!id){payload.created_by=ctxRef.user.id;payload.ativo=true;}
  f.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=true);
  const r=id?await sb.from('questoes').update(payload).eq('id',id):await sb.from('questoes').insert(payload);
  f.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=false);
  if(r.error)return notice('Não foi possível salvar a questão.','error');
  notice(id?'Questão atualizada.':'Questão cadastrada.');
  resetForm();
  await Promise.all([load(),refreshSummary()]);
}

async function action(e,refreshSummary,notice){
  const b=e.target.closest('[data-q-action]'); if(!b)return;
  const q=questions.find(x=>String(x.id)===String(b.dataset.id)); if(!q)return;
  const a=b.dataset.qAction;
  if(a==='editar')return editQuestion(q);
  if(a==='toggle'){
    const {error}=await sb.from('questoes').update({ativo:!q.ativo}).eq('id',q.id);
    if(error)return notice('Não foi possível alterar o status da questão.','error');
    notice(q.ativo?'Questão desativada.':'Questão ativada.');
    await Promise.all([load(),refreshSummary()]);
  }
  if(a==='excluir'){
    if(!confirm(`Excluir definitivamente a questão #${q.id}? As respostas e registros ligados a ela também poderão ser removidos.`))return;
    const {error}=await sb.from('questoes').delete().eq('id',q.id);
    if(error)return notice('Não foi possível excluir a questão.','error');
    notice('Questão excluída.');
    await Promise.all([load(),refreshSummary()]);
  }
}

export async function setupAdminQuestoes(ctx,refreshSummary,notice){
  ctxRef=ctx;
  await load().catch(e=>{console.error(e);notice('Não foi possível carregar o banco de questões.','error');});
  $('#questionForm')?.addEventListener('submit',e=>save(e,refreshSummary,notice));
  $('#questionDiscipline')?.addEventListener('change',()=>fillTopics());
  $('#cancelQuestion')?.addEventListener('click',resetForm);
  $('#adminQuestionSearch')?.addEventListener('input',render);
  $('#adminQuestionDiscipline')?.addEventListener('change',render);
  $('#adminQuestionStatus')?.addEventListener('change',render);
  $('#adminQuestionList')?.addEventListener('click',e=>action(e,refreshSummary,notice));
}
