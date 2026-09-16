let deferredInstallPrompt=null;

const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;

function showInstallHelp(){
  const ios=isIOS();
  const modal=document.createElement('div');
  modal.className='modal install-modal';
  modal.innerHTML=`<div class="modal-card install-card"><h2>Instalar Missão PE</h2><p>${ios
    ? 'No iPhone ou iPad, abra esta página no Safari, toque em <b>Compartilhar</b> e escolha <b>Adicionar à Tela de Início</b>.'
    : 'No navegador, abra o menu e escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.'}</p><button class="btn full" type="button">ENTENDI</button></div>`;
  document.body.appendChild(modal);
  modal.querySelector('button').addEventListener('click',()=>modal.remove());
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
}

async function installApp(){
  if(isStandalone())return;
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    try{await deferredInstallPrompt.userChoice;}catch{}
    deferredInstallPrompt=null;
    document.querySelectorAll('[data-install-app]').forEach(el=>el.classList.add('hidden'));
    return;
  }
  showInstallHelp();
}

function mountInstallButtons(){
  if(isStandalone())return;
  const nav=document.querySelector('.nav .admin');
  if(nav && !nav.querySelector('[data-install-app]')){
    const a=document.createElement('a');
    a.href='#';
    a.dataset.installApp='';
    a.innerHTML='⬇ Instalar aplicativo';
    a.addEventListener('click',e=>{e.preventDefault();installApp();});
    nav.prepend(a);
  }
  const loginCard=document.querySelector('.login-card');
  if(loginCard && !loginCard.querySelector('[data-install-app]')){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='btn secondary install-login-btn';
    btn.dataset.installApp='';
    btn.textContent='⬇ INSTALAR APLICATIVO';
    btn.addEventListener('click',installApp);
    loginCard.appendChild(btn);
  }
}

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  document.querySelectorAll('[data-install-app]').forEach(el=>el.classList.remove('hidden'));
});

window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  document.querySelectorAll('[data-install-app]').forEach(el=>el.classList.add('hidden'));
});

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
}

document.addEventListener('DOMContentLoaded',mountInstallButtons);
