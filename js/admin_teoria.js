import {sb} from './supabase.js';

const $=selector=>document.querySelector(selector);
const esc=(value='')=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const norm=value=>(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
let objectives=[],disciplines=[],topics=[],materials=[],draft=[],packageObjective=null;

function notice(message,type='success'){
  const element=$('#theoryAdminNotice');if(!element)return;
  element.textContent=message;element.className=`notice ${type}`;element.classList.remove('hidden');
  clearTimeout(notice.timer);notice.timer=setTimeout(()=>element.classList.add('hidden'),6500);
}
function blockCharacters(blocks=[]){return blocks.map(block=>[block.titulo,block.texto,...(block.paragrafos||[]),...(block.itens||[]).flatMap(item=>typeof item==='string'?[item]:Object.values(item||{})),...(block.linhas||[]).flat()].filter(Boolean).join(' ')).join(' ').length}
function validateDepth(material){
  const errors=[],blocks=Array.isArray(material.blocos)?material.blocos:[];
  const types=new Set(blocks.map(block=>block?.tipo));
  const fixation=blocks.find(block=>block?.tipo==='fixacao');
  if(!material.assunto)errors.push('assunto obrigatório');
  if(!material.titulo)errors.push('título ausente');
  if(!material.resumo||String(material.resumo).trim().length<80)errors.push('resumo muito curto');
  if(blocks.length<6)errors.push('mínimo de 6 blocos');
  if(blockCharacters(blocks)<650)errors.push('conteúdo precisa ter pelo menos 650 caracteres');
  if(!types.has('texto'))errors.push('falta bloco de conceito (texto)');
  if(!['lista','termos','quadro'].some(type=>types.has(type)))errors.push('falta lista, termos ou quadro');
  if(!['bizu','pegadinha','destaque'].some(type=>types.has(type)))errors.push('falta ponto de prova');
  if(!fixation||!Array.isArray(fixation.itens)||fixation.itens.length<3)errors.push('mínimo de 3 questões de fixação');
  return errors;
}
function fill(){
  const objectiveOptions=objectives.map(objective=>`<option value="${objective.id}">${esc(objective.titulo)}</option>`).join('');
  $('#theoryAdminObjective').innerHTML='<option value="">Selecione…</option>'+objectiveOptions;
  $('#theoryAdminObjectiveFilter').innerHTML='<option value="">Todos os objetivos</option>'+objectiveOptions;
  const disciplineOptions=disciplines.map(discipline=>`<option value="${discipline.id}">${esc(discipline.nome)}</option>`).join('');
  $('#theoryAdminDiscipline').innerHTML='<option value="">Selecione…</option>'+disciplineOptions;
  $('#theoryAdminFilter').innerHTML='<option value="">Todas as disciplinas</option>'+disciplineOptions;
  fillTopics();
}
function fillTopics(){
  const disciplineId=Number($('#theoryAdminDiscipline')?.value)||0;
  $('#theoryAdminTopic').innerHTML='<option value="">Selecione o assunto…</option>'+topics.filter(topic=>Number(topic.disciplina_id)===disciplineId).map(topic=>`<option value="${topic.id}">${esc(topic.nome)}</option>`).join('');
}
function reset(){const form=$('#theoryMaterialForm');form.reset();form.elements.id.value='';form.elements.ativo.checked=true;$('#cancelTheoryMaterial').classList.add('hidden');fillTopics()}
function render(){
  const query=($('#theoryAdminSearch')?.value||'').toLowerCase(),disciplineId=Number($('#theoryAdminFilter')?.value)||0,objectiveId=Number($('#theoryAdminObjectiveFilter')?.value)||0;
  const list=materials.filter(material=>(!objectiveId||Number(material.objetivo_id)===objectiveId)&&(!disciplineId||Number(material.disciplina_id)===disciplineId)&&(!query||`${material.titulo} ${material.disciplinas?.nome||''} ${material.assuntos?.nome||''}`.toLowerCase().includes(query)));
  const host=$('#theoryAdminList');if(!list.length){host.innerHTML='<div class="card empty">Nenhum material encontrado.</div>';return}
  host.innerHTML=list.map(material=>{const errors=validateDepth({...material,assunto:material.assuntos?.nome});return `<article class="card theory-admin-item"><div><span class="badge ${material.ativo?'ok':'off'}">${material.ativo?'ATIVO':'OCULTO'}</span> <span class="badge ${errors.length?'off':'ok'}">${errors.length?'REVISAR':'PADRÃO COMPLETO'}</span><h3>${esc(material.assuntos?.nome||material.titulo)}</h3><small>${esc(material.disciplinas?.nome||'')}${material.assuntos?.nome?' · '+esc(material.titulo):''}</small><p>${esc(material.resumo||'')}</p>${errors.length?`<small class="theory-quality-errors">${esc(errors.join(' · '))}</small>`:''}</div><div class="actions"><button class="mini" data-theory-edit="${material.id}">EDITAR</button><button class="mini" data-theory-toggle="${material.id}">${material.ativo?'OCULTAR':'PUBLICAR'}</button><button class="mini danger-mini" data-theory-delete="${material.id}">EXCLUIR</button></div></article>`}).join('');
}
async function load(){
  const [{data:loadedObjectives,error:objectiveError},{data:loadedDisciplines,error:disciplineError},{data:loadedTopics,error:topicError},{data:loadedMaterials,error:materialError}]=await Promise.all([
    sb.from('concursos_objetivos').select('id,titulo,ativo').eq('ativo',true).order('titulo'),sb.from('disciplinas').select('id,nome').eq('ativo',true).order('nome'),sb.from('assuntos').select('id,nome,disciplina_id').eq('ativo',true).order('nome'),sb.from('teoria_materiais').select('*,disciplinas(nome),assuntos(nome)').order('ordem').order('titulo')
  ]);
  if(objectiveError||disciplineError||topicError||materialError){notice('Não foi possível carregar a Teoria Direcionada. Verifique a conexão e a estrutura do banco.','error');return}
  objectives=loadedObjectives||[];disciplines=loadedDisciplines||[];topics=loadedTopics||[];materials=loadedMaterials||[];fill();render();
}
function parseBlocks(value){if(!value.trim())return[];const parsed=JSON.parse(value);if(!Array.isArray(parsed))throw new Error('Blocos precisam ser um array JSON.');return parsed}
async function save(event){
  event.preventDefault();const form=event.currentTarget;let blocks;
  try{blocks=parseBlocks(form.elements.blocos.value)}catch(error){return notice(error.message,'error')}
  const topic=topics.find(item=>Number(item.id)===Number(form.elements.assunto_id.value));
  const payload={objetivo_id:Number(form.elements.objetivo_id.value),disciplina_id:Number(form.elements.disciplina_id.value),assunto_id:Number(form.elements.assunto_id.value),titulo:form.elements.titulo.value.trim(),subtitulo:form.elements.subtitulo.value.trim()||null,resumo:form.elements.resumo.value.trim()||null,fonte_nome:form.elements.fonte_nome.value.trim()||null,fonte_url:form.elements.fonte_url.value.trim()||null,blocos:blocks,ativo:form.elements.ativo.checked,updated_at:new Date().toISOString()};
  if(!payload.objetivo_id||!payload.disciplina_id||!payload.assunto_id||!payload.titulo)return notice('Objetivo, disciplina, assunto e título são obrigatórios.','error');
  const qualityErrors=validateDepth({...payload,assunto:topic?.nome});if(qualityErrors.length)return notice(`Material incompleto: ${qualityErrors.join('; ')}.`,'error');
  const id=Number(form.elements.id.value)||null;
  const {error}=id?await sb.from('teoria_materiais').update(payload).eq('id',id):await sb.from('teoria_materiais').insert(payload);
  if(error)return notice(error.message,'error');notice(id?'Material atualizado.':'Material criado.');reset();await load();
}
function edit(id){
  const material=materials.find(item=>Number(item.id)===Number(id));if(!material)return;
  const form=$('#theoryMaterialForm');form.elements.id.value=material.id;form.elements.objetivo_id.value=material.objetivo_id||'';form.elements.disciplina_id.value=material.disciplina_id;fillTopics();form.elements.assunto_id.value=material.assunto_id||'';
  for(const key of ['titulo','subtitulo','resumo','fonte_nome','fonte_url'])form.elements[key].value=material[key]||'';
  form.elements.blocos.value=JSON.stringify(material.blocos||[],null,2);form.elements.ativo.checked=!!material.ativo;$('#cancelTheoryMaterial').classList.remove('hidden');form.scrollIntoView({behavior:'smooth'});
}
function analyze(){
  draft=[];let parsed;
  try{parsed=JSON.parse($('#theoryJsonImport').value)}catch{$('#theoryJsonPreview').innerHTML='<div class="notice error">JSON inválido.</div>';$('#importTheoryJson').disabled=true;return}
  const list=Array.isArray(parsed)?parsed:parsed.materiais;if(!Array.isArray(list))return notice('O JSON precisa conter o array materiais.','error');
  packageObjective=Array.isArray(parsed)?null:objectives.find(objective=>norm(objective.titulo)===norm(parsed.objetivo));
  if(!packageObjective)return notice('Objetivo do pacote não encontrado. Use o título exato cadastrado em Meu objetivo.','error');
  draft=list.map((material,index)=>{
    const discipline=disciplines.find(item=>norm(item.nome)===norm(material.disciplina));
    const topic=topics.find(item=>Number(item.disciplina_id)===Number(discipline?.id)&&norm(item.nome)===norm(material.assunto));
    const errors=[];
    if(!discipline)errors.push('disciplina não encontrada');if(!topic)errors.push('assunto não encontrado');if(!Array.isArray(material.blocos))errors.push('blocos inválidos');
    errors.push(...validateDepth(material));
    const existing=materials.find(item=>Number(item.objetivo_id)===Number(packageObjective.id)&&Number(item.disciplina_id)===Number(discipline?.id)&&Number(item.assunto_id)===Number(topic?.id));
    return {...material,_index:index,_discipline:discipline,_topic:topic,_existing:existing,_errors:[...new Set(errors)]};
  });
  const valid=draft.filter(item=>!item._errors.length),updates=valid.filter(item=>item._existing).length,inserts=valid.length-updates;
  $('#theoryJsonPreview').innerHTML=`<div class="notice ${valid.length===draft.length?'success':'warn'}"><b>${valid.length}/${draft.length}</b> material(is) aprovados · ${updates} atualização(ões) · ${inserts} novo(s).</div>`+draft.map(item=>`<div class="theory-json-line ${item._errors.length?'bad':''}"><b>${esc(item.titulo||`Material ${item._index+1}`)}</b><small>${item._errors.length?esc(item._errors.join(' · ')):`${esc(item.disciplina)} · ${esc(item.assunto)} · ${item._existing?'ATUALIZAR':'CRIAR'}`}</small></div>`).join('');
  $('#importTheoryJson').disabled=!valid.length;
}
function rowFromDraft(item,index){return {objetivo_id:packageObjective.id,disciplina_id:item._discipline.id,assunto_id:item._topic.id,titulo:item.titulo,subtitulo:item.subtitulo||null,resumo:item.resumo||null,blocos:item.blocos,fonte_nome:item.fonte_nome||null,fonte_url:item.fonte_url||null,ordem:Number(item.ordem)||index+1,ativo:item.ativo!==false,updated_at:new Date().toISOString()}}
async function importDraft(){
  const valid=draft.filter(item=>!item._errors.length);if(!valid.length)return;
  const button=$('#importTheoryJson');button.disabled=true;button.textContent='IMPORTANDO…';
  let updated=0,inserted=0;
  try{
    const updates=valid.filter(item=>item._existing);
    for(let index=0;index<updates.length;index+=12){const results=await Promise.all(updates.slice(index,index+12).map((item,offset)=>sb.from('teoria_materiais').update(rowFromDraft(item,index+offset)).eq('id',item._existing.id)));const error=results.find(result=>result.error)?.error;if(error)throw error;updated+=results.length}
    const inserts=valid.filter(item=>!item._existing);
    for(let index=0;index<inserts.length;index+=50){const rows=inserts.slice(index,index+50).map((item,offset)=>rowFromDraft(item,index+offset));const {error}=await sb.from('teoria_materiais').insert(rows);if(error)throw error;inserted+=rows.length}
    notice(`Importação concluída: ${updated} atualizado(s) e ${inserted} criado(s).`);$('#theoryJsonImport').value='';$('#theoryJsonPreview').innerHTML='';draft=[];packageObjective=null;await load();
  }catch(error){notice(`Importação interrompida: ${error.message}`,'error')}
  finally{button.textContent='IMPORTAR / ATUALIZAR';button.disabled=true}
}
async function copyTemplate(){
  const template={versao:'2.0',objetivo:'Título exato do objetivo',materiais:[{disciplina:'Nome exato da disciplina',assunto:'Nome exato do assunto',titulo:'Assunto — teoria direcionada',subtitulo:'Conceito, características, aplicação e fixação',resumo:'Resumo de abertura com pelo menos 80 caracteres.',blocos:[{tipo:'texto',titulo:'1. O que é',paragrafos:['Explique o conceito com contexto.','Desenvolva características, alcance e aplicação.']},{tipo:'lista',titulo:'2. Características',itens:['Característica 1','Característica 2','Característica 3']},{tipo:'quadro',titulo:'3. Quadro de revisão',colunas:['Ponto','Explicação'],linhas:[['Conceito','Explicação']]},{tipo:'destaque',titulo:'4. Como cai',texto:'Ponto importante de prova.'},{tipo:'bizu',titulo:'5. Estratégia',texto:'Técnica de revisão.'},{tipo:'pegadinha',titulo:'6. Erro comum',texto:'Distinção que evita erro.'},{tipo:'fixacao',titulo:'7. Fixação',itens:[{pergunta:'Pergunta 1',resposta:'Resposta explicada.'},{pergunta:'Pergunta 2',resposta:'Resposta explicada.'},{pergunta:'Pergunta 3',resposta:'Resposta explicada.'}]}],ordem:1,ativo:true}]};
  try{await navigator.clipboard.writeText(JSON.stringify(template,null,2));notice('Modelo completo copiado para a área de transferência.')}catch{notice('Não foi possível copiar automaticamente.','error')}
}

export async function setupAdminTeoria(){
  await load();
  $('#theoryAdminDiscipline')?.addEventListener('change',fillTopics);$('#theoryMaterialForm')?.addEventListener('submit',save);$('#cancelTheoryMaterial')?.addEventListener('click',reset);$('#newTheoryMaterial')?.addEventListener('click',()=>{reset();$('#theoryMaterialForm').scrollIntoView({behavior:'smooth'})});
  $('#theoryAdminSearch')?.addEventListener('input',render);$('#theoryAdminFilter')?.addEventListener('change',render);$('#theoryAdminObjectiveFilter')?.addEventListener('change',render);$('#analyzeTheoryJson')?.addEventListener('click',analyze);$('#importTheoryJson')?.addEventListener('click',importDraft);$('#copyTheoryTemplate')?.addEventListener('click',copyTemplate);
  $('#theoryAdminList')?.addEventListener('click',async event=>{const editId=event.target.closest('[data-theory-edit]')?.dataset.theoryEdit,toggleId=event.target.closest('[data-theory-toggle]')?.dataset.theoryToggle,deleteId=event.target.closest('[data-theory-delete]')?.dataset.theoryDelete;if(editId)return edit(editId);if(toggleId){const material=materials.find(item=>Number(item.id)===Number(toggleId));const {error}=await sb.from('teoria_materiais').update({ativo:!material.ativo,updated_at:new Date().toISOString()}).eq('id',material.id);if(error)return notice(error.message,'error');return load()}if(deleteId){if(!confirm('Excluir este material teórico?'))return;const {error}=await sb.from('teoria_materiais').delete().eq('id',Number(deleteId));if(error)return notice(error.message,'error');return load()}});
}
