import {sb} from './supabase.js';

const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const typeLabel={teoria:'Teoria',questoes:'Questões',flashcards:'Flashcards',revisao:'Revisão',aula:'Aula',simulado:'Simulado'};
let ctx,disciplines=[],topics=[],schedules=[],activities=[];

function notice(msg,type='success'){
  const el=$('#adminNotice');if(!el)return;el.textContent=msg;el.className=`notice ${type}`;el.scrollIntoView({behavior:'smooth',block:'nearest'});clearTimeout(notice.timer);notice.timer=setTimeout(()=>el.classList.add('hidden'),4200);
}
function setBusy(form,b){form.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=b)}
function fmtDate(v){if(!v)return'—';return new Intl.DateTimeFormat('pt-BR').format(new Date(`${v}T12:00:00`))}
function activeScheduleOptions(){return schedules.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.titulo)}</option>`).join('')}
function fillActivitySelects(){
  const sf=$('#activitySchedule'),df=$('#activityDiscipline');if(sf){const old=sf.value;sf.innerHTML='<option value="">Sem cronograma específico</option>'+activeScheduleOptions();if([...sf.options].some(o=>o.value===old))sf.value=old}
  if(df){const old=df.value;df.innerHTML='<option value="">Sem disciplina específica</option>'+disciplines.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('');if([...df.options].some(o=>o.value===old))df.value=old}
  fillActivityTopics();
}
function fillActivityTopics(){const el=$('#activityTopic');if(!el)return;const did=Number($('#activityDiscipline')?.value||0),old=el.value;el.innerHTML='<option value="">Sem assunto específico</option>'+topics.filter(t=>t.ativo&&t.disciplina_id===did).map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('');if([...el.options].some(o=>o.value===old))el.value=old}
function renderSchedules(){
  const rows=$('#scheduleRows');if(!rows)return;
  if(!schedules.length){rows.innerHTML='<tr><td colspan="5"><div class="empty compact">Nenhum cronograma cadastrado.</div></td></tr>';return}
  rows.innerHTML=schedules.map(s=>`<tr><td><b>${esc(s.titulo)}</b></td><td>${fmtDate(s.data_inicio)}</td><td>${fmtDate(s.data_fim)}</td><td><span class="badge ${s.ativo?'ok':'off'}">${s.ativo?'Publicado':'Oculto'}</span></td><td class="actions"><button class="mini" data-edit-schedule="${s.id}">Editar</button><button class="mini" data-toggle-schedule="${s.id}">${s.ativo?'Ocultar':'Publicar'}</button><button class="mini danger-mini" data-delete-schedule="${s.id}">Excluir</button></td></tr>`).join('');
}
function renderActivities(){
  const rows=$('#activityRows');if(!rows)return;
  const date=$('#activityFilterDate')?.value||'';const filtered=activities.filter(a=>!date||a.data===date);
  if(!filtered.length){rows.innerHTML='<tr><td colspan="6"><div class="empty compact">Nenhuma atividade encontrada.</div></td></tr>';return}
  rows.innerHTML=filtered.map(a=>`<tr><td>${fmtDate(a.data)}</td><td><b>${esc(a.titulo)}</b><small class="table-sub">${esc(typeLabel[a.tipo]||a.tipo)}${a.disciplinas?.nome?' · '+esc(a.disciplinas.nome):''}</small></td><td>${a.meta_quantidade||a.meta_minutos?`${a.meta_quantidade?esc(a.meta_quantidade)+' itens':''}${a.meta_quantidade&&a.meta_minutos?' · ':''}${a.meta_minutos?esc(a.meta_minutos)+' min':''}`:'—'}</td><td>${esc(a.cronogramas?.titulo||'—')}</td><td><span class="badge ${a.ativo?'ok':'off'}">${a.ativo?'Publicada':'Oculta'}</span></td><td class="actions"><button class="mini" data-edit-activity="${a.id}">Editar</button><button class="mini" data-toggle-activity="${a.id}">${a.ativo?'Ocultar':'Publicar'}</button><button class="mini danger-mini" data-delete-activity="${a.id}">Excluir</button></td></tr>`).join('');
}
async function refresh(){
  const [dr,tr,sr,ar]=await Promise.all([
    sb.from('disciplinas').select('*').order('peso',{ascending:false}).order('nome'),
    sb.from('assuntos').select('*').order('nome'),
    sb.from('cronogramas').select('*').order('data_inicio',{ascending:false}),
    sb.from('atividades').select('*,disciplinas(nome),assuntos(nome),cronogramas(titulo)').order('data',{ascending:false}).order('ordem').limit(500)
  ]);
  const err=dr.error||tr.error||sr.error||ar.error;if(err){notice('Não foi possível carregar o cronograma.','error');return}
  disciplines=dr.data||[];topics=tr.data||[];schedules=sr.data||[];activities=ar.data||[];
  $('#scheduleCount').textContent=schedules.filter(x=>x.ativo).length;$('#activityCount').textContent=activities.filter(x=>x.ativo).length;
  fillActivitySelects();renderSchedules();renderActivities();
}
function resetSchedule(){const f=$('#scheduleForm');f.reset();f.elements.id.value='';$('#cancelSchedule').classList.add('hidden')}
function resetActivity(){const f=$('#activityForm');f.reset();f.elements.id.value='';f.elements.ordem.value='0';$('#cancelActivity').classList.add('hidden');fillActivityTopics()}
function bindSchedules(){
  $('#scheduleForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,id=f.elements.id.value;const payload={titulo:f.elements.titulo.value.trim(),data_inicio:f.elements.data_inicio.value,data_fim:f.elements.data_fim.value||null,ativo:f.elements.ativo.checked,created_by:ctx.user.id};if(payload.data_fim&&payload.data_fim<payload.data_inicio)return notice('A data final não pode ser anterior à inicial.','error');setBusy(f,true);const r=id?await sb.from('cronogramas').update(payload).eq('id',id):await sb.from('cronogramas').insert(payload);setBusy(f,false);if(r.error)return notice('Não foi possível salvar o cronograma.','error');notice(id?'Cronograma atualizado.':'Cronograma criado.');resetSchedule();await refresh()});
  $('#cancelSchedule')?.addEventListener('click',resetSchedule);
  $('#scheduleRows')?.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const id=Number(b.dataset.editSchedule||b.dataset.toggleSchedule||b.dataset.deleteSchedule);const s=schedules.find(x=>x.id===id);if(!s)return;
    if(b.dataset.editSchedule){const f=$('#scheduleForm');f.elements.id.value=s.id;f.elements.titulo.value=s.titulo;f.elements.data_inicio.value=s.data_inicio;f.elements.data_fim.value=s.data_fim||'';f.elements.ativo.checked=s.ativo;$('#cancelSchedule').classList.remove('hidden');f.scrollIntoView({behavior:'smooth'})}
    else if(b.dataset.toggleSchedule){const {error}=await sb.from('cronogramas').update({ativo:!s.ativo}).eq('id',s.id);if(error)return notice('Não foi possível alterar o cronograma.','error');notice(s.ativo?'Cronograma ocultado.':'Cronograma publicado.');await refresh()}
    else if(b.dataset.deleteSchedule){if(!confirm(`Excluir o cronograma “${s.titulo}” e todas as atividades vinculadas a ele?`))return;const {error}=await sb.from('cronogramas').delete().eq('id',s.id);if(error)return notice('Não foi possível excluir o cronograma.','error');notice('Cronograma excluído.');await refresh()}
  });
}
function bindActivities(){
  $('#activityDiscipline')?.addEventListener('change',fillActivityTopics);$('#activityFilterDate')?.addEventListener('change',renderActivities);$('#clearActivityFilter')?.addEventListener('click',()=>{$('#activityFilterDate').value='';renderActivities()});
  $('#activityForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,id=f.elements.id.value;const payload={cronograma_id:f.elements.cronograma_id.value?Number(f.elements.cronograma_id.value):null,data:f.elements.data.value,titulo:f.elements.titulo.value.trim(),descricao:f.elements.descricao.value.trim()||null,tipo:f.elements.tipo.value,disciplina_id:f.elements.disciplina_id.value?Number(f.elements.disciplina_id.value):null,assunto_id:f.elements.assunto_id.value?Number(f.elements.assunto_id.value):null,meta_quantidade:f.elements.meta_quantidade.value?Number(f.elements.meta_quantidade.value):null,meta_minutos:f.elements.meta_minutos.value?Number(f.elements.meta_minutos.value):null,ordem:Number(f.elements.ordem.value)||0,ativo:f.elements.ativo.checked};setBusy(f,true);const r=id?await sb.from('atividades').update(payload).eq('id',id):await sb.from('atividades').insert(payload);setBusy(f,false);if(r.error)return notice('Não foi possível salvar a atividade.','error');notice(id?'Atividade atualizada.':'Atividade criada.');resetActivity();await refresh()});
  $('#cancelActivity')?.addEventListener('click',resetActivity);
  $('#activityRows')?.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const id=Number(b.dataset.editActivity||b.dataset.toggleActivity||b.dataset.deleteActivity);const a=activities.find(x=>x.id===id);if(!a)return;
    if(b.dataset.editActivity){const f=$('#activityForm');f.elements.id.value=a.id;f.elements.cronograma_id.value=a.cronograma_id||'';f.elements.data.value=a.data;f.elements.titulo.value=a.titulo;f.elements.descricao.value=a.descricao||'';f.elements.tipo.value=a.tipo;f.elements.disciplina_id.value=a.disciplina_id||'';fillActivityTopics();f.elements.assunto_id.value=a.assunto_id||'';f.elements.meta_quantidade.value=a.meta_quantidade||'';f.elements.meta_minutos.value=a.meta_minutos||'';f.elements.ordem.value=a.ordem||0;f.elements.ativo.checked=a.ativo;$('#cancelActivity').classList.remove('hidden');f.scrollIntoView({behavior:'smooth'})}
    else if(b.dataset.toggleActivity){const {error}=await sb.from('atividades').update({ativo:!a.ativo}).eq('id',a.id);if(error)return notice('Não foi possível alterar a atividade.','error');notice(a.ativo?'Atividade ocultada.':'Atividade publicada.');await refresh()}
    else if(b.dataset.deleteActivity){if(!confirm(`Excluir a atividade “${a.titulo}”?`))return;const {error}=await sb.from('atividades').delete().eq('id',a.id);if(error)return notice('Não foi possível excluir a atividade.','error');notice('Atividade excluída.');await refresh()}
  });
}
export async function setupAdminMissoes(context){ctx=context;bindSchedules();bindActivities();await refresh()}
