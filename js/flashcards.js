import {sb} from './supabase.js';
import {priorityScore, weightedSample} from './priority.js';

const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const todayISO=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays=(iso,days)=>{const [y,m,d]=iso.split('-').map(Number);const dt=new Date(y,m-1,d);dt.setDate(dt.getDate()+days);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`};

let ctx, cards=[], reviews=[], latest=new Map(), historyByCard=new Map(), queue=[], pos=0, revealed=false, sessionStats={total:0,ratings:[0,0,0,0]}, requeued=new Map();
let disciplines=[],topics=[];

function notice(msg,type='success'){
 const el=$('#flashNotice'); if(!el)return;
 el.textContent=msg; el.className=`notice ${type}`;
 clearTimeout(notice.t); notice.t=setTimeout(()=>el.classList.add('hidden'),4200);
}
function indexReviews(){
 latest=new Map(); historyByCard=new Map();
 [...reviews].sort((a,b)=>new Date(a.reviewed_at)-new Date(b.reviewed_at)).forEach(r=>{
   latest.set(Number(r.flashcard_id),r);
   if(!historyByCard.has(Number(r.flashcard_id)))historyByCard.set(Number(r.flashcard_id),[]);
   historyByCard.get(Number(r.flashcard_id)).push(r);
 });
}
function maxPeso(){return Math.max(1,...cards.map(c=>Number(c.disciplinas?.peso||1)))}
function scoreCard(c){
 const base=priorityScore(c,maxPeso());
 const hist=historyByCard.get(Number(c.id))||[];
 const recent=hist.slice(-6);
 const hard=recent.filter(r=>Number(r.dificuldade)<=2).length;
 const personal=recent.length?hard/recent.length:0;
 return Math.min(5,Number((base+(personal*.65)).toFixed(2)));
}
function isDue(c){const r=latest.get(Number(c.id));return !r||!r.proxima_revisao||r.proxima_revisao<=todayISO()}
function isNew(c){return !latest.has(Number(c.id))}
function sourceLabel(c){return c.user_id?'Pessoal':'Oficial'}
function filteredCards(){
 const did=Number($('#flashDiscipline')?.value||0),tid=Number($('#flashTopic')?.value||0),source=$('#flashSource')?.value||'todos';
 return cards.filter(c=>(!did||Number(c.disciplina_id)===did)&&(!tid||Number(c.assunto_id)===tid)&&(source==='todos'||(source==='pessoal'&&c.user_id)||(source==='oficial'&&!c.user_id)));
}
function fillFilters(){
 const dsel=$('#flashDiscipline'),tsel=$('#flashTopic'); if(!dsel||!tsel)return;
 const curD=dsel.value,curT=tsel.value;
 dsel.innerHTML='<option value="">Todas</option>'+disciplines.map(d=>`<option value="${d.id}">${esc(d.nome)}</option>`).join('');
 if(disciplines.some(d=>String(d.id)===curD))dsel.value=curD;
 const did=Number(dsel.value||0);
 tsel.innerHTML='<option value="">Todos</option>'+topics.filter(t=>!did||Number(t.disciplina_id)===did).map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('');
 if(topics.some(t=>String(t.id)===curT))tsel.value=curT;
}
function renderStats(){
 const list=filteredCards(),due=list.filter(isDue),novos=due.filter(isNew),today=todayISO();
 const reviewedToday=reviews.filter(r=>todayISO(new Date(r.reviewed_at))===today).length;
 const personalCount=list.filter(c=>c.user_id).length;
 $('#flashDueCount').textContent=due.length; $('#flashNewCount').textContent=novos.length; $('#flashTodayCount').textContent=reviewedToday; $('#flashPersonalCount').textContent=personalCount;
 const days=[...new Set(reviews.map(r=>todayISO(new Date(r.reviewed_at))))].sort().reverse();
 let streak=0,cursor=new Date();cursor.setHours(12,0,0,0);if(!days.includes(todayISO(cursor))){cursor.setDate(cursor.getDate()-1)}
 while(days.includes(todayISO(cursor))){streak++;cursor.setDate(cursor.getDate()-1)}
 $('#flashStreak').textContent=`${streak} dia${streak===1?'':'s'}`;
 const byDisc={}; due.forEach(c=>{const n=c.disciplinas?.nome||'Sem disciplina';byDisc[n]=(byDisc[n]||0)+1});
 const box=$('#flashByDiscipline');
 const entries=Object.entries(byDisc).sort((a,b)=>b[1]-a[1]);
 box.innerHTML=entries.length?entries.map(([n,v])=>`<div class="flash-discipline-row"><span>${esc(n)}</span><b>${v}</b></div>`).join(''):'<div class="empty compact">Nenhum flashcard pendente com estes filtros.</div>';
}
function renderPersonal(){
 const box=$('#personalFlashcards'); if(!box)return;
 const list=cards.filter(c=>c.user_id===ctx.user.id);
 box.innerHTML=list.length?list.map(c=>`<article class="personal-card card" data-id="${c.id}"><div><span class="badge">${esc(c.disciplinas?.nome||'')}</span><h4>${esc(c.frente)}</h4><p class="muted">${esc(c.verso)}</p></div><div class="actions"><button class="mini" data-edit-personal="${c.id}">Editar</button><button class="mini danger-mini" data-delete-personal="${c.id}">Excluir</button></div></article>`).join(''):'<div class="empty compact">Você ainda não criou flashcards pessoais.</div>';
}
function renderHistory(){
 const box=$('#flashHistory'); if(!box)return;
 const map=Object.fromEntries(cards.map(c=>[c.id,c]));
 const labels={1:'Não lembrei',2:'Difícil',3:'Lembrei',4:'Fácil'};
 const recent=[...reviews].sort((a,b)=>new Date(b.reviewed_at)-new Date(a.reviewed_at)).slice(0,20);
 box.innerHTML=recent.length?recent.map(r=>{const c=map[r.flashcard_id];return `<div class="history-row"><div><b>${esc(c?.frente||'Flashcard')}</b><small>${new Date(r.reviewed_at).toLocaleString('pt-BR')} · ${esc(labels[r.dificuldade]||'Revisado')}</small></div><span class="badge">Próxima: ${r.proxima_revisao?new Date(r.proxima_revisao+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</span></div>`}).join(''):'<div class="empty compact">Nenhuma revisão registrada ainda.</div>';
}
function nextInterval(card,rating){
 const prev=latest.get(Number(card.id));
 const prevInt=Number(prev?.intervalo_dias||0),prevSeq=Number(prev?.sequencia||0);
 let interval=0,seq=prevSeq;
 if(rating===1){interval=0;seq=0}
 if(rating===2){interval=1;seq=Math.max(0,prevSeq)}
 if(rating===3){interval=prevInt>0?Math.max(2,Math.round(prevInt*1.8)):3;seq=prevSeq+1}
 if(rating===4){interval=prevInt>0?Math.max(4,Math.round(prevInt*2.5)):7;seq=prevSeq+1}
 if(interval>0){
   const s=scoreCard(card),hist=(historyByCard.get(Number(card.id))||[]).slice(-6),hard=hist.filter(r=>Number(r.dificuldade)<=2).length;
   let factor=1.30-(s*.10); if(hist.length&&hard/hist.length>=.5)factor*=.85;
   interval=Math.max(rating===2?1:rating===3?2:4,Math.round(interval*factor));
 }
 return {interval,seq,score:scoreCard(card),next:addDays(todayISO(),interval)};
}
function renderReview(){
 const area=$('#reviewArea'),setup=$('#flashSetup'),result=$('#flashResult');
 setup.classList.add('hidden'); result.classList.add('hidden'); area.classList.remove('hidden');
 if(pos>=queue.length)return finishSession();
 const c=queue[pos],s=scoreCard(c); revealed=false;
 $('#reviewCounter').textContent=`${pos+1} / ${queue.length}`; $('#reviewBar').style.width=`${Math.round((pos/Math.max(1,queue.length))*100)}%`;
 $('#reviewMeta').innerHTML=`<span class="badge">${esc(c.disciplinas?.nome||'')}</span>${c.assuntos?.nome?`<span class="badge">${esc(c.assuntos.nome)}</span>`:''}<span class="badge">${sourceLabel(c)}</span>`;
 $('#flashFront').textContent=c.frente; $('#flashBack').innerHTML=`<div class="flash-answer-label">RESPOSTA</div><div>${esc(c.verso).replace(/\n/g,'<br>')}</div>`; $('#flashBack').classList.add('hidden'); $('#showAnswer').classList.remove('hidden'); $('#ratingButtons').classList.add('hidden');
}
async function rate(rating){
 const c=queue[pos],calc=nextInterval(c,rating),buttons=$('#ratingButtons'); buttons.querySelectorAll('button').forEach(b=>b.disabled=true);
 const payload={user_id:ctx.user.id,flashcard_id:c.id,dificuldade:rating,proxima_revisao:calc.next,intervalo_dias:calc.interval,sequencia:calc.seq};
 const {data,error}=await sb.from('flashcard_revisoes').insert(payload).select().single();
 buttons.querySelectorAll('button').forEach(b=>b.disabled=false);
 if(error){notice('Não foi possível registrar a revisão. Tente novamente.','error');return}
 reviews.push(data); indexReviews(); sessionStats.total++; sessionStats.ratings[rating-1]++; await syncFlashMission();
 if(rating===1){const n=(requeued.get(c.id)||0)+1;requeued.set(c.id,n);if(n<=1)queue.push(c)}
 pos++;renderReview();
}

async function syncFlashMission(){
 const today=todayISO();
 const reviewedToday=reviews.filter(r=>todayISO(new Date(r.reviewed_at))===today).length;
 const {data:acts}=await sb.from('atividades').select('id,meta_quantidade,cronogramas(ativo)').eq('data',today).eq('tipo','flashcards').eq('ativo',true);
 for(const a of (acts||[]).filter(x=>!x.cronogramas||x.cronogramas.ativo!==false)){
   const target=Number(a.meta_quantidade||0); if(!target||reviewedToday<target)continue;
   await sb.from('atividade_progresso').upsert({user_id:ctx.user.id,atividade_id:a.id,data:today,concluida:true,concluida_em:new Date().toISOString()},{onConflict:'user_id,atividade_id'});
 }
}

function finishSession(){
 $('#reviewArea').classList.add('hidden'); $('#flashResult').classList.remove('hidden'); $('#reviewBar').style.width='100%';
 const [n,d,l,f]=sessionStats.ratings;
 $('#resultReviewed').textContent=sessionStats.total; $('#resultForgot').textContent=n; $('#resultHard').textContent=d; $('#resultRemember').textContent=l; $('#resultEasy').textContent=f;
 renderStats();renderHistory();
}
function startSession(){
 let due=filteredCards().filter(isDue); if(!due.length)return notice('Não há flashcards pendentes com estes filtros.','error');
 const qty=$('#flashQuantity').value==='todos'?due.length:Number($('#flashQuantity').value||20);
 due=weightedSample(due,Math.min(qty,due.length),c=>Math.max(.15,scoreCard(c))*Math.max(.1,Number(c.disciplinas?.peso)||1));
 queue=due;pos=0;sessionStats={total:0,ratings:[0,0,0,0]};requeued=new Map();renderReview();
}
function openPersonalEditor(card){
 const modal=$('#personalModal'); const form=$('#personalForm'); form.reset(); form.elements.id.value=card?.id||'';form.elements.frente.value=card?.frente||'';form.elements.verso.value=card?.verso||'';modal.classList.remove('hidden');
}
async function savePersonal(e){
 e.preventDefault(); const f=e.currentTarget,id=f.elements.id.value,card=cards.find(c=>Number(c.id)===Number(id)); if(!card)return;
 const payload={frente:f.elements.frente.value.trim(),verso:f.elements.verso.value.trim()}; if(!payload.frente||!payload.verso)return;
 const {error}=await sb.from('flashcards').update(payload).eq('id',id).eq('user_id',ctx.user.id);if(error)return notice('Não foi possível atualizar o flashcard.','error');
 card.frente=payload.frente;card.verso=payload.verso;$('#personalModal').classList.add('hidden');renderPersonal();notice('Flashcard atualizado.');
}
async function load(){
 const uid=ctx.user.id;
 const [{data:c,error:ce},{data:r,error:re},{data:d},{data:t}]=await Promise.all([
   sb.from('flashcards').select('id,disciplina_id,assunto_id,frente,verso,user_id,recorrencia,dificuldade,created_at,disciplinas(id,nome,peso),assuntos(id,nome,recorrencia,dificuldade)').eq('ativo',true).order('created_at'),
   sb.from('flashcard_revisoes').select('id,flashcard_id,dificuldade,proxima_revisao,reviewed_at,intervalo_dias,sequencia').eq('user_id',uid).order('reviewed_at'),
   sb.from('disciplinas').select('id,nome,peso').eq('ativo',true).order('peso',{ascending:false}).order('nome'),
   sb.from('assuntos').select('id,nome,disciplina_id,recorrencia,dificuldade').eq('ativo',true).order('nome')
 ]);
 if(ce||re){$('#flashSetup').innerHTML='<div class="empty">Não foi possível carregar seus flashcards.</div>';return}
 cards=c||[];reviews=r||[];disciplines=d||[];topics=t||[];indexReviews();fillFilters();renderStats();renderPersonal();renderHistory();
}
function bind(){
 $('#flashDiscipline').addEventListener('change',()=>{fillFilters();renderStats()}); $('#flashTopic').addEventListener('change',renderStats); $('#flashSource').addEventListener('change',renderStats);
 $('#startFlashReview').addEventListener('click',startSession); $('#showAnswer').addEventListener('click',()=>{revealed=true;$('#flashBack').classList.remove('hidden');$('#showAnswer').classList.add('hidden');$('#ratingButtons').classList.remove('hidden')});
 $('#ratingButtons').addEventListener('click',e=>{const b=e.target.closest('[data-rating]');if(b&&revealed)rate(Number(b.dataset.rating))});
 $('#newReview').addEventListener('click',()=>{$('#flashResult').classList.add('hidden');$('#flashSetup').classList.remove('hidden');renderStats()});
 $('#personalFlashcards').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-personal]'),del=e.target.closest('[data-delete-personal]');if(edit){openPersonalEditor(cards.find(c=>Number(c.id)===Number(edit.dataset.editPersonal)))}if(del){const c=cards.find(x=>Number(x.id)===Number(del.dataset.deletePersonal));if(!c||!confirm('Excluir este flashcard pessoal?'))return;const {error}=await sb.from('flashcards').delete().eq('id',c.id).eq('user_id',ctx.user.id);if(error)return notice('Não foi possível excluir o flashcard.','error');cards=cards.filter(x=>x.id!==c.id);renderPersonal();renderStats();notice('Flashcard excluído.')}});
 $('#personalForm').addEventListener('submit',savePersonal); $('#closePersonalModal').addEventListener('click',()=>$('#personalModal').classList.add('hidden')); $('#personalModal').addEventListener('click',e=>{if(e.target.id==='personalModal')$('#personalModal').classList.add('hidden')});
}
export async function setupFlashcards(context){ctx=context;bind();await load()}
