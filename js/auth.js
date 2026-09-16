import { sb, isConfigured } from './supabase.js';

export async function requireAuth() {
  if (!isConfigured()) {
    location.href = './login.html?erro=config';
    return null;
  }

  const { data, error } = await sb.auth.getSession();
  if (error) {
    console.error('Erro ao recuperar sessão:', error);
    location.href = './login.html?erro=sessao';
    return null;
  }

  if (!data.session) {
    const next = encodeURIComponent(location.pathname.split('/').pop() || 'index.html');
    location.href = `./login.html?next=${next}`;
    return null;
  }

  return data.session.user;
}

export async function getProfile(user) {
  if (!user?.id || !sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('id,nome,role,ativo,created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar perfil:', error);
    return null;
  }
  return data;
}

export async function signOut(event) {
  event?.preventDefault?.();
  if (sb) await sb.auth.signOut();
  location.href = './login.html';
}
