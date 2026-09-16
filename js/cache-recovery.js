(function(){
  if('caches' in window){
    caches.keys().then(keys=>Promise.all(keys.filter(k=>/^missao-pe-shell-v/i.test(k)).map(k=>caches.delete(k)))).catch(()=>{});
  }
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistration().then(reg=>reg?.update?.()).catch(()=>{});
  }
})();
