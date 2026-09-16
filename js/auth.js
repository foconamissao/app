import { sb, isConfigured } from './supabase.js';

export async function requireAuth(){
  if(!isConfigured()){
    location.href='./login.html?erro=config';
    return null;
  }
  const {data,error}=await sb.auth.getSession();
  if(error||!data.session){
    const next=encodeURIComponent(location.pathname.split('/').pop()||'index.html');
    location.href=`./login.html?next=${next}`;
    return null;
  }
  return data.session.user;
}

export async function getProfile(user){
  if(!user?.id||!sb) return null;
  try{
    const {data,error}=await sb.rpc('get_my_profile');
    if(error) return null;
    return Array.isArray(data) ? (data[0]||null) : (data||null);
  }catch{
    return null;
  }
}

export async function signOut(event){
  event?.preventDefault?.();
  if(sb) await sb.auth.signOut();
  location.href='./login.html';
}

export function avatarUrl(path){
  if(!path||!sb)return '';
  return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
