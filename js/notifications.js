import {sb} from './supabase.js';

const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const dateISO=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

async function pendingFlashcards(uid){
  const today=dateISO();
  const [{data:cards},{data:revs}]=await Promise.all([
    sb.from('flashcards').select('id').eq('ativo',true),
    sb.from('flashcard_revisoes').select('flashcard_id,proxima_revisao,reviewed_at').eq('user_id',uid).order('reviewed_at',{ascending:false})
  ]);
  const latest=new Map();
  for(const r of (revs||[])) if(!latest.has(Number(r.flashcard_id))) latest.set(Number(r.flashcard_id),r);
  return (cards||[]).filter(c=>{const r=latest.get(Number(c.id));return !r||!r.proxima_revisao||r.proxima_revisao<=today}).length;
}

export async function getNotifications(ctx){
  const uid=ctx.user.id, now=new Date(), today=dateISO(now);
  const {data:uo}=await sb.from('usuario_objetivo').select('objetivo_id').eq('user_id',uid).maybeSingle();
  const objectiveId=uo?.objetivo_id?Number(uo.objetivo_id):null;
  const [{data:avisos},{data:leituras},{data:acts},{data:prog},{data:sims},{data:attempts},fcDue]=await Promise.all([
    sb.from('avisos').select('*').eq('ativo',true).lte('inicio_em',now.toISOString()).or(`fim_em.is.null,fim_em.gte.${now.toISOString()}`).order('destaque',{ascending:false}).order('created_at',{ascending:false}),
    sb.from('aviso_leituras').select('aviso_id').eq('user_id',uid),
    sb.from('atividades').select('id,titulo,tipo,cronogramas(ativo,objetivo_id)').eq('data',today).eq('ativo',true),
    sb.from('atividade_progresso').select('atividade_id,concluida').eq('user_id',uid).eq('data',today),
    sb.from('simulados').select('id,titulo,data_liberacao,data_encerramento,tentativas_multiplas').eq('ativo',true).order('data_liberacao',{ascending:false}),
    sb.from('simulado_tentativas').select('id,simulado_id,status').eq('user_id',uid).order('iniciada_em',{ascending:false}),
    pendingFlashcards(uid)
  ]);
  const read=new Set((leituras||[]).map(x=>Number(x.aviso_id)));
  const items=[];
  for(const a of (avisos||[])) items.push({kind:'aviso',id:Number(a.id),title:a.titulo,text:a.mensagem,href:null,highlight:!!a.destaque,unread:!read.has(Number(a.id))});
  const validActs=objectiveId?(acts||[]).filter(a=>a.cronogramas?.ativo!==false&&Number(a.cronogramas?.objetivo_id)===objectiveId):[];
  const done=new Set((prog||[]).filter(p=>p.concluida).map(p=>Number(p.atividade_id)));
  const pendingActs=validActs.filter(a=>!done.has(Number(a.id)));
  if(pendingActs.length)items.push({kind:'auto',title:'Missão do dia pendente',text:`Você ainda tem ${pendingActs.length} atividade${pendingActs.length===1?'':'s'} para concluir hoje.`,href:'./missao.html',unread:true});
  if(fcDue>0)items.push({kind:'auto',title:'Revisão disponível',text:`${fcDue} flashcard${fcDue===1?' está':'s estão'} esperando revisão.`,href:'./flashcards.html',unread:true});
  const ats=attempts||[];
  const running=ats.find(a=>a.status==='em_andamento');
  if(running){const s=(sims||[]).find(x=>Number(x.id)===Number(running.simulado_id));items.push({kind:'auto',title:'Simulado em andamento',text:s?.titulo||'Você tem uma prova em andamento.',href:`./simulados.html?tentativa=${running.id}`,unread:true});}
  else{
    const available=(sims||[]).find(s=>{
      const start=s.data_liberacao?new Date(s.data_liberacao):new Date(0),end=s.data_encerramento?new Date(s.data_encerramento):null;
      if(start>now||(end&&end<now))return false;
      const doneFor=ats.some(a=>Number(a.simulado_id)===Number(s.id)&&a.status==='finalizada');
      return s.tentativas_multiplas||!doneFor;
    });
    if(available)items.push({kind:'auto',title:'Simulado disponível',text:available.titulo,href:'./simulados.html',unread:true});
  }
  return items;
}

async function markAdminRead(ctx,items){
  const unread=items.filter(x=>x.kind==='aviso'&&x.unread);
  if(!unread.length)return;
  await sb.from('aviso_leituras').upsert(unread.map(x=>({user_id:ctx.user.id,aviso_id:x.id,lido_em:new Date().toISOString()})),{onConflict:'user_id,aviso_id'});
  unread.forEach(x=>x.unread=false);
}

export async function mountNotifications(ctx,container){
  const wrap=document.createElement('div');
  wrap.className='notif-wrap';
  wrap.innerHTML='<button class="notif-bell" type="button" aria-label="Notificações" aria-expanded="false">🔔<span class="notif-count hidden"></span></button><div class="notif-panel hidden"><div class="notif-head"><b>Notificações</b><span>Foco na Missão</span></div><div class="notif-list"><div class="empty compact">Carregando…</div></div></div>';
  container.prepend(wrap);
  const bell=wrap.querySelector('.notif-bell'),panel=wrap.querySelector('.notif-panel'),list=wrap.querySelector('.notif-list'),count=wrap.querySelector('.notif-count');
  let items=[];
  const render=()=>{
    const n=items.filter(x=>x.unread).length;
    count.textContent=n>9?'9+':String(n);count.classList.toggle('hidden',!n);
    list.innerHTML=items.length?items.map(x=>`${x.href?`<a href="${x.href}"`:'<div'} class="notif-item ${x.highlight?'highlight':''} ${x.unread?'unread':''}"><b>${esc(x.title)}</b><span>${esc(x.text||'')}</span>${x.href?'</a>':'</div>'}`).join(''):'<div class="empty compact">Tudo em dia por aqui.</div>';
  };
  try{items=await getNotifications(ctx);render();}catch(e){console.error(e);list.innerHTML='<div class="empty compact">Não foi possível carregar as notificações.</div>';}
  bell.addEventListener('click',async()=>{
    const opening=panel.classList.contains('hidden');panel.classList.toggle('hidden');bell.setAttribute('aria-expanded',String(opening));
    if(opening){await markAdminRead(ctx,items);render();}
  });
  document.addEventListener('click',e=>{if(!wrap.contains(e.target)){panel.classList.add('hidden');bell.setAttribute('aria-expanded','false')}});
}
