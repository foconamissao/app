import {requireAuth,getProfile,signOut,avatarUrl} from './auth.js';

const labels={dashboard:'Início',missao:'Minha Missão',cronograma:'Cronograma',questoes:'Questões',flashcards:'Flashcards',erros:'Caderno de Erros',simulados:'Simulados',desempenho:'Desempenho',ranking:'Ranking',admin:'Administração',perfil:'Meu perfil'};

function initials(name=''){
  return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'FM';
}

function formatNow(date=new Date()){
  const datePart=new Intl.DateTimeFormat('pt-BR',{
    weekday:'long',day:'2-digit',month:'long',year:'numeric'
  }).format(date);
  const timePart=new Intl.DateTimeFormat('pt-BR',{
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).format(date);
  return `${datePart}, ${timePart}`;
}

function mountDateTime(container){
  const clock=document.createElement('time');
  clock.className='header-datetime';
  clock.setAttribute('aria-label','Data e hora atuais');
  const update=()=>{
    const now=new Date();
    clock.dateTime=now.toISOString();
    clock.textContent=formatNow(now);
  };
  update();
  const timer=setInterval(update,1000);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  container.appendChild(clock);
}

function mountAccount(profile,container){
  const wrap=document.createElement('div');
  wrap.className='account-wrap';
  const img=profile.avatar_path
    ? `<img src="${avatarUrl(profile.avatar_path)}?v=${Date.now()}" alt="Foto de ${profile.nome||'participante'}">`
    : `<span>${initials(profile.nome)}</span>`;
  wrap.innerHTML=`<div class="account-avatar">${img}</div><b class="account-name">${profile.nome||'Participante'}</b><button class="account-gear" type="button" aria-label="Opções da conta" aria-expanded="false">⚙</button><div class="account-menu hidden"><a href="./admin.html#perfil" class="profile-link">👤 Editar perfil</a><button type="button" class="logout-menu">🚪 Sair</button></div>`;
  container.appendChild(wrap);
  const gear=wrap.querySelector('.account-gear');
  const menu=wrap.querySelector('.account-menu');
  gear.addEventListener('click',()=>{
    const opening=menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    gear.setAttribute('aria-expanded',String(opening));
  });
  wrap.querySelector('.logout-menu').addEventListener('click',signOut);
  document.addEventListener('click',e=>{
    if(!wrap.contains(e.target)){
      menu.classList.add('hidden');
      gear.setAttribute('aria-expanded','false');
    }
  });
  if(profile.role!=='admin')wrap.querySelector('.profile-link').href='./perfil.html';
}

function mountHeader(profile){
  const top=document.querySelector('.topbar');
  if(!top)return;

  // Remove componentes antigos do cabeçalho, inclusive o círculo legado sem função.
  top.querySelectorAll('.toolbar,#userName,.avatar,.account-wrap,.topbar-right,.header-datetime').forEach(el=>el.remove());

  const right=document.createElement('div');
  right.className='topbar-right';
  mountDateTime(right);
  mountAccount(profile,right);
  top.appendChild(right);
}

export async function boot(page){
  const user=await requireAuth();
  if(!user)return null;
  const profile=await getProfile(user);
  if(!profile){
    document.body.innerHTML='<main class="login-shell"><section class="login-card"><h1>Cadastro não encontrado</h1><p>Não foi possível carregar seu cadastro.</p><a class="btn" href="./login.html">VOLTAR</a></section></main>';
    return null;
  }
  if(profile.status!=='aprovado'||!profile.ativo){
    await signOut();
    return null;
  }

  document.querySelector('#pageTitle')?.replaceChildren(document.createTextNode(labels[page]||'Missão PE'));
  document.querySelector(`[data-nav="${page}"]`)?.classList.add('active');
  if(profile.role==='admin'){
    document.querySelectorAll('[data-admin]').forEach(el=>el.classList.remove('hidden'));
  }else if(page==='admin'){
    location.href='./index.html';
    return null;
  }

  mountHeader(profile);
  document.querySelector('#logout')?.addEventListener('click',signOut);

  const side=document.querySelector('.sidebar');
  const overlay=document.querySelector('.overlay');
  document.querySelector('#mobileMenu')?.addEventListener('click',()=>{
    side?.classList.toggle('open');
    overlay?.classList.toggle('open');
  });
  overlay?.addEventListener('click',()=>{
    side?.classList.remove('open');
    overlay?.classList.remove('open');
  });
  return{user,profile};
}
