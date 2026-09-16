const SUPABASE_URL = 'COLE_AQUI_SUA_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'COLE_AQUI_SUA_SUPABASE_ANON_KEY';

if (!window.supabase) console.error('Supabase JS não carregou.');
export const sb = (SUPABASE_URL.startsWith('http') && !SUPABASE_ANON_KEY.startsWith('COLE_'))
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
export const isConfigured = () => !!sb;
