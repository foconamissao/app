import {sb} from './supabase.js';

const $=s=>document.querySelector(s);
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function bestStreak(days){
  const arr=[...new Set(days)].sort();
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

function achievement(icon,title,desc,ok,progress='EM PROGRESSO'){
  return `<div class="card achievement ${ok?'unlocked':'locked'}"><span>${icon}</span><div><b>${esc(title)}</b><small>${esc(desc)}</small></div><strong>${ok?'CONQUISTADA':esc(progress)}</strong></div>`;
}

function clampProgress(value,target){
  const v=Math.max(0,Number(value)||0),t=Math.max(1,Number(target)||1);
  return `${Math.min(v,t)}/${t}`;
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
  return [...byDate.entries()].filter(([,ids])=>ids.length&&ids.every(id=>completed.has(id))).map(([date])=>date);
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

  const responses=r||[];
  const reviews=f||[];
  const progress=a||[];
  const simulations=s||[];
  const errors=e||[];
  const hits=responses.filter(x=>x.acertou).length;
  const acc=responses.length?Math.round(hits/responses.length*100):0;
  const days=[
    ...responses.map(x=>iso(new Date(x.created_at))),
    ...reviews.map(x=>iso(new Date(x.reviewed_at))),
    ...progress.map(x=>String(x.data).slice(0,10)),
    ...simulations.filter(x=>x.finalizada_em).map(x=>iso(new Date(x.finalizada_em)))
  ];
  const unique=new Set(days);
  const best=bestStreak(days);
  const joined=ctx.user.created_at?new Date(ctx.user.created_at).toLocaleDateString('pt-BR'):'—';

  $('#profileStats').innerHTML=`<div class="card stat"><span>📅 Na missão desde</span><b>${joined}</b></div><div class="card stat"><span>🔥 Dias estudados</span><b>${unique.size}</b></div><div class="card stat"><span>📝 Questões</span><b>${responses.length}</b></div><div class="card stat"><span>🎯 Aproveitamento</span><b>${acc}%</b></div><div class="card stat"><span>🏆 Simulados</span><b>${simulations.length}</b></div><div class="card stat"><span>⚡ Melhor sequência</span><b>${best} dias</b></div>`;

  const sim80=simulations.some(x=>Number(x.pontuacao)>=80);
  const perfectDates=perfectMissionDates(acts||[],progress);
  const missionPerfect=perfectDates.length>0;
  const recovered=errors.some(x=>x.dominado);
  const ach=[
    ['🎯','Primeira Missão','Conclua uma atividade da missão.',progress.length>=1,progress.length?'1/1':'0/1'],
    ['💯','100 questões','Responda 100 questões.',responses.length>=100,clampProgress(responses.length,100)],
    ['🚀','500 questões','Responda 500 questões.',responses.length>=500,clampProgress(responses.length,500)],
    ['🛡️','1.000 questões','Responda 1.000 questões.',responses.length>=1000,clampProgress(responses.length,1000)],
    ['🔥','7 dias seguidos','Estude por 7 dias consecutivos.',best>=7,clampProgress(best,7)],
    ['📆','30 dias ativos','Registre estudo em 30 dias diferentes.',unique.size>=30,clampProgress(unique.size,30)],
    ['🏆','Primeiro simulado','Finalize seu primeiro simulado.',simulations.length>=1,simulations.length?'1/1':'0/1'],
    ['🎖️','80%+ no simulado','Alcance pelo menos 80% em um simulado.',sim80,sim80?'80%+':'PENDENTE'],
    ['✅','Missão perfeita','Conclua 100% das atividades publicadas de um mesmo dia.',missionPerfect,missionPerfect?'1/1':'0/1'],
    ['🔁','Recuperação','Transforme um erro recorrente em conteúdo dominado.',recovered,recovered?'1/1':'0/1']
  ];
  $('#achievementGrid').innerHTML=ach.map(x=>achievement(...x)).join('');
}
