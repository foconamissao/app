# Foco na Missão — Missão PE

V1.0.1 — fundação conectada ao novo Supabase.

## Estado desta versão
- Projeto totalmente independente da antiga PPRN.
- Supabase novo configurado no `js/supabase.js` com Project URL + Publishable Key.
- Login real via Supabase Auth.
- Sessão persistente e logout.
- Perfis `aluno` e `admin`.
- Menu Administração visível somente para administradores.
- RLS habilitado.
- Somente simulados oficiais; não existe módulo de simulado personalizado.

## IMPORTANTE — faça agora no Supabase
Como o `schema.sql` já foi executado antes desta correção, abra **SQL Editor** e execute:

`supabase/002_auth_security.sql`

Esse patch corrige uma permissão da primeira versão do schema para impedir que um aluno altere o próprio `role` diretamente.

## Criar o primeiro administrador
1. No Supabase, abra **Authentication > Users**.
2. Crie o usuário que será o administrador (e-mail e senha).
3. O trigger `handle_new_user` criará automaticamente a linha correspondente em `public.profiles` como `aluno`.
4. Abra `supabase/primeiro-admin.sql`.
5. Substitua `SEU-EMAIL-AQUI@EXEMPLO.COM` pelo e-mail criado.
6. Execute no **SQL Editor**.
7. Abra o GitHub Pages e entre com esse e-mail e senha.
8. O item **Administração** deverá aparecer no menu.

## Se estiver criando outro banco do zero
Execute somente `supabase/schema.sql`; ele já contém a correção de segurança desta versão. Depois use `supabase/primeiro-admin.sql` para promover o primeiro administrador.

## Publicação no GitHub Pages
Substitua os arquivos do repositório pelos desta versão e faça commit/push. Não é necessário esconder a Publishable Key; nunca coloque `service_role` ou `sb_secret_...` no front-end.

## Próxima etapa
Com login/admin validado, a próxima implementação será o cadastro administrativo de disciplinas e assuntos e, em seguida, Missão do Dia + Cronograma.
