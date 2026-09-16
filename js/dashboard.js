import {sb} from './supabase.js';
export async function loadDashboard(ctx){
 const uid=ctx.user.id,today=new Date().toISOString().slice(0,10);
 const [{count:q},{data:resp},{count:fc},{data:acts},{data:nextSim}]=await Promise.all([
  sb.from('respostas').select('*',{count:'exact',head:true}).eq('user_id',uid),
  sb.from('respostas').select('acertou').eq('user_id',uid),
  sb.from('flashcard_revisoes').select('*',{count:'exact',head:true}).eq('user_id',uid),
  sb.from('atividade_progresso').select('concluida,atividades(titulo,tipo)').eq('user_id',uid).eq('data',today),
  sb.from('simulados').select('id,titulo,data_liberacao,duracao_minutos').eq('ativo',true).gte('data_liberacao',new Date().toISOString()).order('data_liberacao').limit(1).maybeSingle()
 ]);
 const acertos=(resp||[]).filter(x=>x.acertou).length,perc=resp?.length?Math.round(acertos/resp.length*100):0;
 document.querySelector('#qCount').textContent=q||0;document.querySelector('#accuracy').textContent=perc+'%';document.querySelector('#fcCount').textContent=fc||0;
 const list=document.querySelector('#todayTasks');
 if(acts?.length){list.innerHTML=acts.map(a=>`<label class="task"><input type="checkbox" ${a.concluida?'checked':''} disabled><span><b>${a.atividades?.titulo||'Atividade'}</b><small>${a.atividades?.tipo||''}</small></span></label>`).join('');const done=acts.filter(a=>a.concluida).length;document.querySelector('.progress i').style.width=Math.round(done/acts.length*100)+'%'}
 else list.innerHTML='<div class="empty compact"><b>Nenhuma atividade programada para hoje.</b><br><span>Quando a administração publicar a missão, ela aparecerá aqui.</span></div>';
 const box=document.querySelector('#nextSimulation');if(box&&nextSim){const dt=new Date(nextSim.data_liberacao);box.innerHTML=`<b>${nextSim.titulo}</b><p class="muted">${dt.toLocaleDateString('pt-BR')} • ${nextSim.duracao_minutos} min</p><a class="btn secondary" href="./simulados.html">VER SIMULADO</a>`}
}
