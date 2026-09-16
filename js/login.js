import { sb, isConfigured } from './supabase.js';

const form = document.querySelector('#loginForm');
const msg = document.querySelector('#msg');
const button = form?.querySelector('button[type="submit"]') || form?.querySelector('button');
const params = new URLSearchParams(location.search);

function show(text, type = 'info') {
  msg.textContent = text;
  msg.className = `notice ${type}`;
}

if (!isConfigured()) {
  show('A conexão com o Supabase ainda não está configurada.', 'error');
  if (button) button.disabled = true;
} else {
  const { data } = await sb.auth.getSession();
  if (data.session) location.href = './index.html';
  if (params.get('erro') === 'sessao') show('Não foi possível recuperar sua sessão. Entre novamente.', 'error');
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!sb) return;

  const email = form.email.value.trim();
  const password = form.password.value;
  button.disabled = true;
  button.textContent = 'ENTRANDO...';
  show('Validando acesso...');

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    button.disabled = false;
    button.textContent = 'ENTRAR';
    show(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message, 'error');
    return;
  }

  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('ativo')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await sb.auth.signOut();
    button.disabled = false;
    button.textContent = 'ENTRAR';
    show('Sua conta existe, mas o perfil da plataforma não foi criado. Verifique o trigger do Supabase.', 'error');
    return;
  }

  if (!profile.ativo) {
    await sb.auth.signOut();
    button.disabled = false;
    button.textContent = 'ENTRAR';
    show('Seu acesso está desativado. Procure a administração.', 'error');
    return;
  }

  const next = params.get('next');
  location.href = next && /^[\w.-]+\.html$/.test(next) ? `./${next}` : './index.html';
});
