import {sb} from './supabase.js';

const $=selector=>document.querySelector(selector);
const esc=(value='')=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
let ctx=null,materials=[],progress=new Map(),currentObjective=null,currentId=null;

function inline(value=''){
  return esc(value).replace(/\[\[(.+?)\]\]/g,'<mark class="theory-mark">$1</mark>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
}
function blockText(block={}){
  return [block.titulo,block.texto,...(block.paragrafos||[]),...(block.itens||[]).flatMap(item=>typeof item==='string'?[item]:Object.values(item||{})),...(block.linhas||[]).flat()].filter(Boolean).join(' ');
}
function sectionTitle(block,index){return String(block?.titulo||`Seção ${index+1}`).replace(/^\d+[.)-]?\s*/,'').trim()}
function renderBlock(block,index){
  if(!block||typeof block!=='object')return '';
  const anchor=`theory-section-${index+1}`;
  const title=block.titulo?`<h3>${inline(block.titulo)}</h3>`:'';
  if(block.tipo==='texto'){
    const paragraphs=(block.paragrafos?.length?block.paragrafos:[block.texto]).filter(Boolean);
    return `<section id="${anchor}" class="theory-block theory-text">${title}${paragraphs.map(text=>`<p>${inline(text)}</p>`).join('')}</section>`;
  }
  if(['destaque','bizu','mnemonico','pegadinha','lei'].includes(block.tipo)){
    const icon={destaque:'⭐',bizu:'💡',mnemonico:'🧠',pegadinha:'⚠️',lei:'⚖️'}[block.tipo];
    const label=block.rotulo||({destaque:'ATENÇÃO',bizu:'BIZU',mnemonico:'MNEMÔNICO',pegadinha:'PEGADINHA DE PROVA',lei:'LEI / REGRA'}[block.tipo]);
    return `<section id="${anchor}" class="theory-callout ${block.tipo}"><div class="theory-callout-head"><span>${icon}</span><b>${esc(label)}</b></div>${title}<p>${inline(block.texto||'')}</p>${block.chave?`<div class="mnemonic-key">${inline(block.chave)}</div>`:''}</section>`;
  }
  if(block.tipo==='termos')return `<section id="${anchor}" class="theory-block"><h3>${inline(block.titulo||'Termos importantes')}</h3><div class="theory-terms">${(block.itens||[]).map(item=>`<div><mark>${inline(item.termo||'')}</mark><span>${inline(item.explicacao||'')}</span></div>`).join('')}</div></section>`;
  if(block.tipo==='lista')return `<section id="${anchor}" class="theory-block">${title}<ul class="theory-list">${(block.itens||[]).map(item=>`<li>${inline(item)}</li>`).join('')}</ul></section>`;
  if(block.tipo==='quadro')return `<section id="${anchor}" class="theory-block">${title}<div class="table-wrap"><table class="theory-table"><thead><tr>${(block.colunas||[]).map(item=>`<th>${inline(item)}</th>`).join('')}</tr></thead><tbody>${(block.linhas||[]).map(row=>`<tr>${row.map(item=>`<td>${inline(item)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  if(block.tipo==='visual')return `<section id="${anchor}" class="theory-block theory-visual"><h3>${inline(block.titulo||'Mapa visual')}</h3>${block.texto?`<p>${inline(block.texto)}</p>`:''}<div class="visual-flow">${(block.itens||[]).map((item,itemIndex)=>`<div class="visual-node"><strong>${inline(item.titulo||String(itemIndex+1))}</strong><span>${inline(item.texto||'')}</span></div>`).join('<span class="visual-arrow">→</span>')}</div></section>`;
  if(block.tipo==='imagem'&&block.src)return `<figure id="${anchor}" class="theory-image"><img src="${esc(block.src)}" alt="${esc(block.alt||block.legenda||'Imagem de apoio')}">${block.legenda?`<figcaption>${inline(block.legenda)}</figcaption>`:''}</figure>`;
  if(block.tipo==='fixacao')return `<section id="${anchor}" class="theory-block"><h3>${inline(block.titulo||'Fixação rápida')}</h3><div class="fixation-list">${(block.itens||[]).map((item,itemIndex)=>`<details><summary>${itemIndex+1}. ${inline(item.pergunta||'')}</summary><p>${inline(item.resposta||'')}</p></details>`).join('')}</div></section>`;
  return '';
}

function fillTopics(){
  const select=$('#theoryTopic'); if(!select)return;
  const disciplineId=Number($('#theoryDiscipline')?.value)||0;
  const current=select.value;
  const items=materials.filter(material=>!disciplineId||Number(material.disciplina_id)===disciplineId).map(material=>[material.assunto_id,material.assuntos?.nome]).filter((item,index,array)=>item[0]&&item[1]&&array.findIndex(other=>Number(other[0])===Number(item[0]))===index).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
  select.innerHTML='<option value="">Todos os assuntos</option>'+items.map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('');
  if(items.some(([id])=>String(id)===current))select.value=current;
}
function filtered(){
  const query=($('#theorySearch')?.value||'').trim().toLowerCase();
  const disciplineId=Number($('#theoryDiscipline')?.value)||0;
  const topicId=Number($('#theoryTopic')?.value)||0;
  const status=$('#theoryStatus')?.value||'todos';
  return materials.filter(material=>{
    const reading=progress.get(Number(material.id)),done=reading?.status==='concluido';
    if(disciplineId&&Number(material.disciplina_id)!==disciplineId)return false;
    if(topicId&&Number(material.assunto_id)!==topicId)return false;
    if(status==='concluido'&&!done)return false;
    if(status==='pendente'&&done)return false;
    const searchable=`${material.titulo||''} ${material.subtitulo||''} ${material.resumo||''} ${material.disciplinas?.nome||''} ${material.assuntos?.nome||''}`.toLowerCase();
    return !query||searchable.includes(query);
  });
}
function renderList(){
  const list=filtered(),host=$('#theoryList');
  $('#theoryCount').textContent=list.length;
  if(!list.length){host.innerHTML='<div class="empty compact">Nenhum material encontrado.</div>';return}
  const groups=new Map();
  list.forEach(material=>{const key=material.disciplinas?.nome||'Outros';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(material)});
  host.innerHTML=[...groups.entries()].map(([discipline,items])=>`<section class="theory-discipline-group"><header><span>DISCIPLINA</span><b>${esc(discipline)}</b><small>${items.length} assunto(s)</small></header><div>${items.map(material=>{const done=progress.get(Number(material.id))?.status==='concluido';return `<button class="theory-list-item ${Number(currentId)===Number(material.id)?'active':''}" data-material="${material.id}" type="button"><span class="theory-list-state">${done?'✅':'📖'}</span><span><b>${esc(material.assuntos?.nome||material.titulo)}</b><small>${material.subtitulo?esc(material.subtitulo):done?'Concluído':'Disponível para estudo'}</small></span></button>`}).join('')}</div></section>`).join('');
}

async function markStarted(material){
  if(!material||progress.has(Number(material.id)))return;
  const payload={user_id:ctx.user.id,material_id:material.id,status:'em_estudo',progresso:10,iniciado_em:new Date().toISOString(),updated_at:new Date().toISOString()};
  const {error}=await sb.from('teoria_leituras').upsert(payload,{onConflict:'user_id,material_id'});
  if(!error){progress.set(Number(material.id),payload);renderList()}
  if(currentObjective&&material.assunto_id){try{await sb.from('usuario_objetivo_assuntos').upsert({user_id:ctx.user.id,objetivo_id:currentObjective,assunto_id:material.assunto_id,status:'estudando',updated_at:new Date().toISOString()},{onConflict:'user_id,objetivo_id,assunto_id'})}catch{}}
}
async function complete(material){
  const now=new Date().toISOString(),payload={user_id:ctx.user.id,material_id:material.id,status:'concluido',progresso:100,concluido_em:now,updated_at:now};
  const {error}=await sb.from('teoria_leituras').upsert(payload,{onConflict:'user_id,material_id'});
  if(error)return alert('Não foi possível registrar a conclusão.');
  progress.set(Number(material.id),payload);
  if(currentObjective&&material.assunto_id){try{await sb.from('usuario_objetivo_assuntos').upsert({user_id:ctx.user.id,objetivo_id:currentObjective,assunto_id:material.assunto_id,status:'estudado',estudado_em:now,updated_at:now},{onConflict:'user_id,objetivo_id,assunto_id'})}catch{}}
  renderList();renderReader(material);
}
function renderReader(material){
  currentId=material.id;renderList();
  const done=progress.get(Number(material.id))?.status==='concluido';
  const blocks=Array.isArray(material.blocos)?material.blocos:[];
  const wordCount=[material.resumo,...blocks.map(blockText)].join(' ').trim().split(/\s+/).filter(Boolean).length;
  const minutes=Math.max(1,Math.ceil(wordCount/190));
  const questions=blocks.find(block=>block.tipo==='fixacao')?.itens?.length||0;
  const questionHref=`./questoes.html?disciplina=${material.disciplina_id}${material.assunto_id?`&assunto=${material.assunto_id}`:''}`;
  const toc=blocks.map((block,index)=>`<a href="#theory-section-${index+1}"><span>${index+1}</span>${esc(sectionTitle(block,index))}</a>`).join('');
  $('#theoryReader').innerHTML=`<header class="theory-reader-head"><div><span class="eyebrow">${esc(material.disciplinas?.nome||'TEORIA')}</span><h2>${esc(material.assuntos?.nome||material.titulo)}</h2>${material.subtitulo?`<p>${inline(material.subtitulo)}</p>`:''}</div><span class="badge ${done?'ok':''}">${done?'CONCLUÍDO':'EM ESTUDO'}</span></header><div class="theory-reading-meta"><span>📚 ${blocks.length} seções</span><span>⏱️ ${minutes} min de leitura</span><span>✅ ${questions} questões de fixação</span></div>${material.resumo?`<p class="theory-lead">${inline(material.resumo)}</p>`:''}${blocks.length>3?`<nav class="theory-toc"><b>NESTE ASSUNTO</b><div>${toc}</div></nav>`:''}<div class="theory-content">${blocks.map(renderBlock).join('')}</div>${material.fonte_nome||material.fonte_url?`<footer class="theory-source"><b>Fonte / referência</b><span>${inline(material.fonte_nome||'Referência do material')}</span>${material.fonte_url?`<a href="${esc(material.fonte_url)}" target="_blank" rel="noopener">ABRIR FONTE ↗</a>`:''}</footer>`:''}<div class="theory-reader-actions"><a class="btn secondary" href="${questionHref}">📝 IR PARA QUESTÕES</a><button class="btn" id="completeTheory" type="button" ${done?'disabled':''}>${done?'✅ CONCLUÍDO':'MARCAR COMO ESTUDADO'}</button></div>`;
  $('#completeTheory')?.addEventListener('click',()=>complete(material));markStarted(material);
}

async function load(){
  const [{data:userObjective},{data:loadedMaterials,error},{data:readings}]=await Promise.all([
    sb.from('usuario_objetivo').select('objetivo_id,concursos_objetivos(titulo)').eq('user_id',ctx.user.id).maybeSingle(),
    sb.from('teoria_materiais').select('id,objetivo_id,disciplina_id,assunto_id,titulo,subtitulo,resumo,blocos,fonte_nome,fonte_url,ordem,disciplinas(nome),assuntos(nome,disciplina_id)').eq('ativo',true).order('ordem').order('titulo'),
    sb.from('teoria_leituras').select('material_id,status,progresso,concluido_em').eq('user_id',ctx.user.id)
  ]);
  if(error)throw error;
  currentObjective=userObjective?.objetivo_id||null;
  $('#theoryObjective').textContent=userObjective?.concursos_objetivos?.titulo||'PREPARAÇÃO GERAL';
  materials=(loadedMaterials||[]).filter(material=>!material.objetivo_id||Number(material.objetivo_id)===Number(currentObjective));
  progress=new Map((readings||[]).map(reading=>[Number(reading.material_id),reading]));
  const disciplines=[...new Map(materials.map(material=>[material.disciplina_id,material.disciplinas?.nome])).entries()].sort((a,b)=>(a[1]||'').localeCompare(b[1]||'','pt-BR'));
  $('#theoryDiscipline').innerHTML='<option value="">Todas as disciplinas</option>'+disciplines.map(([id,name])=>`<option value="${id}">${esc(name||'Disciplina')}</option>`).join('');
  const params=new URLSearchParams(location.search),materialId=Number(params.get('material'))||0,topicId=Number(params.get('assunto'))||0,disciplineId=Number(params.get('disciplina'))||0;
  if(disciplineId)$('#theoryDiscipline').value=String(disciplineId);
  fillTopics();if(topicId)$('#theoryTopic').value=String(topicId);renderList();
  const first=materials.find(material=>Number(material.id)===materialId)||materials.find(material=>topicId&&Number(material.assunto_id)===topicId)||materials.find(material=>disciplineId&&Number(material.disciplina_id)===disciplineId)||filtered()[0];
  if(first)renderReader(first);
}

export async function setupTeoria(context){
  ctx=context;
  $('#theorySearch')?.addEventListener('input',renderList);
  $('#theoryDiscipline')?.addEventListener('change',()=>{fillTopics();renderList()});
  $('#theoryTopic')?.addEventListener('change',renderList);
  $('#theoryStatus')?.addEventListener('change',renderList);
  $('#theoryList')?.addEventListener('click',event=>{const button=event.target.closest('[data-material]');if(!button)return;const material=materials.find(item=>Number(item.id)===Number(button.dataset.material));if(material)renderReader(material)});
  await load();
}
