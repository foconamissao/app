const SUPABASE_URL = 'https://zjnbmgkvnzdnaiszqhta.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vghGz23YWhZ4CNXMjkrslA_ZH1osJsI';

if (!window.supabase) console.error('Supabase JS não carregou.');

const configured =
  typeof window.supabase !== 'undefined' &&
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_KEY.startsWith('sb_publishable_');

export const sb = configured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const isConfigured = () => configured && !!sb;
