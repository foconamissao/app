const CACHE='missao-pe-shell-v3.4.0';
const SHELL=[
  './','./login.html','./plano.html','./objetivos.html','./cadastro.html','./index.html','./missao.html','./cronograma.html','./calendario.html','./revisao.html',
  './questoes.html','./flashcards.html','./erros.html','./simulados.html','./desempenho.html',
  './ranking.html','./perfil.html','./admin.html',
  './css/variables.css','./css/global.css','./css/responsive.css',
  './assets/logo-missao-pe.png','./assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png',
  './js/pwa.js','./js/plano.js','./js/objetivos.js','./js/admin_qualidade.js','./js/admin_editais.js','./js/app.js','./js/notifications.js','./js/dashboard.js','./js/calendario.js','./js/revisao.js','./js/profile_stats.js','./js/admin_acompanhamento.js','./js/admin.js','./js/admin_integridade.js'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  event.respondWith(
    fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
      return response;
    }).catch(()=>caches.match(event.request).then(r=>r||caches.match('./login.html')))
  );
});
