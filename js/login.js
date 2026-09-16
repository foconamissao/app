import { sb, isConfigured } from './supabase.js';
const form=document.querySelector('#loginForm');
const msg=document.querySelector('#msg');
const params=new URLSearchParams(location.search);
function show(text,type='info'){msg.textContent=text;msg.className=`notice ${type}`;}
if(!isConfigured()){
  show('Não foi possível iniciar a plataforma. Tente novamente mais tarde.','error');
  form?.querySelector('button[type="submit"]')?.setAttribute('disabled','');
}else{
  const {data}=await sb.auth.getSession();
  if(data.session) location.href='./index.html';
  if(params.get('erro')==='sessao') show('Sua sessão expirou. Entre novamente.','error');
}
form?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!isConfigured()) return;
  const btn=form.querySelector('button[type="submit"]');
  const email=form.elements.email.value.trim();
  const password=form.elements.password.value;
  btn.disabled=true; btn.textContent='ENTRANDO...'; show('Verificando seu acesso...');
  try{
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error) throw new Error('LOGIN');
    const {data:p,error:pe}=await sb.from('profiles').select('status,ativo').eq('id',data.user.id).maybeSingle();
    if(pe||!p){await sb.auth.signOut();return show('Não foi possível carregar seu cadastro. Tente novamente.','error');}
    if(p.status!=='aprovado'||!p.ativo){
      await sb.auth.signOut();
      const texts={pendente:'Seu cadastro está aguardando aprovação da administração.',nao_aprovado:'Seu cadastro não foi aprovado. Procure a administração.',desativado:'Seu acesso está desativado. Procure a administração.'};
      return show(texts[p.status]||'Seu acesso ainda não está liberado.','error');
    }
    const next=params.get('next');
    location.href=next&&/^[\w.-]+\.html$/.test(next)?`./${next}`:'./index.html';
  }catch(err){
    show(err.message==='LOGIN'?'E-mail ou senha incorretos.':'Não foi possível entrar agora. Tente novamente.','error');
  }finally{
    btn.disabled=false; btn.textContent='ENTRAR';
  }
});
