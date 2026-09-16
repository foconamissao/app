(function(){
  const VERSION='4.0.2';
  const loadingRx=/carregando|preparando|buscando|analisando/i;
  let reported=false;
  function show(message){
    if(reported)return; reported=true;
    console.error('[Missão PE '+VERSION+'] '+message);
    const box=document.createElement('div');
    box.id='runtimeGuardNotice';
    box.setAttribute('role','alert');
    box.style.cssText='position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:760px;margin:auto;padding:14px 16px;border:1px solid #caa54b;border-radius:12px;background:#151a22;color:#fff;box-shadow:0 12px 35px #0008;font:14px/1.45 system-ui,sans-serif';
    box.innerHTML='<b>Não foi possível concluir o carregamento desta página.</b><br><span style="opacity:.82">Atualize a página. Se continuar, a versão publicada pode estar em cache ou algum serviço está indisponível.</span>';
    document.body.appendChild(box);
    document.querySelectorAll('.empty,.loading').forEach(el=>{
      if(loadingRx.test(el.textContent||'')) el.textContent='Não foi possível carregar estes dados. Atualize a página.';
    });
  }
  window.addEventListener('error',e=>{
    const m=e?.message||'';
    if(/module|script|syntax|unexpected token|failed to fetch|import/i.test(m)) show('Falha ao carregar um módulo do aplicativo.');
  });
  window.addEventListener('unhandledrejection',e=>{
    const reason=String(e?.reason?.message||e?.reason||'');
    console.error('[Missão PE] rejeição não tratada:',e?.reason);
    if(/fetch|network|module|import|supabase|failed/i.test(reason)) show('Falha de comunicação durante a inicialização.');
  });
  window.setTimeout(()=>{
    if(window.__FM_PAGE_READY)return;
    const still=[...document.querySelectorAll('.empty,.loading')].some(el=>loadingRx.test(el.textContent||''));
    if(still)show('A inicialização excedeu o tempo esperado.');
  },12000);
})();
