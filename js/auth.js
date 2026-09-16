import { sb, isConfigured } from './supabase.js';
export async function requireAuth(){if(!isConfigured()) return {id:'demo',email:'demo@missao.pe',demo:true}; const {data:{session}}=await sb.auth.getSession(); if(!session){location.href='./login.html';return null} return session.user}
export async function getProfile(user){if(user?.demo)return {nome:'Modo demonstração',role:'admin'}; const {data}=await sb.from('profiles').select('*').eq('id',user.id).single(); return data}
export async function signOut(){if(sb) await sb.auth.signOut(); location.href='./login.html'}
