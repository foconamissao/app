import {sb} from './supabase.js';

const $=s=>document.querySelector(s);
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate=v=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR'):'—';

function uniqueSortedDates(days){return [...new Set((days||[]).filter(Boolean))].sort()}

function bestStreak(days){
  const arr=uniqueSortedDates(days);
  let best=0,run=0,prev=null;
  for(const k of arr){
    const d=new Date(k+'T12:00:00');
    if(prev&&Math.round((d-prev)/86400000)===1)run++;
    else run=1;
    best=Math.max(best,run);
    prev=d;
  }
  return best;
}

function firstStreakDate(days,target){
  const arr=uniqueSortedDates(days);
  let run=0,prev=null;
  for(const k of arr){
    const d=new Date(k+'T12:00:00');
    if(prev&&Math.round((d-prev)/86400000)===1)run++;
    else run=1;
    if(run>=target)return k;
    prev=d;
  }
  return null;
}

function nthEventDate(items,target,dateField){
  if((items||[]).length<target)return null;
  const sorted=[...items].filter(x=>x?.[dateField]).sort((a,b)=>new Date(a[dateField])-new Date(b[dateField]));
  return sorted[target-1]?.[dateField]?iso(new Date(sorted[target-1][dateField])):null;
}

function achievementCard(a){
  const pct=Math.max(0,Math.min(100,Math.round((Number(a.value)||0)/(Number(a.target)||1)*100)));
  const status=a.ok?`<strong class="achievement-status">CONQUISTADA</strong>`:`<strong class="achievement-status">${esc(a.progressText||`${Math.min(a.value,a.target)}/${a.target}`)}</strong>`;
  const when=a.ok&&a.unlockedAt?`<span class="achievement-date">Conquistada em ${fmtDate(a.unlockedAt)}</span>`:'';
  return `<article class="card achievement achievement-v2 ${a.ok?'unlocked':'locked'}" data-category="${esc(a.category)}">
    <div class="achievement-icon">${a.icon}</div>
    <div class="achievement-copy"><div class="achievement-topline"><span class="achievement-category">${esc(a.category)}</span>${status}</div><b>${esc(a.title)}</b><small>${esc(a.desc)}</small>${when}<div class="achievement-progress"><i style="width:${pct}%"></i></div><span class="achievement-progress-text">${a.ok?'Meta concluída':esc(a.progressText||`${Math.min(a.value,a.target)}/${a.target}`)}</span></div>
  </article>`;
}

function perfectMissionDates(activities,progress){
  const completed=new Set((progress||[]).filter(x=>x.concluida).map(x=>Number(x.atividade_id)));
  const byDate=new Map();
  for(const a of activities||[]){
    if(a.ativo===false||a.cronogramas?.ativo===false)continue;
    const date=String(a.data||'').slice(0,10);
    if(!date)continue;
    if(!byDate.has(date))byDate.set(date,[]);
    byDate.get(date).push(Number(a.id));
  }
  return [...byDate.entries()].filter(([,ids])=>ids.length&&ids.every(id=>completed.has(id))).map(([date])=>date).sort();
}

function nextAchievement(list){
  return list.filter(a=>!a.ok).map(a=>({...a,pct:Math.max(0,Math.min(100,(Number(a.value)||0)/(Number(a.target)||1)*100))})).sort((a,b)=>b.pct-a.pct||a.target-b.target)[0]||null;
}

