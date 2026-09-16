import { sb, isConfigured } from './supabase.js';
export async function requireAuth(){if(!isConfigured()){location.href='./login.html?erro=config';return null}const {data,error}=await sb.auth.getSession();if(error||!data.session){const next=encodeURIComponent(location.pathname.split('/').pop()||'index.html');location.href=`./login.html?next=${next}`;return null}return data.session.user}
export async function getProfile(user){if(!user?.id||!sb)return null;const {data,error}=await sb.from('profiles').select('id,nome,email,role,ativo,status,avatar_path,created_at').eq('id',user.id).maybeSingle();if(error)return null;return data}
export async function signOut(event){event?.preventDefault?.();if(sb)await sb.auth.signOut();location.href='./login.html'}
export function avatarUrl(path){if(!path||!sb)return '';return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl}
