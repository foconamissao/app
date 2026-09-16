import { sb, isConfigured } from './supabase.js';
const $=(s)=>document.querySelector(s);
const msg=$('#msg'), loginForm=$('#loginForm'), registerForm=$('#registerForm');
const params=new URLSearchParams(location.search);
function show(text,type='info'){msg.textContent=text;msg.className=`notice ${type}`;}
function mode(which){
  const reg=which==='register'; loginForm.classList.toggle('hidden',reg); registerForm.classList.toggle('hidden',!reg);
  $('#loginTab').classList.toggle('active',!reg); $('#registerTab').classList.toggle('active',reg); show('','muted');
}
$('#loginTab')?.addEventListener('click',()=>mode('login')); $('#registerTab')?.addEventListener('click',()=>mode('register'));
if(!isConfigured()){show('Não foi possível iniciar a plataforma. Tente novamente mais tarde.','error');document.querySelectorAll('button').forEach(b=>b.disabled=true);} else {
  const {data}=await sb.auth.getSession(); if(data.session) location.href='./index.html';
  if(params.get('erro')==='sessao') show('Sua sessão expirou. Entre novamente.','error');
}
loginForm?.addEventListener('submit',async e=>{
 e.preventDefault(); const btn=loginForm.querySelector('[type=submit]'); btn.disabled=true;btn.textContent='ENTRANDO...';show('Verificando seu acesso...');
 const {data,error}=await sb.auth.signInWithPassword({email:loginForm.email.value.trim(),password:loginForm.password.value});
 if(error){btn.disabled=false;btn.textContent='ENTRAR';return show('E-mail ou senha incorretos.','error');}
 const {data:p,error:pe}=await sb.from('profiles').select('status,ativo').eq('id',data.user.id).maybeSingle();
 if(pe||!p){await sb.auth.signOut();btn.disabled=false;btn.textContent='ENTRAR';return show('Não foi possível carregar seu cadastro. Tente novamente.','error');}
 if(p.status!=='aprovado'||!p.ativo){await sb.auth.signOut();btn.disabled=false;btn.textContent='ENTRAR';const texts={pendente:'Seu cadastro está aguardando aprovação da administração.',nao_aprovado:'Seu cadastro não foi aprovado. Procure a administração.',desativado:'Seu acesso está desativado. Procure a administração.'};return show(texts[p.status]||'Seu acesso ainda não está liberado.','error');}
 const next=params.get('next');location.href=next&&/^[\w.-]+\.html$/.test(next)?`./${next}`:'./index.html';
});
registerForm?.addEventListener('submit',async e=>{
 e.preventDefault(); const f=registerForm,btn=f.querySelector('[type=submit]'),nome=f.nome.value.trim(),email=f.email.value.trim(),senha=f.password.value,confirm=f.confirm.value;
 if(nome.length<2)return show('Informe seu nome.','error'); if(senha.length<6)return show('A senha deve ter pelo menos 6 caracteres.','error'); if(senha!==confirm)return show('As senhas não coincidem.','error');
 btn.disabled=true;btn.textContent='CRIANDO...';show('Enviando seu cadastro...');
 const {error}=await sb.auth.signUp({email,password:senha,options:{data:{nome}}}); btn.disabled=false;btn.textContent='CRIAR MINHA CONTA';
 if(error){if(/already|registered/i.test(error.message))return show('Este e-mail já possui cadastro.','error');return show('Não foi possível criar sua conta. Confira os dados e tente novamente.','error');}
 f.reset(); show('Cadastro recebido! Seu acesso está aguardando aprovação da administração.','success');
});
