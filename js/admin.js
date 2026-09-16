import {sb} from './supabase.js';

const $ = (s) => document.querySelector(s);
const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let disciplines = [], topics = [];

function notice(message, type='success') {
  const el = $('#adminNotice'); if (!el) return;
  el.textContent = message; el.className = `notice ${type}`;
  el.scrollIntoView({behavior:'smooth', block:'nearest'});
  clearTimeout(notice.timer); notice.timer=setTimeout(()=>el.classList.add('hidden'),4500);
}
function setBusy(form,busy){form.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=busy)}
function tabs(){document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===btn));document.querySelectorAll('[data-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.panel!==btn.dataset.tab));}))}
function fillDisciplineSelects(){
  const active=disciplines.filter(d=>d.ativo);
  ['#topicDiscipline','#questionDiscipline'].forEach(sel=>{const el=$(sel);if(!el)return;const current=el.value;el.innerHTML='<option value="">Selecione...</option>'+active.map(d=>`<option value="${d.id}">${esc(d.nome)}</option>`).join('');if(active.some(d=>String(d.id)===current))el.value=current;});
  fillQuestionTopics();
}
function fillQuestionTopics(){const el=$('#questionTopic'),did=Number($('#questionDiscipline')?.value);if(!el)return;el.innerHTML='<option value="">Sem assunto específico</option>'+topics.filter(t=>t.ativo&&t.disciplina_id===did).map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('')}
function renderDisciplines(){const rows=$('#disciplineRows');if(!disciplines.length){rows.innerHTML='<tr><td colspan="4"><div class="empty compact">Nenhuma disciplina cadastrada.</div></td></tr>';return}rows.innerHTML=disciplines.map(d=>`<tr><td>${d.ordem}</td><td><b>${esc(d.nome)}</b></td><td><span class="badge ${d.ativo?'ok':'off'}">${d.ativo?'Ativa':'Inativa'}</span></td><td class="actions"><button class="mini" data-edit-discipline="${d.id}">Editar</button><button class="mini" data-toggle-discipline="${d.id}">${d.ativo?'Desativar':'Ativar'}</button></td></tr>`).join('')}
function renderTopics(){const rows=$('#topicRows');if(!topics.length){rows.innerHTML='<tr><td colspan="4"><div class="empty compact">Nenhum assunto cadastrado.</div></td></tr>';return}const map=Object.fromEntries(disciplines.map(d=>[d.id,d.nome]));rows.innerHTML=topics.map(t=>`<tr><td>${esc(map[t.disciplina_id]||'—')}</td><td><b>${esc(t.nome)}</b></td><td><span class="badge ${t.ativo?'ok':'off'}">${t.ativo?'Ativo':'Inativo'}</span></td><td class="actions"><button class="mini" data-edit-topic="${t.id}">Editar</button><button class="mini" data-toggle-topic="${t.id}">${t.ativo?'Desativar':'Ativar'}</button></td></tr>`).join('')}
async function refresh(){
 const [{data:d,error:de},{data:t,error:te},{count:q,error:qe}]=await Promise.all([sb.from('disciplinas').select('*').order('ordem').order('nome'),sb.from('assuntos').select('*').order('nome'),sb.from('questoes').select('*',{count:'exact',head:true})]);
 if(de||te||qe){notice((de||te||qe).message,'error');return}
 disciplines=d||[];topics=t||[];$('#discCount').textContent=disciplines.filter(x=>x.ativo).length;$('#topicCount').textContent=topics.filter(x=>x.ativo).length;$('#questionCount').textContent=q||0;renderDisciplines();renderTopics();fillDisciplineSelects();
}
function resetDiscipline(){const f=$('#disciplineForm');f.reset();f.elements.id.value='';f.elements.ordem.value=0;$('#cancelDiscipline').classList.add('hidden')}
function resetTopic(){const f=$('#topicForm');f.reset();f.elements.id.value='';$('#cancelTopic').classList.add('hidden')}
function bindStructure(){
 $('#disciplineForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,id=f.elements.id.value,payload={nome:f.elements.nome.value.trim(),ordem:Number(f.elements.ordem.value)||0};if(!payload.nome)return;setBusy(f,true);const r=id?await sb.from('disciplinas').update(payload).eq('id',id):await sb.from('disciplinas').insert(payload);setBusy(f,false);if(r.error)return notice(r.error.message,'error');notice(id?'Disciplina atualizada.':'Disciplina cadastrada.');resetDiscipline();await refresh()});
 $('#topicForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,id=f.elements.id.value,payload={disciplina_id:Number(f.elements.disciplina_id.value),nome:f.elements.nome.value.trim()};if(!payload.disciplina_id||!payload.nome)return;setBusy(f,true);const r=id?await sb.from('assuntos').update(payload).eq('id',id):await sb.from('assuntos').insert(payload);setBusy(f,false);if(r.error)return notice(r.error.message,'error');notice(id?'Assunto atualizado.':'Assunto cadastrado.');resetTopic();await refresh()});
 $('#cancelDiscipline').addEventListener('click',resetDiscipline);$('#cancelTopic').addEventListener('click',resetTopic);
 $('#disciplineRows').addEventListener('click',async e=>{const edit=e.target.dataset.editDiscipline,toggle=e.target.dataset.toggleDiscipline;if(edit){const d=disciplines.find(x=>x.id===Number(edit));const f=$('#disciplineForm');f.elements.id.value=d.id;f.elements.nome.value=d.nome;f.elements.ordem.value=d.ordem;$('#cancelDiscipline').classList.remove('hidden');f.scrollIntoView({behavior:'smooth'})}if(toggle){const d=disciplines.find(x=>x.id===Number(toggle));const {error}=await sb.from('disciplinas').update({ativo:!d.ativo}).eq('id',d.id);if(error)return notice(error.message,'error');notice(`Disciplina ${d.ativo?'desativada':'ativada'}.`);await refresh()}});
 $('#topicRows').addEventListener('click',async e=>{const edit=e.target.dataset.editTopic,toggle=e.target.dataset.toggleTopic;if(edit){const t=topics.find(x=>x.id===Number(edit));const f=$('#topicForm');f.elements.id.value=t.id;f.elements.disciplina_id.value=t.disciplina_id;f.elements.nome.value=t.nome;$('#cancelTopic').classList.remove('hidden');f.scrollIntoView({behavior:'smooth'})}if(toggle){const t=topics.find(x=>x.id===Number(toggle));const {error}=await sb.from('assuntos').update({ativo:!t.ativo}).eq('id',t.id);if(error)return notice(error.message,'error');notice(`Assunto ${t.ativo?'desativado':'ativado'}.`);await refresh()}});
 $('#questionDiscipline').addEventListener('change',fillQuestionTopics);
}
function bindQuestion(ctx){$('#questionForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,fd=new FormData(f),payload=Object.fromEntries(fd.entries());payload.disciplina_id=Number(payload.disciplina_id);payload.assunto_id=payload.assunto_id?Number(payload.assunto_id):null;payload.ano=payload.ano?Number(payload.ano):null;payload.created_by=ctx.user.id;payload.ativo=true;setBusy(f,true);const {error}=await sb.from('questoes').insert(payload);setBusy(f,false);if(error)return notice(error.message,'error');f.reset();fillQuestionTopics();notice('Questão cadastrada com sucesso.');await refresh()})}
function bindProfile(ctx){$('#profileName').value=ctx.profile.nome||'';$('#profileForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,nome=f.elements.nome.value.trim();setBusy(f,true);const {error}=await sb.rpc('update_my_name',{new_name:nome});setBusy(f,false);if(error)return notice(error.message,'error');ctx.profile.nome=nome;$('#userName').textContent=nome;notice('Nome atualizado.')})}
export async function setupAdmin(ctx){if(ctx.profile?.role!=='admin'){document.querySelector('#adminArea').innerHTML='<div class="empty">Acesso restrito.</div>';return}tabs();bindStructure();bindQuestion(ctx);bindProfile(ctx);await refresh()}
