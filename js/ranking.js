import {sb} from './supabase.js';
const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export async function loadRanking(){
  const host=$('#rankingList');
  const {data,error}=await sb.from('ranking_atual').select('*').order('xp',{ascending:false}).limit(100);
  if(error){host.innerHTML='<div class="empty">Não foi possível carregar o ranking.</div>';return}
  const rows=data||[];if(!rows.length){host.innerHTML='<div class="empty">O ranking ainda está vazio.</div>';return}
  host.innerHTML=rows.map((r,i)=>`<div class="ranking-row"><span class="ranking-pos">${i+1}</span><span class="ranking-person"><b>${esc(r.nome||'Participante')}</b></span><strong>${Number(r.xp||0).toLocaleString('pt-BR',{maximumFractionDigits:1})} XP</strong></div>`).join('');
}
