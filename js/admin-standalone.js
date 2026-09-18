(function(){
'use strict';
const VERSION='4.4.1';
const SUPABASE_URL='https://zjnbmgkvnzdnaiszqhta.supabase.co';
const SUPABASE_KEY='sb_publishable_vghGz23YWhZ4CNXMjkrslA_ZH1osJsI';
const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const timeout=(p,ms=15000)=>Promise.race([Promise.resolve(p),new Promise((_,rej)=>setTimeout(()=>rej(new Error('Tempo esgotado')),ms))]);
function showError(msg,detail=''){
  console.error('[Foco na Missão '+VERSION+'] '+msg,detail||'');
  let box=$('#pageLoadError');
  if(!box){box=document.createElement('div');box.id='pageLoadError';box.className='notice error';box.style.margin='16px 0';$('.main')?.prepend(box)}
  if(box) box.innerHTML='<b>'+esc(msg)+'</b>'+ (detail?'<br><small>'+esc(detail)+'</small>':'');
}
function initials(name=''){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'FM'}
function formatNow(date=new Date()){const d=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(date);const t=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);return `${d}, ${t}`}
function mountHeader(profile,sb){const top=$('.topbar');if(!top)return;top.querySelectorAll('.topbar-right').forEach(x=>x.remove());const right=document.createElement('div');right.className='topbar-right';const clock=document.createElement('time');clock.className='header-datetime';const tick=()=>clock.textContent=formatNow();tick();setInterval(tick,1000);right.appendChild(clock);const wrap=document.createElement('div');wrap.className='account-wrap';let photo='';if(profile.avatar_path){try{photo=`<img src="${sb.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl}?v=${Date.now()}" alt="Foto">`}catch{}}wrap.innerHTML=`<div class="account-avatar">${photo||`<span>${initials(profile.nome)}</span>`}</div><b class="account-name">${esc(profile.nome||'Administrador')}</b><button class="account-gear" type="button" aria-label="Opções">⚙</button><div class="account-menu hidden"><a href="./admin.html#perfil">👤 Editar perfil</a><button type="button" class="logout-menu">🚪 Sair</button></div>`;right.appendChild(wrap);top.appendChild(right);const menu=wrap.querySelector('.account-menu');wrap.querySelector('.account-gear')?.addEventListener('click',()=>menu?.classList.toggle('hidden'));wrap.querySelector('.logout-menu')?.addEventListener('click',async()=>{await sb.auth.signOut();location.href='./login.html'});document.querySelectorAll('[data-admin]').forEach(x=>x.classList.remove('hidden'))}
function mountNavigation(sb){document.querySelector('[data-nav="admin"]')?.classList.add('active');$('#logout')?.addEventListener('click',async e=>{e.preventDefault();await sb.auth.signOut();location.href='./login.html'});const side=$('.sidebar'),overlay=$('.overlay');$('#mobileMenu')?.addEventListener('click',()=>{side?.classList.toggle('open');overlay?.classList.toggle('open')});overlay?.addEventListener('click',()=>{side?.classList.remove('open');overlay?.classList.remove('open')})}
async function main(){
 try{
   await (window.__FM_RECOVERY_PROMISE||Promise.resolve());
   await timeout(window.__FM_SUPABASE_READY,15000);
   if(!window.supabase?.createClient) throw new Error('Biblioteca de conexão indisponível.');
   const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   window.__FM_SB=sb;
   const session=await timeout(sb.auth.getSession(),12000);
   const user=session?.data?.session?.user;
   if(!user){location.href='./login.html?next=admin.html';return}
   const pr=await timeout(sb.rpc('get_my_profile'),12000);
   if(pr.error) throw pr.error;
   const profile=Array.isArray(pr.data)?pr.data[0]:pr.data;
   if(!profile) throw new Error('Perfil não encontrado.');
   if(profile.role!=='admin'){location.href='./index.html';return}
   if(profile.status!=='aprovado'||!profile.ativo){await sb.auth.signOut();location.href='./login.html';return}
   mountHeader(profile,sb); mountNavigation(sb);
   window.__FM_ADMIN_CONTEXT={user,profile,sb};
   try{
     const mod=await timeout(import('./admin.js?v=4.4.1'),15000);
     if(typeof mod.setupAdmin!=='function') throw new Error('Inicializador da administração não encontrado.');
     await mod.setupAdmin({user,profile});
   }catch(e){showError('A área administrativa carregou parcialmente.',e?.message||String(e));}
   window.__FM_PAGE_READY=true;
   document.querySelector('#runtimeGuardNotice')?.remove();
 }catch(e){
   showError('Não foi possível iniciar a Administração.',e?.message||String(e));
   window.__FM_PAGE_READY=true;
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',main,{once:true});else main();
})();
