import { sb, isConfigured } from './supabase.js';

const form=document.querySelector('#loginForm');
const msg=document.querySelector('#msg');
const params=new URLSearchParams(location.search);

function show(text,type='info'){
  if(!msg) return;
  msg.textContent=text;
  msg.className=`notice ${type}`;
}

function withTimeout(promise, ms=12000){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('TIMEOUT')),ms))
  ]);
}

if(!isConfigured()){
  show('Não foi possível iniciar a plataforma. Tente novamente mais tarde.','error');
  form?.querySelector('button[type="submit"]')?.setAttribute('disabled','');
}else{
  try{
    const {data}=await withTimeout(sb.auth.getSession(),8000);
    if(data?.session) location.href='./index.html';
  }catch{
    // Mantém a tela disponível para uma nova tentativa de login.
  }
  if(params.get('erro')==='sessao') show('Sua sessão expirou. Entre novamente.','error');
}

form?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!isConfigured()) return;

  const btn=form.querySelector('button[type="submit"]');
  const email=form.elements.email.value.trim();
  const password=form.elements.password.value;

  if(!email||!password){
    show('Informe seu e-mail e sua senha.','error');
    return;
  }

  btn.disabled=true;
  btn.textContent='ENTRANDO...';
  show('Verificando seu acesso...');

  try{
    const {data,error}=await withTimeout(sb.auth.signInWithPassword({email,password}));
    if(error) throw new Error('LOGIN');
    if(!data?.user) throw new Error('LOGIN');

    const {data:profileData,error:profileError}=await withTimeout(sb.rpc('get_my_profile'));
    if(profileError) throw new Error('PROFILE');
    const profile=Array.isArray(profileData)?profileData[0]:profileData;
    if(!profile) throw new Error('PROFILE');

    if(profile.status!=='aprovado'||!profile.ativo){
      await sb.auth.signOut();
      const texts={
        pendente:'Seu cadastro está aguardando aprovação da administração.',
        nao_aprovado:'Seu cadastro não foi aprovado. Procure a administração.',
        desativado:'Seu acesso está desativado. Procure a administração.'
      };
      show(texts[profile.status]||'Seu acesso ainda não está liberado.','error');
      return;
    }

    const next=params.get('next');
    location.href=next&&/^[\w.-]+\.html$/.test(next)?`./${next}`:'./index.html';
  }catch(err){
    if(err.message==='LOGIN') show('E-mail ou senha incorretos.','error');
    else if(err.message==='TIMEOUT') show('A entrada demorou mais que o esperado. Tente novamente.','error');
    else show('Não foi possível validar seu acesso. Tente novamente.','error');
    try{ await sb.auth.signOut(); }catch{}
  }finally{
    btn.disabled=false;
    btn.textContent='ENTRAR';
  }
});
