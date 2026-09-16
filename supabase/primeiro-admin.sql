-- MISSÃO PE — promover o primeiro administrador
-- 1) Crie o usuário em Authentication > Users no painel do Supabase.
-- 2) Troque o e-mail abaixo pelo e-mail desse usuário.
-- 3) Execute este arquivo no SQL Editor.

update public.profiles
set role = 'admin', ativo = true
where id = (
  select id from auth.users
  where email = 'SEU-EMAIL-AQUI@EXEMPLO.COM'
);

-- Confirmação: deve retornar o usuário com role = admin.
select p.id, p.nome, u.email, p.role, p.ativo
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'SEU-EMAIL-AQUI@EXEMPLO.COM';
