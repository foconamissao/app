import {sb} from './supabase.js';
const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const typeLabel={teoria:'Teoria',questoes:'Questões',flashcards:'Flashcards',revisao:'Revisão',aula:'Aula',simulado:'Simulado'};
const typeIcon={teoria:'📖',questoes:'📝',flashcards:'🧠',revisao:'🔁',aula:'🎥',simulado:'🏆'};
const fmt=d=>new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(`${d}T12:00:00`));
let currentObjectiveId=null;
function localDateISO(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
async function loadWeek(offset=0){
  const now=new Date();now.setHours(12,0,0,0);const dow=(now.getDay()+6)%7;now.setDate(now.getDate()-dow+(offset*7));
  const end=new Date(now);end.setDate(end.getDate()+6);const startISO=localDateISO(now),endISO=localDateISO(end);
  $('#weekLabel').textContent=`${fmt(startISO)} — ${fmt(endISO)}`;
  const {data,error}=await sb.from('atividades').select('id,data,titulo,descricao,tipo,disciplina_id,assunto_id,meta_quantidade,meta_minutos,ordem,disciplinas(nome),assuntos(nome),cronogramas(titulo,ativo,objetivo_id)').gte('data',startISO).lte('data',endISO).eq('ativo',true).order('data').order('ordem');
  const host=$('#scheduleList');if(error){host.innerHTML='<div class="empty">Não foi possível carregar o cronograma.</div>';return}
  const rows=currentObjectiveId?(data||[]).filter(a=>a.cronogramas?.ativo!==false&&Number(a.cronogramas?.objetivo_id)===Number(currentObjectiveId)):[];const groups={};rows.forEach(a=>(groups[a.data]??=[]).push(a));
  host.innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()+i);const iso=localDateISO(d),items=groups[iso]||[];return `<section class="schedule-day"><div class="schedule-date"><b>${esc(fmt(iso))}</b><span>${items.length} atividade${items.length===1?'':'s'}</span></div><div class="schedule-items">${items.length?items.map(a=>`<div class="schedule-item"><span class="mission-type">${typeIcon[a.tipo]||'🎯'}</span><span><b>${esc(a.titulo)}</b><small>${esc(typeLabel[a.tipo]||a.tipo)}${a.disciplinas?.nome?' · '+esc(a.disciplinas.nome):''}${a.assuntos?.nome?' · '+esc(a.assuntos.nome):''}</small></span>${a.tipo==='teoria'?`<a class="mini" href="./teoria.html?disciplina=${a.disciplina_id||''}${a.assunto_id?'&assunto='+a.assunto_id:''}">RESUMO</a>`:''}</div>`).join(''):'<span class="muted">Sem atividades publicadas.</span>'}</div></section>`}).join('');
}
export async function setupCronograma(ctx){const {data:uo}=await sb.from('usuario_objetivo').select('objetivo_id').eq('user_id',ctx.user.id).maybeSingle();currentObjectiveId=uo?.objetivo_id?Number(uo.objetivo_id):null;let offset=0;$('#prevWeek').addEventListener('click',()=>loadWeek(--offset));$('#nextWeek').addEventListener('click',()=>loadWeek(++offset));$('#currentWeek').addEventListener('click',()=>{offset=0;loadWeek(0)});await loadWeek(0)}
