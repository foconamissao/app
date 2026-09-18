import {sb} from './supabase.js';
const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let parsed=null, selected=new Set(), existing=[], analysis=[];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ');
const stop=new Set('a o as os um uma uns umas de da do das dos em no na nos nas para por com sem que se e ou ao aos à às é sao ser foi eram como mais menos muito muita muitos muitas não nao sua seu suas seus este esta estes estas isso isto aquele aquela aqueles aquelas qual quais quando onde quem cujo cuja cujos cujas'.split(' '));
const clampLevel=(v,fallback=3)=>{const n=Number(v);return Number.isFinite(n)?Math.min(5,Math.max(1,Math.round(n))):fallback};
function notice(msg,type='success'){const el=$('#adminNotice');if(!el)return;el.textContent=msg;el.className=`notice ${type}`;el.scrollIntoView({behavior:'smooth',block:'nearest'});clearTimeout(notice.t);notice.t=setTimeout(()=>el.classList.add('hidden'),5000)}
function valLevel(v){const n=Number(v);return Number.isInteger(n)&&n>=1&&n<=5}
function validateItem(q){
 const errors=[];
 if(!q||typeof q!=='object')return ['Item inválido'];
 if(!String(q.disciplina||'').trim())errors.push('sem disciplina');
 if(!String(q.assunto||'').trim())errors.push('sem assunto');
 if(!String(q.enunciado||'').trim())errors.push('sem enunciado');
 const alts=q.alternativas||{};['A','B','C','D'].forEach(k=>{if(!String(alts[k]||'').trim())errors.push(`sem alternativa ${k}`)});
 const correta=String(q.correta||'').toUpperCase();if(!['A','B','C','D','E'].includes(correta))errors.push('resposta correta inválida');else if(!String(alts[correta]||'').trim())errors.push('alternativa correta vazia');
 if(q.recorrencia!=null&&!valLevel(q.recorrencia))errors.push('recorrência deve ser 1–5');
 if(q.dificuldade!=null&&!valLevel(q.dificuldade))errors.push('dificuldade deve ser 1–5');
 if(q.flashcard&&(!String(q.flashcard.frente||'').trim()||!String(q.flashcard.verso||'').trim()))errors.push('flashcard incompleto');
 return errors;
}
function tokenSet(s){return new Set(norm(s).split(' ').filter(w=>w.length>2&&!stop.has(w)))}
function similarity(a,b){
 if(!a.size||!b.size)return 0;
 let inter=0;for(const w of a)if(b.has(w))inter++;
 if(inter<5)return 0;
 const union=a.size+b.size-inter,jacc=inter/union,contain=inter/Math.min(a.size,b.size);
 return Math.max(jacc,(jacc*.65)+(contain*.35));
}
async function loadExisting(){
 const {data,error}=await sb.from('questoes').select('id,enunciado').limit(10000);
 if(error){existing=[];return}
 existing=(data||[]).map(x=>({id:x.id,enunciado:x.enunciado||'',key:norm(x.enunciado),tokens:tokenSet(x.enunciado)}));
}
function analyzePackage(items){
 const keys=items.map(q=>norm(q?.enunciado));
 const counts=new Map();keys.filter(Boolean).forEach(k=>counts.set(k,(counts.get(k)||0)+1));
 const existingMap=new Map(existing.map(x=>[x.key,x]));
 const tokens=items.map(q=>tokenSet(q?.enunciado));
 return items.map((q,i)=>{
   const errors=validateItem(q),key=keys[i];
   let duplicate=null;
   if(key&&existingMap.has(key))duplicate={source:'banco',text:existingMap.get(key).enunciado};
   else if(key&&(counts.get(key)||0)>1)duplicate={source:'lote',text:q.enunciado};
   let similar=null,best=0;
   if(!errors.length&&!duplicate&&key.length>=40&&tokens[i].size>=6){
     for(const ex of existing){if(!ex.key||ex.key===key)continue;const s=similarity(tokens[i],ex.tokens);if(s>best){best=s;similar={source:'banco',text:ex.enunciado,score:s}}}
     for(let j=0;j<items.length;j++){if(j===i||keys[j]===key||keys[j].length<40)continue;const s=similarity(tokens[i],tokens[j]);if(s>best){best=s;similar={source:'lote',text:items[j].enunciado,score:s}}}
     if(best<.78)similar=null;
   }
   const status=errors.length?'problema':duplicate?'duplicada':similar?'semelhante':'pronta';
   return {errors,duplicate,similar,status};
 });
}
function parseInput(){
 let obj;try{obj=JSON.parse($('#bulkContent').value)}catch{return notice('O conteúdo não está em um JSON válido.','error')}
 const items=Array.isArray(obj)?obj:(obj.questoes||[]);if(!Array.isArray(items)||!items.length)return notice('Nenhuma questão foi encontrada no pacote.','error');
 parsed={versao:obj.versao||'1.0',questoes:items};analysis=analyzePackage(items);selected=new Set(items.map((_,i)=>i).filter(i=>analysis[i].status==='pronta'));
 $('#bulkWorkspace').classList.remove('hidden');renderPreview();$('#bulkWorkspace').scrollIntoView({behavior:'smooth',block:'start'});
}
function visibleIndexes(){
 const q=norm($('#bulkSearch')?.value||''),st=$('#bulkStatusFilter')?.value||'todos';
 if(!parsed)return[];
 return parsed.questoes.map((item,i)=>({item,i})).filter(({item,i})=>{
   const hay=norm(`${item.disciplina||''} ${item.assunto||''} ${item.subassunto||''} ${item.enunciado||''}`);
   return (!q||hay.includes(q))&&(st==='todos'||analysis[i]?.status===st);
 }).map(x=>x.i);
}
function statusMarkup(meta){
 if(meta.errors.length)return `<span class="badge off">${esc(meta.errors.join('; '))}</span>`;
 if(meta.duplicate)return '<span class="badge wait">Duplicada</span>';
 if(meta.similar)return `<span class="badge similar">Semelhante · ${Math.round(meta.similar.score*100)}%</span><small class="content-similar-note">Parecida com questão do ${meta.similar.source==='banco'?'banco':'próprio lote'}: ${esc(String(meta.similar.text||'').slice(0,105))}${String(meta.similar.text||'').length>105?'…':''}</small>`;
 return '<span class="badge ok">Pronta</span>';
}
function renderPreview(){
 const box=$('#bulkPreview'),summary=$('#bulkSummary');if(!parsed){box.innerHTML='';summary.textContent='';$('#bulkWorkspace')?.classList.add('hidden');return}
 const counts={pronta:0,duplicada:0,semelhante:0,problema:0};let flash=0;analysis.forEach((m,i)=>{counts[m.status]++;if(parsed.questoes[i].flashcard)flash++});
 const visible=new Set(visibleIndexes());
 const rows=parsed.questoes.map((q,i)=>{
   const meta=analysis[i],checked=selected.has(i)?'checked':'',blocked=meta.errors.length?'disabled':'',hide=visible.has(i)?'':' content-row-hidden';
   return `<tr class="${hide.trim()}" data-bulk-row="${i}"><td><input type="checkbox" data-bulk-select="${i}" ${checked} ${blocked}></td><td>${i+1}</td><td><b>${esc(q.disciplina||'—')}</b><small class="table-sub">${esc(q.assunto||'—')}${q.subassunto?` · ${esc(q.subassunto)}`:''}</small></td><td>${esc(String(q.enunciado||'').slice(0,115))}${String(q.enunciado||'').length>115?'…':''}</td><td>${q.flashcard?'✅':'—'}</td><td>${statusMarkup(meta)}</td></tr>`;
 }).join('');
 summary.innerHTML=`<b>${parsed.questoes.length}</b> questões · <b>${counts.pronta}</b> prontas · <b>${counts.duplicada}</b> duplicadas · <b>${counts.semelhante}</b> semelhantes · <b>${counts.problema}</b> com problemas · <b>${flash}</b> flashcards`;
 box.innerHTML=`<div class="table-wrap"><table><thead><tr><th></th><th>#</th><th>Classificação</th><th>Enunciado</th><th>Card</th><th>Validação</th></tr></thead><tbody>${rows}</tbody></table></div>`;
 updateSelectionState();
}
function updateSelectionState(){
 const valid=Array.from(selected).filter(i=>parsed&&!analysis[i]?.errors.length);
 $('#bulkSelectedCount').textContent=`${valid.length} selecionada${valid.length===1?'':'s'}`;
 $('#importBulk').disabled=!valid.length;
}
function applyFilters(){renderPreview()}
function selectVisible(value){for(const i of visibleIndexes()){if(!analysis[i].errors.length){value?selected.add(i):selected.delete(i)}}renderPreview()}
function excludeRepeated(){analysis.forEach((m,i)=>{if(m.duplicate||m.similar)selected.delete(i)});renderPreview();notice('Duplicadas e semelhantes foram desmarcadas.','success')}
function applyBulkLevels(){
 if(!parsed||!selected.size)return notice('Selecione pelo menos uma questão válida.','error');
 const rec=$('#bulkRecurrence').value,dif=$('#bulkDifficulty').value;if(!rec&&!dif)return notice('Escolha recorrência ou dificuldade para aplicar.','error');
 for(const i of selected){if(analysis[i].errors.length)continue;if(rec)parsed.questoes[i].recorrencia=Number(rec);if(dif)parsed.questoes[i].dificuldade=Number(dif)}
 analysis=analyzePackage(parsed.questoes);renderPreview();notice('Ajustes aplicados às questões selecionadas.');
}
async function registerHistory(info){
 try{await sb.rpc('admin_registrar_importacao_conteudo',{p_versao:String(parsed?.versao||'1.0'),p_selecionadas:info.selected,p_importadas:info.imported,p_flashcards:info.flashcards,p_duplicadas:info.duplicates,p_semelhantes:info.similar})}catch{}
}
async function importSelected(){
 if(!parsed)return;const idx=Array.from(selected).sort((a,b)=>a-b).filter(i=>!analysis[i].errors.length);const items=idx.map(i=>parsed.questoes[i]);if(!items.length)return notice('Nenhuma questão válida selecionada.','error');
 const btn=$('#importBulk');btn.disabled=true;btn.textContent='IMPORTANDO...';
 const payload={versao:parsed.versao,questoes:items.map(q=>({...q,recorrencia:clampLevel(q.recorrencia),dificuldade:clampLevel(q.dificuldade),recorrencia_assunto:clampLevel(q.recorrencia_assunto,q.recorrencia||3),dificuldade_assunto:clampLevel(q.dificuldade_assunto,q.dificuldade||3)}))};
 const {data,error}=await sb.rpc('importar_pacote_conteudo',{p_payload:payload});btn.disabled=false;btn.textContent='IMPORTAR SELECIONADAS';
 if(error){console.error(error);return notice('Não foi possível importar o pacote. Confira os dados e tente novamente.','error')}
 const r=data||{},similar=idx.filter(i=>analysis[i].similar).length;
 await registerHistory({selected:items.length,imported:Number(r.questoes_importadas||0),flashcards:Number(r.flashcards_importados||0),duplicates:Number(r.duplicadas_ignoradas||0),similar});
 notice(`Importação concluída: ${r.questoes_importadas||0} questões e ${r.flashcards_importados||0} flashcards. ${r.duplicadas_ignoradas||0} duplicidade(s) ignorada(s).`);
 await loadExisting();parsed=null;analysis=[];selected.clear();$('#bulkContent').value='';renderPreview();await loadHistory();
}
function copyTemplate(){
 const txt=`Gere conteúdo para a plataforma Foco na Missão seguindo os campos de prioridade informados no modelo. Responda SOMENTE com JSON válido, sem markdown. Estrutura:\n{"versao":"1.0","questoes":[{"disciplina":"Direito Penal","peso_disciplina":2,"assunto":"Crimes contra a Administração Pública","recorrencia_assunto":5,"dificuldade_assunto":4,"subassunto":"Peculato","banca":"BANCA","concurso":"CONCURSO","ano":2026,"recorrencia":5,"dificuldade":4,"enunciado":"...","alternativas":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correta":"C","comentario":"Explique a correta e, quando relevante, por que as demais estão erradas.","ponto_fixacao":"Mini-teoria de 2 a 4 frases que explique a regra ou conceito cobrado e ajude a memorizar. Não repita simplesmente a resposta correta. Inclua contraste, exceção, bizu ou mnemônico quando isso realmente ajudar.","base_legal":"Dispositivo ou referência quando aplicável.","palavra_chave":"...","macete":"...","tags":["..."],"flashcard":{"frente":"...","verso":"...","recorrencia":5,"dificuldade":4}}]}\nRegras: recorrencia e dificuldade usam escala 1 a 5; peso_disciplina deve refletir o peso do edital; questões devem ser autorais, compatíveis com o padrão da banca, e não inventar fundamento legal. Se uma informação não estiver sustentada pelo material fornecido, não a trate como fato.`;
 navigator.clipboard.writeText(txt).then(()=>notice('Modelo para IA copiado.')).catch(()=>notice('Não foi possível copiar automaticamente.','error'));
}
function fmtDate(v){if(!v)return'—';try{return new Date(v).toLocaleString('pt-BR')}catch{return'—'}}
async function loadHistory(){
 const box=$('#contentImportHistory');if(!box)return;
 box.innerHTML='<div class="empty compact">Carregando histórico...</div>';
 const {data,error}=await sb.rpc('admin_historico_importacoes_conteudo',{p_limite:12});
 if(error){box.innerHTML='<div class="empty compact">O histórico ficará disponível após ativar o recurso no banco.</div>';return}
 const list=Array.isArray(data)?data:[];if(!list.length){box.innerHTML='<div class="empty compact">Nenhuma importação registrada ainda.</div>';return}
 box.innerHTML=`<div class="content-history-list">${list.map(x=>`<div class="content-history-row"><div><b>${fmtDate(x.created_at)}</b><small>${esc(x.admin_nome||'Administrador')} · pacote ${esc(x.versao||'1.0')}</small></div><div class="content-history-metric"><b>${Number(x.questoes_importadas||0)}</b><small>questões</small></div><div class="content-history-metric"><b>${Number(x.flashcards_importados||0)}</b><small>flashcards</small></div><div class="content-history-metric"><b>${Number(x.duplicadas_ignoradas||0)}</b><small>duplicadas</small></div><div class="content-history-metric"><b>${Number(x.semelhantes_revisadas||0)}</b><small>semelhantes</small></div></div>`).join('')}</div>`;
}
export async function setupAdminConteudo(){
 await loadExisting();await loadHistory();
 $('#analyzeBulk')?.addEventListener('click',parseInput);$('#importBulk')?.addEventListener('click',importSelected);$('#copyAiTemplate')?.addEventListener('click',copyTemplate);$('#clearBulk')?.addEventListener('click',()=>{parsed=null;analysis=[];selected.clear();$('#bulkContent').value='';renderPreview()});
 $('#bulkPreview')?.addEventListener('change',e=>{const i=Number(e.target.dataset.bulkSelect);if(!Number.isInteger(i))return;e.target.checked?selected.add(i):selected.delete(i);updateSelectionState()});
 $('#bulkSearch')?.addEventListener('input',applyFilters);$('#bulkStatusFilter')?.addEventListener('change',applyFilters);$('#selectVisibleBulk')?.addEventListener('click',()=>selectVisible(true));$('#deselectVisibleBulk')?.addEventListener('click',()=>selectVisible(false));$('#excludeRiskBulk')?.addEventListener('click',excludeRepeated);$('#applyBulkLevels')?.addEventListener('click',applyBulkLevels);$('#refreshContentHistory')?.addEventListener('click',loadHistory);
}
