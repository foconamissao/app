(function(){
  const VERSION='4.0.5';
  const KEY='fm_sw_reset_'+VERSION;
  window.__FM_RECOVERY_PROMISE=Promise.resolve();
  try{
    if(sessionStorage.getItem(KEY)==='done') return;
    sessionStorage.setItem(KEY,'done');
    window.__FM_RECOVERY_PROMISE=(async()=>{
      try{
        if('serviceWorker' in navigator){
          const regs=await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r=>r.unregister().catch(()=>false)));
        }
        if('caches' in window){
          const keys=await caches.keys();
          await Promise.all(keys.filter(k=>/^missao-pe-/i.test(k)).map(k=>caches.delete(k)));
        }
      }catch(e){ console.warn('[Missão PE] recuperação de cache:',e); }
    })();
  }catch(e){ console.warn('[Missão PE] recuperação indisponível:',e); }
})();
