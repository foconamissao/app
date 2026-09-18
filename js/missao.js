import {sb} from './supabase.js';

const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate=d=>new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${d}T12:00:00`));
const typeLabel={teoria:'Teoria',questoes:'Questões',flashcards:'Flashcards',revisao:'Revisão',aula:'Aula',simulado:'Simulado'};
const typeIcon={teoria:'📖',questoes:'📝',flashcards:'🧠',revisao:'🔁',aula:'🎥',simulado:'🏆'};
let ctx,currentDate,currentObjectiveId=null;

function localDateISO(date=new Date()){
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function metaText(a){
  const bits=[];
  if(a.disciplinas?.nome)bits.push(a.disciplinas.nome);
  if(a.assuntos?.nome)bits.push(a.assuntos.nome);
  if(a.meta_quantidade)bits.push(`Meta: ${a.meta_quantidade}`);
  if(a.meta_minutos)bits.push(`Tempo: ${a.meta_minutos} min`);
  return bits.join(' · ');
}
async function fetchDay(date){
  const [{data:acts,error:ae},{data:prog,error:pe}]=await Promise.all([
    sb.from('atividades').select('id,data,titulo,descricao,tipo,disciplina_id,assunto_id,meta_quantidade,meta_minutos,ordem,disciplinas(nome),assuntos(nome),cronogramas(titulo,ativo,objetivo_id)').eq('data',date).eq('ativo',true).order('ordem').order('id'),
    sb.from('atividade_progresso').select('atividade_id,concluida,concluida_em').eq('user_id',ctx.user.id).eq('data',date)
  ]);
  if(ae||pe)throw ae||pe;
  const visible=currentObjectiveId?(acts||[]).filter(a=>a.cronogramas?.ativo!==false&&Number(a.cronogramas?.objetivo_id)===Number(currentObjectiveId)):[];
  const pmap=new Map((prog||[]).map(p=>[p.atividade_id,p]));
  return visible.map(a=>({...a,progress:pmap.get(a.id)||null}));
}
function actionLink(a){
  if(a.tipo==='teoria')return {href:`./teoria.html?disciplina=${a.disciplina_id||''}${a.assunto_id?'&assunto='+a.assunto_id:''}`,label:'📚 ABRIR RESUMO'};
  if(a.tipo==='questoes'){
    const p=new URLSearchParams();
    p.set('quantidade',String(a.meta_quantidade||50));
    if(a.disciplina_id)p.set('disciplina',String(a.disciplina_id));
    if(a.assunto_id)p.set('assunto',String(a.assunto_id));
    return {href:`./questoes.html?${p.toString()}`,label:'📝 ABRIR QUESTÕES'};
  }
  if(a.tipo==='simulado')return {href:'./simulados.html',label:'🏆 ABRIR SIMULADOS'};
  if(a.tipo==='flashcards')return {href:'./flashcards.html',label:'🧠 ABRIR FLASHCARDS'};
  if(a.tipo==='revisao')return {href:'./revisao.html',label:'🔁 ABRIR REVISÃO'};
  return null;
}
function render(items){
  $('#missionDateLabel').textContent=fmtDate(currentDate);
  const list=$('#missionList');
  if(!items.length){list.innerHTML=currentObjectiveId?'<div class="empty"><b>Nenhuma atividade publicada para esta data neste objetivo.</b><br><span>Use as setas para consultar outro dia.</span></div>':'<div class="empty"><b>Nenhum objetivo selecionado.</b><br><span>Escolha um edital em Meu objetivo para receber a missão correspondente.</span></div>';$('#missionProgressText').textContent='0 de 0 concluídas';$('#missionProgressBar').style.width='0%';return;}
  const done=items.filter(x=>x.progress?.concluida).length;
  $('#missionProgressText').textContent=`${done} de ${items.length} concluída${items.length===1?'':'s'}`;
  $('#missionProgressBar').style.width=`${Math.round(done/items.length*100)}%`;
  list.innerHTML=items.map(a=>{const action=actionLink(a);return `<div class="mission-item-wrap"><label class="mission-item ${a.progress?.concluida?'done':''}">
    <input type="checkbox" data-activity="${a.id}" ${a.progress?.concluida?'checked':''}>
    <span class="mission-type">${typeIcon[a.tipo]||'🎯'}</span>
    <span class="mission-copy"><b>${esc(a.titulo)}</b><small>${esc(typeLabel[a.tipo]||a.tipo)}${metaText(a)?' · '+esc(metaText(a)):''}</small>${a.descricao?`<span>${esc(a.descricao)}</span>`:''}</span>
  </label>${action?`<a class="mini theory-mission-link" href="${action.href}">${action.label}</a>`:''}</div>`}).join('');
}
async function load(){
  const list=$('#missionList');list.innerHTML='<div class="empty">Carregando…</div>';
  try{render(await fetchDay(currentDate))}catch(e){list.innerHTML='<div class="empty">Não foi possível carregar a missão.</div>'}
}
async function toggleActivity(input){
  const atividade_id=Number(input.dataset.activity),concluida=input.checked;
  input.disabled=true;
  const payload={user_id:ctx.user.id,atividade_id,data:currentDate,concluida,concluida_em:concluida?new Date().toISOString():null};
  const {error}=await sb.from('atividade_progresso').upsert(payload,{onConflict:'user_id,atividade_id'});
  input.disabled=false;
  if(error){input.checked=!concluida;alert('Não foi possível atualizar esta atividade.');return;}
  await load();
}
export async function setupMissao(context){
  ctx=context;currentDate=localDateISO();
  const {data:uo}=await sb.from('usuario_objetivo').select('objetivo_id').eq('user_id',ctx.user.id).maybeSingle();
  currentObjectiveId=uo?.objetivo_id?Number(uo.objetivo_id):null;
  $('#missionDate').value=currentDate;
  $('#missionDate').addEventListener('change',e=>{currentDate=e.target.value||localDateISO();load()});
  $('#prevDay').addEventListener('click',()=>{const d=new Date(`${currentDate}T12:00:00`);d.setDate(d.getDate()-1);currentDate=localDateISO(d);$('#missionDate').value=currentDate;load()});
  $('#nextDay').addEventListener('click',()=>{const d=new Date(`${currentDate}T12:00:00`);d.setDate(d.getDate()+1);currentDate=localDateISO(d);$('#missionDate').value=currentDate;load()});
  $('#todayMission').addEventListener('click',()=>{currentDate=localDateISO();$('#missionDate').value=currentDate;load()});
  $('#missionList').addEventListener('change',e=>{if(e.target.matches('[data-activity]'))toggleActivity(e.target)});
  await load();
}
