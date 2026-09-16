const CACHE='missao-pe-static-v4.0.2';
const STATIC=[
  './css/variables.css','./css/global.css','./css/responsive.css',
  './assets/logo-missao-pe.png','./assets/icon-192.png','./assets/icon-512.png',
  './assets/icon-maskable-192.png','./assets/icon-maskable-512.png','./assets/apple-touch-icon.png',
  './assets/favicon-32.png','./assets/favicon.ico'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const dest=event.request.destination;
  // HTML e JavaScript sempre vêm da rede. Nunca retornar HTML como fallback de JS.
  if(dest==='document'||dest==='script'||url.pathname.endsWith('.html')||url.pathname.endsWith('.js')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>{
      if(dest==='document') return caches.match('./index.html').then(r=>r||Response.error());
      return Response.error();
    }));
    return;
  }
  // Recursos visuais podem usar cache, com atualização em segundo plano.
  event.respondWith(caches.match(event.request).then(cached=>{
    const network=fetch(event.request).then(response=>{
      if(response&&response.ok)caches.open(CACHE).then(c=>c.put(event.request,response.clone())).catch(()=>{});
      return response;
    }).catch(()=>cached||Response.error());
    return cached||network;
  }));
});
