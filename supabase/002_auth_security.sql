-- MISSÃO PE — patch de autenticação e segurança
-- Execute este arquivo UMA VEZ no SQL Editor se você já executou schema.sql anteriormente.

-- Impede que um aluno altere diretamente o próprio campo role para admin.
drop policy if exists "perfil proprio update" on public.profiles;

-- O próprio usuário pode alterar somente o nome por meio desta função.
create or replace function public.update_my_name(new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  if nullif(trim(new_name), '') is null then
    raise exception 'Nome inválido';
  end if;
  update public.profiles
     set nome = trim(new_name)
   where id = auth.uid();
end;
$$;

revoke all on function public.update_my_name(text) from public;
grant execute on function public.update_my_name(text) to authenticated;

-- Mantém administração total de profiles exclusivamente para administradores.
drop policy if exists "admin profiles" on public.profiles;
create policy "admin profiles"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
