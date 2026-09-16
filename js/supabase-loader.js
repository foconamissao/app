(function(){
  'use strict';
  const VERSION='4.0.4';
  function inject(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.crossOrigin='anonymous';s.onload=()=>window.supabase?.createClient?resolve(true):reject(new Error('Biblioteca inválida'));s.onerror=()=>reject(new Error('Falha: '+src));document.head.appendChild(s)})}
  window.__FM_SUPABASE_READY=(async()=>{
    if(window.supabase?.createClient)return true;
    let err;
    for(const src of ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://unpkg.com/@supabase/supabase-js@2']){
      try{await inject(src);return true}catch(e){err=e;console.warn('[Missão PE '+VERSION+']',e.message)}
    }
    throw err||new Error('Biblioteca de conexão indisponível');
  })();
})();
