import {sb} from './supabase.js';

const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
let simulations=[], existingQuestions=new Set(), parsed=null, selected=new Set();

function notice(msg,type='success'){
  const el=$('#adminNotice'); if(!el)return;
  el.textContent=msg; el.className=`notice ${type}`;
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
  clearTimeout(notice.t); notice.t=setTimeout(()=>el.classList.add('hidden'),5000);
}
function localInput(iso){
  if(!iso)return '';
  const d=new Date(iso); if(Number.isNaN(d.getTime()))return '';
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function toIso(v){return v?new Date(v).toISOString():null}
function statusOf(s){
  if(!s.ativo)return ['Oculto','off'];
  const now=Date.now(),start=s.data_liberacao?new Date(s.data_liberacao).getTime():0,end=s.data_encerramento?new Date(s.data_encerramento).getTime():Infinity;
  if(start&&now<start)return ['Agendado','wait'];
  if(now>end)return ['Encerrado','off'];
  return ['Aberto','ok'];
}
function resetForm(){
  const f=$('#simulationForm'); if(!f)return;
  f.reset(); f.elements.id.value=''; f.elements.duracao_minutos.value=150; f.elements.correcao_modo.value='imediata'; f.elements.ativo.checked=true; f.elements.mostrar_ranking.checked=true; f.elements.tentativas_multiplas.checked=false;
  $('#cancelSimulationEdit')?.classList.add('hidden');
}
async function loadExistingQuestions(){
  const {data}=await sb.from('questoes').select('enunciado').limit(10000);
  existingQuestions=new Set((data||[]).map(x=>norm(x.enunciado)));
}
async function refresh(){
  const [{data:sims,error},{data:links},{data:attempts}]=await Promise.all([
    sb.from('simulados').select('*').order('created_at',{ascending:false}),
    sb.from('simulado_questoes').select('simulado_id'),
    sb.from('simulado_tentativas').select('simulado_id,status')
  ]);
  if(error){notice('Não foi possível carregar os simulados.','error');return}
  const qCount={},aCount={};
  (links||[]).forEach(x=>qCount[x.simulado_id]=(qCount[x.simulado_id]||0)+1);
  (attempts||[]).forEach(x=>{if(x.status==='finalizada')aCount[x.simulado_id]=(aCount[x.simulado_id]||0)+1});
  simulations=(sims||[]).map(s=>({...s,_questions:qCount[s.id]??s.total_questoes??0,_attempts:aCount[s.id]||0}));
  renderList();
}
function renderList(){
  const box=$('#adminSimulationList'); if(!box)return;
  if(!simulations.length){box.innerHTML='<div class="card empty">Nenhum simulado criado.</div>';return}
  box.innerHTML=simulations.map(s=>{
    const [label,cls]=statusOf(s); const release=s.data_liberacao?new Date(s.data_liberacao).toLocaleString('pt-BR'):'Liberação imediata';
    return `<article class="card admin-sim-item ${!s.ativo?'is-inactive':''}">
      <div class="admin-sim-head"><div><div class="sim-badges"><span class="badge ${cls}">${label}</span><span class="badge">${s._questions} questões</span><span class="badge">${s.duracao_minutos} min</span></div><h3>${esc(s.titulo)}</h3><p class="muted">${esc(s.descricao||'Sem descrição')}</p></div><div class="actions"><button class="mini" data-edit-sim="${s.id}">Editar</button><button class="mini" data-toggle-sim="${s.id}">${s.ativo?'Ocultar':'Publicar'}</button><button class="mini danger-mini" data-delete-sim="${s.id}">Excluir</button></div></div>
      <div class="sim-admin-meta"><span>📅 ${esc(release)}</span>${s.data_encerramento?`<span>⏳ até ${new Date(s.data_encerramento).toLocaleString('pt-BR')}</span>`:''}<span>✅ ${s._attempts} conclusão(ões)</span><span>${s.tentativas_multiplas?'↻ Múltiplas tentativas':'① Tentativa única'}</span><span>${s.correcao_modo==='encerramento'?'🔒 Correção após encerramento':'📖 Correção após finalizar'}</span></div>
    </article>`;
  }).join('');
}
function editSimulation(id){
  const s=simulations.find(x=>Number(x.id)===Number(id)); if(!s)return;
  const f=$('#simulationForm');
  f.elements.id.value=s.id; f.elements.titulo.value=s.titulo||''; f.elements.descricao.value=s.descricao||'';
  f.elements.data_liberacao.value=localInput(s.data_liberacao); f.elements.data_encerramento.value=localInput(s.data_encerramento);
  f.elements.duracao_minutos.value=s.duracao_minutos||150; f.elements.correcao_modo.value=s.correcao_modo||'imediata';
  f.elements.tentativas_multiplas.checked=!!s.tentativas_multiplas; f.elements.mostrar_ranking.checked=s.mostrar_ranking!==false; f.elements.ativo.checked=!!s.ativo;
  $('#cancelSimulationEdit').classList.remove('hidden'); f.scrollIntoView({behavior:'smooth',block:'start'});
}
async function saveSimulation(e){
  e.preventDefault(); const f=e.currentTarget,fd=new FormData(f),id=Number(fd.get('id')||0);
  const start=fd.get('data_liberacao'),end=fd.get('data_encerramento');
  if(start&&end&&new Date(end)<=new Date(start))return notice('O encerramento deve ser posterior à liberação.','error');
  if(fd.get('correcao_modo')==='encerramento'&&!end)return notice('Informe o encerramento para liberar a correção somente depois do prazo.','error');
  const payload={titulo:String(fd.get('titulo')||'').trim(),descricao:String(fd.get('descricao')||'').trim()||null,data_liberacao:toIso(start),data_encerramento:toIso(end),duracao_minutos:Number(fd.get('duracao_minutos')||150),tentativas_multiplas:f.elements.tentativas_multiplas.checked,correcao_modo:String(fd.get('correcao_modo')||'imediata'),mostrar_ranking:f.elements.mostrar_ranking.checked,ativo:f.elements.ativo.checked};
  if(!payload.titulo||payload.duracao_minutos<1)return notice('Preencha título e duração corretamente.','error');
  f.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=true);
  const result=id?await sb.from('simulados').update(payload).eq('id',id):await sb.from('simulados').insert({...payload,created_by:(await sb.auth.getUser()).data.user?.id});
  f.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=false);
  if(result.error){console.error(result.error);return notice('Não foi possível salvar o simulado.','error')}
  notice(id?'Simulado atualizado.':'Simulado criado. Você já pode importar as questões.'); resetForm(); await refresh();
}
function validLevel(v){const n=Number(v);return Number.isInteger(n)&&n>=1&&n<=5}
function validateQuestion(q){
  const errs=[]; if(!q||typeof q!=='object')return ['item inválido'];
  if(!String(q.disciplina||'').trim())errs.push('sem disciplina'); if(!String(q.assunto||'').trim())errs.push('sem assunto'); if(!String(q.enunciado||'').trim())errs.push('sem enunciado');
  const a=q.alternativas||{}; ['A','B','C','D'].forEach(k=>{if(!String(a[k]||'').trim())errs.push(`sem alternativa ${k}`)});
  const correta=String(q.correta||'').toUpperCase(); if(!['A','B','C','D','E'].includes(correta)||!String(a[correta]||'').trim())errs.push('gabarito inválido');
  if(q.recorrencia!=null&&!validLevel(q.recorrencia))errs.push('recorrência fora da escala'); if(q.dificuldade!=null&&!validLevel(q.dificuldade))errs.push('dificuldade fora da escala');
  const peso=Number(q.peso_simulado??q.peso??q.peso_disciplina??1); if(!(peso>0))errs.push('peso inválido');
  return errs;
}
function parsePackage(){
  let obj; try{obj=JSON.parse($('#simulationJson').value)}catch{return notice('O pacote não está em JSON válido.','error')}
  const meta=obj.simulado||{},items=obj.questoes||[];
  if(!String(meta.titulo||'').trim()||!Array.isArray(items)||!items.length)return notice('O pacote precisa conter os dados do simulado e pelo menos uma questão.','error');
  if(!Number(meta.duracao_minutos||0))return notice('Informe a duração do simulado no pacote.','error');
  parsed={versao:obj.versao||'1.0',simulado:meta,questoes:items}; selected=new Set(items.map((_,i)=>i)); renderPreview();
}
function renderPreview(){
  const box=$('#simulationPreview'),summary=$('#simulationSummary'); if(!parsed){box.innerHTML='<div class="empty">Cole um pacote e clique em ANALISAR SIMULADO.</div>';summary.innerHTML='';return}
  const byDisc={};let problems=0,dups=0,flash=0;const seen=new Set();
  const rows=parsed.questoes.map((q,i)=>{
    const errs=validateQuestion(q),key=norm(q.enunciado),dup=existingQuestions.has(key)||seen.has(key);if(key)seen.add(key);if(dup)dups++;if(q.flashcard)flash++;if(errs.length)problems++;
    byDisc[q.disciplina||'Sem disciplina']=(byDisc[q.disciplina||'Sem disciplina']||0)+1;
    return `<tr><td><input type="checkbox" data-sim-select="${i}" ${selected.has(i)?'checked':''} ${errs.length?'disabled':''}></td><td>${i+1}</td><td><b>${esc(q.disciplina||'—')}</b><small class="table-sub">${esc(q.assunto||'—')}</small></td><td>${esc(String(q.enunciado||'').slice(0,120))}${String(q.enunciado||'').length>120?'…':''}</td><td>${Number(q.peso_simulado??q.peso??q.peso_disciplina??1).toFixed(1)}</td><td>${errs.length?`<span class="badge off">${esc(errs.join('; '))}</span>`:dup?'<span class="badge wait">Já existe no banco</span>':'<span class="badge ok">Pronta</span>'}</td></tr>`;
  }).join('');
  const dist=Object.entries(byDisc).sort((a,b)=>b[1]-a[1]).map(([d,n])=>`${esc(d)}: <b>${n}</b>`).join(' · ');
  const m=parsed.simulado;
  const inicio=m.data_liberacao?new Date(m.data_liberacao).toLocaleString('pt-BR'):'Imediata';
  const fim=m.data_encerramento?new Date(m.data_encerramento).toLocaleString('pt-BR'):'Sem encerramento';
  const correcao=m.correcao_modo==='encerramento'?'Após o encerramento':'Após finalizar';
  const tentativas=m.tentativas_multiplas?'Múltiplas':'Única';
  const ranking=m.mostrar_ranking===false?'Oculto':'Visível';
  summary.innerHTML=`<div class="sim-import-summary"><div><span class="eyebrow">SIMULADO IDENTIFICADO</span><h3>${esc(m.titulo)}</h3><p class="muted">${parsed.questoes.length} questões · ${Number(m.duracao_minutos||0)} min · ${flash} flashcard(s) sugerido(s)</p></div><div class="sim-preview-meta"><span><b>Liberação:</b> ${esc(inicio)}</span><span><b>Encerramento:</b> ${esc(fim)}</span><span><b>Tentativa:</b> ${esc(tentativas)}</span><span><b>Correção:</b> ${esc(correcao)}</span><span><b>Ranking:</b> ${esc(ranking)}</span></div><div class="sim-dist">${dist}</div><div>${dups?`<span class="badge wait">${dups} questão(ões) já existentes serão reutilizadas</span>`:''}${problems?` <span class="badge off">${problems} com problema estrutural</span>`:' <span class="badge ok">Estrutura válida</span>'}</div></div>`;
  box.innerHTML=`<div class="table-wrap"><table><thead><tr><th></th><th>#</th><th>Classificação</th><th>Enunciado</th><th>Peso</th><th>Validação</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $('#importSimulation').disabled=!Array.from(selected).some(i=>!validateQuestion(parsed.questoes[i]).length);
}
async function importPackage(){
  if(!parsed)return; const chosen=[...selected].sort((a,b)=>a-b).map(i=>parsed.questoes[i]).filter(q=>!validateQuestion(q).length); if(!chosen.length)return notice('Nenhuma questão válida está selecionada.','error');
  const btn=$('#importSimulation');btn.disabled=true;btn.textContent='IMPORTANDO...';
  const payload={versao:parsed.versao,simulado:parsed.simulado,questoes:chosen};
  const {data,error}=await sb.rpc('importar_simulado_oficial',{p_payload:payload}); btn.disabled=false;btn.textContent='IMPORTAR SIMULADO';
  if(error){console.error(error);return notice('Não foi possível importar o simulado. Confira o pacote e tente novamente.','error')}
  const r=data||{}; notice(`Simulado importado: ${r.questoes_vinculadas ?? chosen.length} questões. ${r.questoes_novas ?? 0} nova(s) incluída(s) no banco e ${r.questoes_reutilizadas ?? 0} reutilizada(s).`);
  parsed=null;selected.clear();$('#simulationJson').value='';renderPreview();await loadExistingQuestions();await refresh();
}
function copyTemplate(){
  const txt=`Gere um simulado oficial para a plataforma Foco na Missão. Responda SOMENTE com JSON válido, sem markdown. Use o edital, o padrão da banca, a distribuição e o nível solicitados. Estrutura:\n{"versao":"1.0","simulado":{"titulo":"Simulado Geral #01","descricao":"...","data_liberacao":"2026-09-20T08:00:00-03:00","data_encerramento":"2026-09-20T12:00:00-03:00","duracao_minutos":150,"tentativas_multiplas":false,"correcao_modo":"encerramento","mostrar_ranking":true,"ativo":true},"questoes":[{"disciplina":"Direito Penal","peso_disciplina":2,"assunto":"Crimes contra a Administração Pública","recorrencia_assunto":5,"dificuldade_assunto":4,"subassunto":"Peculato","banca":"BANCA","concurso":"CONCURSO","ano":2026,"recorrencia":5,"dificuldade":4,"peso_simulado":2,"enunciado":"...","alternativas":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correta":"C","comentario":"Explique a correta e, quando relevante, por que as demais estão erradas.","ponto_fixacao":"Regra curta e objetiva para fixação.","base_legal":"Dispositivo ou referência quando aplicável.","palavra_chave":"...","macete":"...","tags":["..."],"flashcard":{"frente":"...","verso":"...","recorrencia":5,"dificuldade":4}}]}\nRegras: peso_simulado é o valor daquela questão na pontuação da prova; recorrencia e dificuldade usam escala de 1 a 5 apenas como campos de classificação; as questões devem ser autorais, compatíveis com o padrão informado e juridicamente atualizadas quando aplicável. Não invente fundamento legal. Se o material fornecido não sustentar uma informação, não a trate como fato.`;
  navigator.clipboard.writeText(txt).then(()=>notice('Modelo de simulado copiado.')).catch(()=>notice('Não foi possível copiar automaticamente.','error'));
}

export async function setupAdminSimulados(){
  await Promise.all([refresh(),loadExistingQuestions()]); resetForm(); renderPreview();
  $('#simulationForm')?.addEventListener('submit',saveSimulation); $('#cancelSimulationEdit')?.addEventListener('click',resetForm);
  $('#analyzeSimulation')?.addEventListener('click',parsePackage); $('#importSimulation')?.addEventListener('click',importPackage); $('#copySimulationTemplate')?.addEventListener('click',copyTemplate); $('#clearSimulationJson')?.addEventListener('click',()=>{parsed=null;selected.clear();$('#simulationJson').value='';renderPreview()});
  $('#simulationPreview')?.addEventListener('change',e=>{const i=Number(e.target.dataset.simSelect);if(!Number.isInteger(i))return;e.target.checked?selected.add(i):selected.delete(i);$('#importSimulation').disabled=!selected.size});
  $('#adminSimulationList')?.addEventListener('click',async e=>{
    const edit=e.target.dataset.editSim,toggle=e.target.dataset.toggleSim,del=e.target.dataset.deleteSim;
    if(edit)return editSimulation(edit);
    if(toggle){const s=simulations.find(x=>Number(x.id)===Number(toggle));if(!s)return;const {error}=await sb.from('simulados').update({ativo:!s.ativo}).eq('id',s.id);if(error)return notice('Não foi possível alterar a publicação.','error');notice(s.ativo?'Simulado ocultado.':'Simulado publicado.');return refresh()}
    if(del){const s=simulations.find(x=>Number(x.id)===Number(del));if(!s)return;if(!confirm(`Excluir o simulado “${s.titulo}”? Os resultados vinculados também serão removidos.`))return;const {error}=await sb.from('simulados').delete().eq('id',s.id);if(error)return notice('Não foi possível excluir o simulado.','error');notice('Simulado excluído.');return refresh()}
  });
}
