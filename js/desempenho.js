import {sb} from './supabase.js';
const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtInt=n=>new Intl.NumberFormat('pt-BR').format(Number(n)||0);
const pct=(a,b)=>b?Math.round((a/b)*100):0;
const dateKey=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
const humanTime=s=>{s=Number(s)||0;if(s<60)return `${Math.round(s)}s`;const m=Math.floor(s/60),sec=Math.round(s%60);if(m<60)return `${m}min${sec?` ${sec}s`:''}`;const h=Math.floor(m/60),rm=m%60;return `${h}h${rm?` ${rm}min`:''}`};
let ctx,allResponses=[],allReviews=[],allErrors=[];
function notice(msg){const el=$('#performanceNotice');el.textContent=msg;el.classList.remove('hidden')}
function startOfDays(days){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(days-1));return d}
function rangeFor(value){if(value==='all')return {start:null,prevStart:null,prevEnd:null};const days=Number(value);const start=startOfDays(days);const prevEnd=new Date(start);prevEnd.setMilliseconds(-1);const prevStart=new Date(start);prevStart.setDate(prevStart.getDate()-days);return {start,prevStart,prevEnd,days}}
function inRange(row,start,end=null){const d=new Date(row.created_at||row.reviewed_at||row.ultimo_erro);if(start&&d<start)return false;if(end&&d>end)return false;return true}
function deltaText(current,previous,suffix=''){
 if(previous===null||previous===undefined)return '';
 const dif=current-previous;if(Math.abs(dif)<0.001)return 'Sem mudança no período';
 return `${dif>0?'▲':'▼'} ${Math.abs(dif).toFixed(suffix===' p.p.'?1:0).replace('.',',')}${suffix} em relação ao período anterior`;
}
function setStats(responses,reviews,prevResponses,prevReviews){
 const hits=responses.filter(r=>r.acertou).length,accuracy=pct(hits,responses.length),prevHits=prevResponses.filter(r=>r.acertou).length,prevAcc=pct(prevHits,prevResponses.length);
 const totalSec=responses.reduce((s,r)=>s+(Number(r.tempo_segundos)||0),0),avg=responses.length?totalSec/responses.length:0;
 $('#perfQuestions').textContent=fmtInt(responses.length);$('#perfQuestionsDelta').textContent=prevResponses?deltaText(responses.length,prevResponses.length):'';
 $('#perfAccuracy').textContent=`${accuracy}%`;$('#perfAccuracyDelta').textContent=prevResponses?deltaText(accuracy,prevAcc,' p.p.'):'';
 $('#perfTime').textContent=humanTime(totalSec);$('#perfAvgTime').textContent=responses.length?`Média de ${humanTime(avg)} por questão`:'Sem respostas no período';
 $('#perfFlashcards').textContent=fmtInt(reviews.length);const remembered=reviews.filter(r=>Number(r.dificuldade)>=3).length;$('#perfFlashMemory').textContent=reviews.length?`${pct(remembered,reviews.length)}% lembrados/fáceis`:'Sem revisões no período';
}
function renderEvolution(responses,range){
 const days=range==='all'?Math.min(30,Math.max(7,new Set(responses.map(r=>dateKey(r.created_at))).size||7)):Number(range);
 const start=startOfDays(days),data=[];
 for(let i=0;i<days;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=dateKey(d),rows=responses.filter(r=>dateKey(r.created_at)===key),hits=rows.filter(r=>r.acertou).length;data.push({key,label:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),n:rows.length,acc:pct(hits,rows.length)})}
 const max=Math.max(1,...data.map(x=>x.n));const shown=data.length>14?data.filter((_,i)=>i%Math.ceil(data.length/14)===0||i===data.length-1):data;
 $('#evolutionChart').innerHTML=shown.map(x=>`<div class="evolution-col" title="${x.label}: ${x.n} questões · ${x.acc}%"><div class="evolution-value">${x.n||''}</div><div class="evolution-bar"><i style="height:${Math.max(x.n?8:0,(x.n/max)*100)}%"></i></div><small>${x.label}</small></div>`).join('');
 const active=data.filter(x=>x.n).length,total=data.reduce((s,x)=>s+x.n,0);$('#evolutionSummary').textContent=`${active} dia${active===1?'':'s'} ativo${active===1?'':'s'} · ${total} questões`;
}
function groupPerformance(responses,keyFn){const map=new Map();responses.forEach(r=>{const key=keyFn(r);if(!key)return;const x=map.get(key)||{name:key,total:0,hits:0,time:0};x.total++;if(r.acertou)x.hits++;x.time+=Number(r.tempo_segundos)||0;map.set(key,x)});return [...map.values()].map(x=>({...x,accuracy:pct(x.hits,x.total),avg:x.total?x.time/x.total:0}))}
function renderBars(target,items){const box=$(target);if(!items.length){box.innerHTML='<div class="empty compact">Ainda não há dados suficientes neste período.</div>';return}box.innerHTML=items.map(x=>`<div class="performance-bar-row"><div class="performance-bar-label"><span>${esc(x.name)}</span><b>${x.accuracy}%</b></div><div class="performance-bar-track"><i style="width:${x.accuracy}%"></i></div><small>${x.total} quest${x.total===1?'ão':'ões'} · ${x.hits} acerto${x.hits===1?'':'s'}</small></div>`).join('')}
function renderDisciplines(responses){const items=groupPerformance(responses,r=>r.questoes?.disciplinas?.nome||'Sem disciplina').sort((a,b)=>b.total-a.total);renderBars('#disciplinePerformance',items)}
function difficultyName(v){v=Number(v)||3;return v<=2?'Básica':v===3?'Intermediária':'Avançada'}
function renderDifficulty(responses){const order={Básica:1,Intermediária:2,Avançada:3};const items=groupPerformance(responses,r=>difficultyName(r.questoes?.dificuldade)).sort((a,b)=>order[a.name]-order[b.name]);renderBars('#difficultyPerformance',items)}
function topicGroups(responses){const map=new Map();responses.forEach(r=>{const d=r.questoes?.disciplinas?.nome||'Sem disciplina',a=r.questoes?.assuntos?.nome||'Sem assunto',key=`${d}|||${a}`;const x=map.get(key)||{disc:d,topic:a,total:0,hits:0,time:0};x.total++;if(r.acertou)x.hits++;x.time+=Number(r.tempo_segundos)||0;map.set(key,x)});return [...map.values()].map(x=>({...x,accuracy:pct(x.hits,x.total),avg:x.total?x.time/x.total:0}))}
function renderTopics(responses){const rows=topicGroups(responses).sort((a,b)=>b.total-a.total||a.accuracy-b.accuracy);$('#topicPerformance').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.disc)}</td><td><b>${esc(x.topic)}</b></td><td>${x.total}</td><td>${x.hits}</td><td><span class="badge ${x.accuracy>=80?'ok':x.accuracy<60?'off':'wait'}">${x.accuracy}%</span></td><td>${humanTime(x.avg)}</td></tr>`).join(''):'<tr><td colspan="6"><div class="empty compact">Sem dados neste período.</div></td></tr>';return rows}
function renderInsights(rows){const strong=rows.filter(x=>x.total>=3&&x.accuracy>=80).sort((a,b)=>b.accuracy-a.accuracy||b.total-a.total).slice(0,6);const weak=rows.filter(x=>x.total>=2&&x.accuracy<70).sort((a,b)=>a.accuracy-b.accuracy||b.total-a.total).slice(0,6);const make=list=>list.length?list.map(x=>`<div class="insight-item"><div><b>${esc(x.topic)}</b><small>${esc(x.disc)} · ${x.total} questões</small></div><span class="badge ${x.accuracy>=80?'ok':'off'}">${x.accuracy}%</span></div>`).join(''):'<div class="empty compact">Ainda não há dados suficientes.</div>';$('#strongPoints').innerHTML=make(strong);$('#weakPoints').innerHTML=make(weak)}
function renderFlash(reviews){const labels={1:'Não lembrei',2:'Difícil',3:'Lembrei',4:'Fácil'},counts=[1,2,3,4].map(k=>({name:labels[k],n:reviews.filter(r=>Number(r.dificuldade)===k).length}));const total=reviews.length;$('#flashSummary').innerHTML=total?counts.map(x=>`<div class="summary-line"><span>${x.name}</span><b>${x.n}</b><small>${pct(x.n,total)}%</small></div>`).join(''):'<div class="empty compact">Nenhuma revisão no período.</div>'}
function renderErrors(errors,range){const start=range.start;const relevant=errors.filter(e=>!start||new Date(e.ultimo_erro)>=start).sort((a,b)=>(Number(b.erros)||0)-(Number(a.erros)||0)).slice(0,8);$('#recurringErrors').innerHTML=relevant.length?relevant.map(e=>`<article class="recurring-error-item"><div><span class="badge danger">${Number(e.erros)||1} erro${Number(e.erros)===1?'':'s'}</span><b>${esc(e.questoes?.enunciado||'Questão')}</b><small>${esc(e.questoes?.disciplinas?.nome||'')} ${e.questoes?.assuntos?.nome?`· ${esc(e.questoes.assuntos.nome)}`:''}</small></div><a class="btn secondary compact" href="./questoes.html?refazer=${e.questao_id}">REFAZER</a></article>`).join(''):'<div class="empty compact">Nenhum erro recorrente neste período.</div>'}
function render(){const value=$('#performancePeriod').value,range=rangeFor(value),responses=allResponses.filter(r=>inRange(r,range.start)),reviews=allReviews.filter(r=>inRange(r,range.start));let prevResponses=[],prevReviews=[];if(range.prevStart){prevResponses=allResponses.filter(r=>inRange(r,range.prevStart,range.prevEnd));prevReviews=allReviews.filter(r=>inRange(r,range.prevStart,range.prevEnd))}else{prevResponses=null;prevReviews=null}setStats(responses,reviews,prevResponses,prevReviews);renderEvolution(responses,value);renderDisciplines(responses);renderDifficulty(responses);const topics=renderTopics(responses);renderInsights(topics);renderFlash(reviews);renderErrors(allErrors,range)}
async function load(){const uid=ctx.user.id;const [{data:r,error:re},{data:f,error:fe},{data:e,error:ee}]=await Promise.all([
 sb.from('respostas').select('id,questao_id,acertou,tempo_segundos,created_at,questoes(id,dificuldade,disciplinas(nome),assuntos(nome))').eq('user_id',uid).order('created_at'),
 sb.from('flashcard_revisoes').select('id,flashcard_id,dificuldade,reviewed_at,proxima_revisao').eq('user_id',uid).order('reviewed_at'),
 sb.from('caderno_erros').select('questao_id,erros,dominado,ultimo_erro,questoes(enunciado,disciplinas(nome),assuntos(nome))').eq('user_id',uid).order('erros',{ascending:false})
 ]);if(re||fe||ee){console.error(re||fe||ee);notice('Não foi possível carregar seus dados de desempenho. Tente novamente.');return}allResponses=r||[];allReviews=f||[];allErrors=e||[];render()}
export async function setupDesempenho(context){ctx=context;$('#performancePeriod').addEventListener('change',render);await load()}
