import {sb} from './supabase.js';
const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let parsed=null, selected=new Set(), existing=new Set();
const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const clampLevel=(v,fallback=3)=>{const n=Number(v);return Number.isFinite(n)?Math.min(5,Math.max(1,Math.round(n))):fallback};
function notice(msg,type='success'){const el=$('#adminNotice');if(!el)return;el.textContent=msg;el.className=`notice ${type}`;el.scrollIntoView({behavior:'smooth',block:'nearest'});clearTimeout(notice.t);notice.t=setTimeout(()=>el.classList.add('hidden'),5000)}
function valLevel(v){const n=Number(v);return Number.isInteger(n)&&n>=1&&n<=5}
function validateItem(q,i){
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
async function loadExisting(){const {data}=await sb.from('questoes').select('enunciado').limit(10000);existing=new Set((data||[]).map(x=>norm(x.enunciado)))}
function parseInput(){
 let obj;try{obj=JSON.parse($('#bulkContent').value)}catch{return notice('O conteúdo não está em um JSON válido.','error')}
 const items=Array.isArray(obj)?obj:(obj.questoes||[]);if(!Array.isArray(items)||!items.length)return notice('Nenhuma questão foi encontrada no pacote.','error');
 parsed={versao:obj.versao||'1.0',questoes:items};selected=new Set(items.map((_,i)=>i));renderPreview();
}
function renderPreview(){
 const box=$('#bulkPreview'), summary=$('#bulkSummary');if(!parsed){box.innerHTML='<div class="empty">Cole um pacote e clique em ANALISAR LOTE.</div>';summary.textContent='';return}
 let valid=0,dups=0,flash=0,problems=0;const seen=new Set();
 const rows=parsed.questoes.map((q,i)=>{
   const errs=validateItem(q,i);const key=norm(q.enunciado);const dup=existing.has(key)||seen.has(key);if(key)seen.add(key);if(dup)dups++;if(q.flashcard)flash++;if(errs.length)problems++;else valid++;
   const checked=selected.has(i)?'checked':'';const blocked=errs.length?'disabled':'';
   return `<tr><td><input type="checkbox" data-bulk-select="${i}" ${checked} ${blocked}></td><td>${i+1}</td><td><b>${esc(q.disciplina||'—')}</b><small class="table-sub">${esc(q.assunto||'—')}${q.subassunto?` · ${esc(q.subassunto)}`:''}</small></td><td>${esc(String(q.enunciado||'').slice(0,115))}${String(q.enunciado||'').length>115?'…':''}</td><td>${q.flashcard?'✅':'—'}</td><td>${errs.length?`<span class="badge off">${esc(errs.join('; '))}</span>`:dup?'<span class="badge wait">Possível duplicidade</span>':'<span class="badge ok">Pronta</span>'}</td></tr>`;
 }).join('');
 summary.innerHTML=`<b>${parsed.questoes.length}</b> questões · <b>${valid}</b> estruturalmente válidas · <b>${flash}</b> flashcards · <b>${dups}</b> possíveis duplicidades · <b>${problems}</b> com problemas`;
 box.innerHTML=`<div class="table-wrap"><table><thead><tr><th></th><th>#</th><th>Classificação</th><th>Enunciado</th><th>Card</th><th>Validação</th></tr></thead><tbody>${rows}</tbody></table></div>`;
 $('#importBulk').disabled=!Array.from(selected).some(i=>!validateItem(parsed.questoes[i],i).length);
}
async function importSelected(){
 if(!parsed)return;const items=Array.from(selected).sort((a,b)=>a-b).map(i=>parsed.questoes[i]).filter(q=>!validateItem(q,0).length);if(!items.length)return notice('Nenhuma questão válida selecionada.','error');
 const btn=$('#importBulk');btn.disabled=true;btn.textContent='IMPORTANDO...';
 const payload={versao:parsed.versao,questoes:items.map(q=>({...q,recorrencia:clampLevel(q.recorrencia),dificuldade:clampLevel(q.dificuldade),recorrencia_assunto:clampLevel(q.recorrencia_assunto,q.recorrencia||3),dificuldade_assunto:clampLevel(q.dificuldade_assunto,q.dificuldade||3)}))};
 const {data,error}=await sb.rpc('importar_pacote_conteudo',{p_payload:payload});btn.disabled=false;btn.textContent='IMPORTAR SELECIONADAS';
 if(error){console.error(error);return notice('Não foi possível importar o pacote. Confira os dados e tente novamente.','error')}
 const r=data||{};notice(`Importação concluída: ${r.questoes_importadas||0} questões e ${r.flashcards_importados||0} flashcards. ${r.duplicadas_ignoradas||0} duplicidade(s) ignorada(s).`);await loadExisting();parsed=null;selected.clear();$('#bulkContent').value='';renderPreview();
}
function copyTemplate(){
 const txt=`Gere conteúdo para a plataforma Foco na Missão seguindo os campos de prioridade informados no modelo. Responda SOMENTE com JSON válido, sem markdown. Estrutura:\n{"versao":"1.0","questoes":[{"disciplina":"Direito Penal","peso_disciplina":2,"assunto":"Crimes contra a Administração Pública","recorrencia_assunto":5,"dificuldade_assunto":4,"subassunto":"Peculato","banca":"BANCA","concurso":"CONCURSO","ano":2026,"recorrencia":5,"dificuldade":4,"enunciado":"...","alternativas":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correta":"C","comentario":"Explique a correta e, quando relevante, por que as demais estão erradas.","ponto_fixacao":"Regra curta e objetiva para fixação.","base_legal":"Dispositivo ou referência quando aplicável.","palavra_chave":"...","macete":"...","tags":["..."],"flashcard":{"frente":"...","verso":"...","recorrencia":5,"dificuldade":4}}]}\nRegras: recorrencia e dificuldade usam escala 1 a 5; peso_disciplina deve refletir o peso do edital; questões devem ser autorais, compatíveis com o padrão da banca, e não inventar fundamento legal. Se uma informação não estiver sustentada pelo material fornecido, não a trate como fato.`;
 navigator.clipboard.writeText(txt).then(()=>notice('Modelo para IA copiado.')).catch(()=>notice('Não foi possível copiar automaticamente.','error'));
}
export async function setupAdminConteudo(){
 await loadExisting();
 $('#analyzeBulk')?.addEventListener('click',parseInput);$('#importBulk')?.addEventListener('click',importSelected);$('#copyAiTemplate')?.addEventListener('click',copyTemplate);$('#clearBulk')?.addEventListener('click',()=>{parsed=null;selected.clear();$('#bulkContent').value='';renderPreview()});
 $('#bulkPreview')?.addEventListener('change',e=>{const i=Number(e.target.dataset.bulkSelect);if(!Number.isInteger(i))return;e.target.checked?selected.add(i):selected.delete(i);$('#importBulk').disabled=!selected.size});
}