export async function loadProfileStats(ctx){
  const uid=ctx.user.id;
  const [{data:r},{data:f},{data:a},{data:s},{data:e},{data:acts}]=await Promise.all([
    sb.from('respostas').select('acertou,created_at').eq('user_id',uid),
    sb.from('flashcard_revisoes').select('reviewed_at').eq('user_id',uid),
    sb.from('atividade_progresso').select('atividade_id,data,concluida').eq('user_id',uid).eq('concluida',true),
    sb.from('simulado_tentativas').select('pontuacao,status,finalizada_em').eq('user_id',uid).eq('status','finalizada'),
    sb.from('caderno_erros').select('dominado').eq('user_id',uid),
    sb.from('atividades').select('id,data,ativo,cronogramas(ativo)').eq('ativo',true)
  ]);

  const responses=(r||[]).filter(x=>x.created_at);
  const reviews=(f||[]).filter(x=>x.reviewed_at);
  const progress=a||[];
  const simulations=(s||[]).filter(x=>x.finalizada_em);
  const errors=e||[];
  const hits=responses.filter(x=>x.acertou).length;
  const acc=responses.length?Math.round(hits/responses.length*100):0;
  const days=[
    ...responses.map(x=>iso(new Date(x.created_at))),
    ...reviews.map(x=>iso(new Date(x.reviewed_at))),
    ...progress.map(x=>String(x.data).slice(0,10)),
    ...simulations.map(x=>iso(new Date(x.finalizada_em)))
  ];
  const uniqueDays=uniqueSortedDates(days);
  const best=bestStreak(days);
  const joined=ctx.user.created_at?new Date(ctx.user.created_at).toLocaleDateString('pt-BR'):'—';
  const perfectDates=perfectMissionDates(acts||[],progress);
  const firstMissionDate=uniqueSortedDates(progress.map(x=>String(x.data).slice(0,10)))[0]||null;
  const firstSimDate=nthEventDate(simulations,1,'finalizada_em');
  const sim80Item=[...simulations].filter(x=>Number(x.pontuacao)>=80).sort((a,b)=>new Date(a.finalizada_em)-new Date(b.finalizada_em))[0];
  const sim80Date=sim80Item?iso(new Date(sim80Item.finalizada_em)):null;

  $('#profileStats').innerHTML=`<div class="card stat"><span>📅 Na missão desde</span><b>${joined}</b></div><div class="card stat"><span>🔥 Dias estudados</span><b>${uniqueDays.length}</b></div><div class="card stat"><span>📝 Questões</span><b>${responses.length}</b></div><div class="card stat"><span>🎯 Aproveitamento</span><b>${acc}%</b></div><div class="card stat"><span>🏆 Simulados</span><b>${simulations.length}</b></div><div class="card stat"><span>⚡ Melhor sequência</span><b>${best} dias</b></div>`;

  const achievements=[
    {icon:'🎯',category:'Missão',title:'Primeira Missão',desc:'Conclua uma atividade da missão.',value:progress.length,target:1,ok:progress.length>=1,unlockedAt:firstMissionDate},
    {icon:'✅',category:'Missão',title:'Missão Perfeita',desc:'Conclua 100% das atividades publicadas de um mesmo dia.',value:perfectDates.length,target:1,ok:perfectDates.length>=1,unlockedAt:perfectDates[0]||null},
    {icon:'🏅',category:'Missão',title:'5 Missões Perfeitas',desc:'Complete integralmente cinco missões diárias.',value:perfectDates.length,target:5,ok:perfectDates.length>=5,unlockedAt:perfectDates[4]||null},
    {icon:'💯',category:'Questões',title:'100 questões',desc:'Responda 100 questões.',value:responses.length,target:100,ok:responses.length>=100,unlockedAt:nthEventDate(responses,100,'created_at')},
    {icon:'🚀',category:'Questões',title:'500 questões',desc:'Responda 500 questões.',value:responses.length,target:500,ok:responses.length>=500,unlockedAt:nthEventDate(responses,500,'created_at')},
    {icon:'🛡️',category:'Questões',title:'1.000 questões',desc:'Responda 1.000 questões.',value:responses.length,target:1000,ok:responses.length>=1000,unlockedAt:nthEventDate(responses,1000,'created_at')},
    {icon:'🔥',category:'Constância',title:'7 dias seguidos',desc:'Estude por 7 dias consecutivos.',value:best,target:7,ok:best>=7,unlockedAt:firstStreakDate(days,7)},
    {icon:'📆',category:'Constância',title:'30 dias ativos',desc:'Registre estudo em 30 dias diferentes.',value:uniqueDays.length,target:30,ok:uniqueDays.length>=30,unlockedAt:uniqueDays[29]||null},
    {icon:'🏆',category:'Simulados',title:'Primeiro Simulado',desc:'Finalize seu primeiro simulado.',value:simulations.length,target:1,ok:simulations.length>=1,unlockedAt:firstSimDate},
    {icon:'🎖️',category:'Simulados',title:'80%+ no Simulado',desc:'Alcance pelo menos 80% em um simulado.',value:sim80Date?1:0,target:1,ok:!!sim80Date,unlockedAt:sim80Date,progressText:sim80Date?'80%+':'0/1'},
    {icon:'🏁',category:'Simulados',title:'10 Simulados',desc:'Finalize dez simulados oficiais.',value:simulations.length,target:10,ok:simulations.length>=10,unlockedAt:nthEventDate(simulations,10,'finalizada_em')},
    {icon:'🧠',category:'Revisão',title:'100 Revisões',desc:'Revise 100 flashcards.',value:reviews.length,target:100,ok:reviews.length>=100,unlockedAt:nthEventDate(reviews,100,'reviewed_at')},
    {icon:'📚',category:'Revisão',title:'500 Revisões',desc:'Revise 500 flashcards.',value:reviews.length,target:500,ok:reviews.length>=500,unlockedAt:nthEventDate(reviews,500,'reviewed_at')},
    {icon:'🔁',category:'Recuperação',title:'Recuperação de Assunto',desc:'Transforme um erro recorrente em conteúdo dominado.',value:errors.filter(x=>x.dominado).length,target:1,ok:errors.some(x=>x.dominado),unlockedAt:null}
  ];

  const unlocked=achievements.filter(x=>x.ok).length;
  const overallPct=Math.round(unlocked/achievements.length*100);
  const next=nextAchievement(achievements);
  const nextPct=next?Math.round(Math.min(100,(Number(next.value)||0)/(Number(next.target)||1)*100)):100;
  const summary=$('#achievementSummary');
  if(summary){
    summary.innerHTML=`<div class="card achievement-summary-card"><div><span class="muted">Conquistas liberadas</span><b>${unlocked} de ${achievements.length}</b><div class="achievement-overall-progress"><i style="width:${overallPct}%"></i></div><small>${overallPct}% dos marcos concluídos</small></div><div class="achievement-next"><span class="muted">Próxima conquista</span><b>${next?`${next.icon} ${esc(next.title)}`:'🏆 Todas concluídas'}</b><small>${next?`${esc(next.progressText||`${Math.min(next.value,next.target)}/${next.target}`)} · ${nextPct}% concluído`:'Você concluiu todos os marcos disponíveis.'}</small></div></div>`;
  }

  const order=['Missão','Questões','Constância','Simulados','Revisão','Recuperação'];
  $('#achievementGrid').innerHTML=order.map(category=>{
    const group=achievements.filter(x=>x.category===category);
    if(!group.length)return '';
    const groupUnlocked=group.filter(x=>x.ok).length;
    return `<section class="achievement-group"><div class="achievement-group-head"><h3>${esc(category)}</h3><span>${groupUnlocked}/${group.length}</span></div><div class="achievement-grid-inner">${group.map(achievementCard).join('')}</div></section>`;
  }).join('');
}
