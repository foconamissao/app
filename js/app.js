import { requireAuth, getProfile, signOut } from './auth.js';

const labels = {dashboard:'Início',missao:'Minha Missão',cronograma:'Cronograma',questoes:'Questões',flashcards:'Flashcards',erros:'Caderno de Erros',simulados:'Simulados',desempenho:'Desempenho',ranking:'Ranking',admin:'Administração'};

export async function boot(page) {
  const user = await requireAuth();
  if (!user) return null;

  const profile = await getProfile(user);
  if (!profile) {
    document.body.innerHTML = '<main class="login-shell"><section class="login-card"><h1>Perfil não encontrado</h1><p>Não foi possível carregar os dados do seu perfil. Procure a administração.</p><a class="btn" href="./login.html">VOLTAR AO LOGIN</a></section></main>';
    return null;
  }
  if (!profile.ativo) {
    await signOut();
    return null;
  }

  const userName = document.querySelector('#userName');
  if (userName) userName.textContent = profile.nome || user.email || 'Aluno';
  const title = document.querySelector('#pageTitle');
  if (title) title.textContent = labels[page] || 'Missão PE';
  document.querySelector(`[data-nav="${page}"]`)?.classList.add('active');

  if (profile.role === 'admin') {
    document.querySelectorAll('[data-admin]').forEach((el) => el.classList.remove('hidden'));
  } else if (page === 'admin') {
    location.href = './index.html';
    return null;
  }

  document.querySelector('#logout')?.addEventListener('click', signOut);
  const side = document.querySelector('.sidebar');
  const overlay = document.querySelector('.overlay');
  document.querySelector('#mobileMenu')?.addEventListener('click', () => {
    side?.classList.toggle('open');
    overlay?.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    side?.classList.remove('open');
    overlay?.classList.remove('open');
  });

  return { user, profile };
}
