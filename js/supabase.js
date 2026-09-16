const SUPABASE_URL = 'https://zjnbmgkvnzdnaiszqhta.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vghGz23YWhZ4CNXMjkrslA_ZH1osJsI';

if (!window.supabase) console.error('Supabase JS não carregou.');
export const sb = (SUPABASE_URL.startsWith('http') && !SUPABASE_ANON_KEY.startsWith('COLE_'))
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
export const isConfigured = () => !!sb;
