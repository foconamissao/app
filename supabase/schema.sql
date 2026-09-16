-- FOCO NA MISSÃO — MISSÃO PE | Schema inicial
create extension if not exists pgcrypto;

create type public.user_role as enum ('aluno','admin');
create type public.atividade_tipo as enum ('teoria','questoes','flashcards','revisao','aula','simulado');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 nome text not null,
 role public.user_role not null default 'aluno',
 ativo boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.disciplinas (id bigint generated always as identity primary key,nome text not null unique,ordem int not null default 0,ativo boolean not null default true);
create table public.assuntos (id bigint generated always as identity primary key,disciplina_id bigint not null references public.disciplinas(id) on delete cascade,nome text not null,ativo boolean not null default true,unique(disciplina_id,nome));
create table public.questoes (
 id bigint generated always as identity primary key,disciplina_id bigint not null references public.disciplinas(id),assunto_id bigint references public.assuntos(id),banca text,concurso text,ano int,enunciado text not null,
 alternativa_a text not null,alternativa_b text not null,alternativa_c text not null,alternativa_d text not null,alternativa_e text,correta char(1) not null check(correta in ('A','B','C','D','E')),
 comentario text,palavra_chave text,macete text,ativo boolean not null default true,created_by uuid references public.profiles(id),created_at timestamptz not null default now()
);
create table public.respostas (id bigint generated always as identity primary key,user_id uuid not null references public.profiles(id) on delete cascade,questao_id bigint not null references public.questoes(id) on delete cascade,resposta char(1) not null,acertou boolean not null,tempo_segundos int,created_at timestamptz not null default now());
create index respostas_user_idx on public.respostas(user_id,created_at desc);
create index respostas_questao_idx on public.respostas(questao_id);
create table public.favoritos (user_id uuid references public.profiles(id) on delete cascade,questao_id bigint references public.questoes(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,questao_id));
create table public.caderno_erros (id bigint generated always as identity primary key,user_id uuid not null references public.profiles(id) on delete cascade,questao_id bigint not null references public.questoes(id) on delete cascade,erros int not null default 1,ultima_resposta char(1),dominado boolean not null default false,ultimo_erro timestamptz not null default now(),unique(user_id,questao_id));

create table public.flashcards (id bigint generated always as identity primary key,disciplina_id bigint not null references public.disciplinas(id),assunto_id bigint references public.assuntos(id),frente text not null,verso text not null,origem_questao_id bigint references public.questoes(id) on delete set null,ativo boolean not null default true,created_by uuid references public.profiles(id),created_at timestamptz not null default now());
create table public.flashcard_revisoes (id bigint generated always as identity primary key,user_id uuid not null references public.profiles(id) on delete cascade,flashcard_id bigint not null references public.flashcards(id) on delete cascade,dificuldade smallint not null check(dificuldade between 1 and 4),proxima_revisao date not null,reviewed_at timestamptz not null default now());

create table public.cronogramas (id bigint generated always as identity primary key,titulo text not null,data_inicio date not null,data_fim date,ativo boolean not null default true,created_by uuid references public.profiles(id),created_at timestamptz not null default now());
create table public.atividades (id bigint generated always as identity primary key,cronograma_id bigint references public.cronogramas(id) on delete cascade,data date not null,titulo text not null,descricao text,tipo public.atividade_tipo not null,disciplina_id bigint references public.disciplinas(id),assunto_id bigint references public.assuntos(id),meta_quantidade int,meta_minutos int,ordem int not null default 0,ativo boolean not null default true);
create table public.atividade_progresso (id bigint generated always as identity primary key,user_id uuid not null references public.profiles(id) on delete cascade,atividade_id bigint not null references public.atividades(id) on delete cascade,data date not null,concluida boolean not null default false,concluida_em timestamptz,unique(user_id,atividade_id));

-- Apenas simulados oficiais, criados pela administração.
create table public.simulados (id bigint generated always as identity primary key,titulo text not null,descricao text,data_liberacao timestamptz,data_encerramento timestamptz,duracao_minutos int not null,ativo boolean not null default true,created_by uuid references public.profiles(id),created_at timestamptz not null default now());
create table public.simulado_questoes (simulado_id bigint references public.simulados(id) on delete cascade,questao_id bigint references public.questoes(id) on delete cascade,ordem int not null,peso numeric(6,2) not null default 1,primary key(simulado_id,questao_id));
create table public.simulado_tentativas (id bigint generated always as identity primary key,simulado_id bigint not null references public.simulados(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,iniciada_em timestamptz not null default now(),finalizada_em timestamptz,pontuacao numeric(10,2),acertos int,tempo_segundos int,status text not null default 'em_andamento' check(status in ('em_andamento','finalizada')),unique(simulado_id,user_id));
create table public.simulado_respostas (tentativa_id bigint references public.simulado_tentativas(id) on delete cascade,questao_id bigint references public.questoes(id) on delete cascade,resposta char(1),acertou boolean,primary key(tentativa_id,questao_id));

create table public.xp_eventos (id bigint generated always as identity primary key,user_id uuid not null references public.profiles(id) on delete cascade,tipo text not null,pontos numeric(8,2) not null check(pontos>=0),referencia text,created_at timestamptz not null default now());
create view public.ranking_atual as select p.id,p.nome,coalesce(sum(x.pontos),0)::numeric(10,2) as xp from public.profiles p left join public.xp_eventos x on x.user_id=p.id where p.ativo=true group by p.id,p.nome order by xp desc;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,nome) values(new.id,coalesce(new.raw_user_meta_data->>'nome',split_part(new.email,'@',1))); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and ativo=true); $$;

