import {sb} from './supabase.js';
function localDateISO(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
const typeLabel={teoria:'Teoria',questoes:'Questões',flashcards:'Flashcards',revisao:'Revisão',aula:'Aula',simulado:'Simulado'};
export async function loadDashboard(ctx){
 const uid=ctx.user.id,today=localDateISO();
 const dayStart=new Date();dayStart.setHours(0,0,0,0);const dayEnd=new Date(dayStart);dayEnd.setDate(dayEnd.getDate()+1);
 const [{count:q},{data:resp},{count:fc},{data:activities},{data:progress},{data:nextSim}]=await Promise.all([
  sb.from('respostas').select('*',{count:'exact',head:true}).eq('user_id',uid),
  sb.from('respostas').select('acertou').eq('user_id',uid),
  sb.from('flashcard_revisoes').select('*',{count:'exact',head:true}).eq('user_id',uid).gte('reviewed_at',dayStart.toISOString()).lt('reviewed_at',dayEnd.toISOString()),
  sb.from('atividades').select('id,titulo,tipo,ordem,cronogramas(ativo)').eq('data',today).eq('ativo',true).order('ordem').order('id'),
  sb.from('atividade_progresso').select('atividade_id,concluida').eq('user_id',uid).eq('data',today),
  sb.from('simulados').select('id,titulo,data_liberacao,duracao_minutos').eq('ativo',true).gte('data_liberacao',new Date().toISOString()).order('data_liberacao').limit(1).maybeSingle()
 ]);
 const acertos=(resp||[]).filter(x=>x.acertou).length,perc=resp?.length?Math.round(acertos/resp.length*100):0;
 document.querySelector('#qCount').textContent=q||0;document.querySelector('#accuracy').textContent=perc+'%';document.querySelector('#fcCount').textContent=fc||0;
 const acts=(activities||[]).filter(a=>!a.cronogramas||a.cronogramas.ativo!==false),pmap=new Map((progress||[]).map(p=>[p.atividade_id,p]));
 const list=document.querySelector('#todayTasks');
 if(acts.length){list.innerHTML=acts.map(a=>`<label class="task"><input type="checkbox" ${pmap.get(a.id)?.concluida?'checked':''} disabled><span><b>${a.titulo||'Atividade'}</b><small>${typeLabel[a.tipo]||a.tipo||''}</small></span></label>`).join('');const done=acts.filter(a=>pmap.get(a.id)?.concluida).length;document.querySelector('.progress i').style.width=Math.round(done/acts.length*100)+'%'}
 else{list.innerHTML='<div class="empty compact"><b>Nenhuma atividade programada para hoje.</b><br><span>Quando a administração publicar a missão, ela aparecerá aqui.</span></div>';document.querySelector('.progress i').style.width='0%'}
 const box=document.querySelector('#nextSimulation');if(box&&nextSim){const dt=new Date(nextSim.data_liberacao);box.innerHTML=`<b>${nextSim.titulo}</b><p class="muted">${dt.toLocaleDateString('pt-BR')} • ${nextSim.duracao_minutos} min</p><a class="btn secondary" href="./simulados.html">VER SIMULADO</a>`}
}
