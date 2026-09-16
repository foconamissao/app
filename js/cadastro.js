import { sb, isConfigured } from './supabase.js';
const form=document.querySelector('#registerForm');
const msg=document.querySelector('#msg');
function show(text,type='info'){msg.textContent=text;msg.className=`notice ${type}`;}
if(!isConfigured()){
  show('Não foi possível iniciar a plataforma. Tente novamente mais tarde.','error');
  form?.querySelector('button[type="submit"]')?.setAttribute('disabled','');
}
form?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!isConfigured()) return;
  const nome=form.elements.nome.value.trim();
  const email=form.elements.email.value.trim();
  const senha=form.elements.password.value;
  const confirm=form.elements.confirm.value;
  const btn=form.querySelector('button[type="submit"]');
  if(nome.length<2)return show('Informe seu nome.','error');
  if(senha.length<6)return show('A senha deve ter pelo menos 6 caracteres.','error');
  if(senha!==confirm)return show('As senhas não coincidem.','error');
  btn.disabled=true; btn.textContent='CRIANDO...'; show('Enviando seu cadastro...');
  try{
    const {data,error}=await sb.auth.signUp({email,password:senha,options:{data:{nome}}});
    if(error){
      if(/already|registered|exists/i.test(error.message)) return show('Este e-mail já possui cadastro.','error');
      return show('Não foi possível criar sua conta. Confira os dados e tente novamente.','error');
    }
    if(!data.user) return show('Não foi possível concluir o cadastro. Tente novamente.','error');
    await sb.auth.signOut();
    form.reset();
    form.classList.add('hidden');
    show('Cadastro recebido! Seu acesso está aguardando aprovação da administração.','success');
  }catch{
    show('Não foi possível criar sua conta agora. Tente novamente.','error');
  }finally{
    btn.disabled=false; btn.textContent='CRIAR MINHA CONTA';
  }
});