alter table public.profiles enable row level security; alter table public.disciplinas enable row level security; alter table public.assuntos enable row level security; alter table public.questoes enable row level security; alter table public.respostas enable row level security; alter table public.favoritos enable row level security; alter table public.caderno_erros enable row level security; alter table public.flashcards enable row level security; alter table public.flashcard_revisoes enable row level security; alter table public.cronogramas enable row level security; alter table public.atividades enable row level security; alter table public.atividade_progresso enable row level security; alter table public.simulados enable row level security; alter table public.simulado_questoes enable row level security; alter table public.simulado_tentativas enable row level security; alter table public.simulado_respostas enable row level security; alter table public.xp_eventos enable row level security;

create policy "perfil proprio leitura" on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy "perfil proprio update" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy "admin profiles" on public.profiles for all using(public.is_admin()) with check(public.is_admin());
create policy "conteudo disciplinas leitura" on public.disciplinas for select to authenticated using(ativo=true or public.is_admin()); create policy "admin disciplinas" on public.disciplinas for all using(public.is_admin()) with check(public.is_admin());
create policy "conteudo assuntos leitura" on public.assuntos for select to authenticated using(ativo=true or public.is_admin()); create policy "admin assuntos" on public.assuntos for all using(public.is_admin()) with check(public.is_admin());
create policy "questoes leitura" on public.questoes for select to authenticated using(ativo=true or public.is_admin()); create policy "admin questoes" on public.questoes for all using(public.is_admin()) with check(public.is_admin());
create policy "respostas proprias" on public.respostas for all using(user_id=auth.uid()) with check(user_id=auth.uid()); create policy "admin respostas leitura" on public.respostas for select using(public.is_admin());
create policy "favoritos proprios" on public.favoritos for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "erros proprios" on public.caderno_erros for all using(user_id=auth.uid()) with check(user_id=auth.uid()); create policy "admin erros leitura" on public.caderno_erros for select using(public.is_admin());
create policy "flashcards leitura" on public.flashcards for select to authenticated using(ativo=true or public.is_admin()); create policy "admin flashcards" on public.flashcards for all using(public.is_admin()) with check(public.is_admin());
create policy "revisoes proprias" on public.flashcard_revisoes for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "cronogramas leitura" on public.cronogramas for select to authenticated using(ativo=true or public.is_admin()); create policy "admin cronogramas" on public.cronogramas for all using(public.is_admin()) with check(public.is_admin());
create policy "atividades leitura" on public.atividades for select to authenticated using(ativo=true or public.is_admin()); create policy "admin atividades" on public.atividades for all using(public.is_admin()) with check(public.is_admin());
create policy "progresso proprio" on public.atividade_progresso for all using(user_id=auth.uid()) with check(user_id=auth.uid()); create policy "admin progresso leitura" on public.atividade_progresso for select using(public.is_admin());
create policy "simulados leitura" on public.simulados for select to authenticated using(ativo=true or public.is_admin()); create policy "admin simulados" on public.simulados for all using(public.is_admin()) with check(public.is_admin());
create policy "simulado questoes leitura" on public.simulado_questoes for select to authenticated using(true); create policy "admin simulado questoes" on public.simulado_questoes for all using(public.is_admin()) with check(public.is_admin());
create policy "tentativas proprias" on public.simulado_tentativas for all using(user_id=auth.uid()) with check(user_id=auth.uid()); create policy "admin tentativas leitura" on public.simulado_tentativas for select using(public.is_admin());
create policy "simulado respostas proprias" on public.simulado_respostas for all using(exists(select 1 from public.simulado_tentativas t where t.id=tentativa_id and t.user_id=auth.uid())) with check(exists(select 1 from public.simulado_tentativas t where t.id=tentativa_id and t.user_id=auth.uid()));
create policy "xp proprio leitura" on public.xp_eventos for select using(user_id=auth.uid() or public.is_admin()); create policy "admin xp" on public.xp_eventos for all using(public.is_admin()) with check(public.is_admin());

grant select on public.ranking_atual to authenticated;
