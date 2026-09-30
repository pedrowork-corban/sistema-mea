-- ============================================================
-- Martinelle & Avelar — Fase 1 / Migration 1
-- Fundacao multi-tenant: organizacoes, papeis livres, usuarios
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- updated_at automatico
-- ------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- ORGANIZACOES
-- ------------------------------------------------------------
create table public.organizacoes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cnpj        text,
  cidade      text,
  criado_em   timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger set_updated_at before update on public.organizacoes
  for each row execute function public.tg_set_updated_at();

-- ------------------------------------------------------------
-- PAPEIS — o nome e as permissoes sao definidos pelo usuario.
-- permissoes e um JSONB de flags. Chaves conhecidas:
--   admin.org, admin.usuarios, admin.config
--   crm.ver, crm.ver_todos, crm.editar, crm.excluir
--   simulador.usar, simulador.tabelas
--   carteira.ver, carteira.ver_todas, carteira.editar
--   comissoes.ver   <-- PRIVADO: nasce sempre false
-- ------------------------------------------------------------
create table public.papeis (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  nome        text not null,
  descricao   text,
  permissoes  jsonb not null default '{}'::jsonb,
  sistema     boolean not null default false,  -- papel base, nao pode ser excluido
  criado_em   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, nome)
);
create trigger set_updated_at before update on public.papeis
  for each row execute function public.tg_set_updated_at();

-- ------------------------------------------------------------
-- USUARIOS (perfil ligado ao auth.users)
-- ------------------------------------------------------------
create table public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  papel_id    uuid references public.papeis(id) on delete set null,
  nome        text not null,
  email       text not null,
  telefone    text,
  avatar_url  text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.usuarios (org_id);
create trigger set_updated_at before update on public.usuarios
  for each row execute function public.tg_set_updated_at();

-- ------------------------------------------------------------
-- CONVITES — como novos usuarios entram na org
-- ------------------------------------------------------------
create table public.convites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  papel_id    uuid references public.papeis(id) on delete set null,
  email       text not null,
  nome        text,
  token       text not null unique default encode(gen_random_bytes(24), 'hex'),
  criado_por  uuid references public.usuarios(id) on delete set null,
  expira_em   timestamptz not null default (now() + interval '14 days'),
  aceito_em   timestamptz,
  criado_em   timestamptz not null default now()
);
create index on public.convites (org_id);
create index on public.convites (lower(email));

-- ============================================================
-- HELPERS DE AUTORIZACAO
-- SECURITY DEFINER + search_path fixo para nao recursar na RLS.
-- ============================================================

create or replace function public.org_atual()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select org_id from public.usuarios where id = auth.uid() and ativo;
$$;

create or replace function public.tem_permissao(chave text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (p.permissoes ->> 'admin.org')::boolean
       from public.usuarios u join public.papeis p on p.id = u.papel_id
      where u.id = auth.uid() and u.ativo),
    false)
  or coalesce(
    (select (p.permissoes ->> chave)::boolean
       from public.usuarios u join public.papeis p on p.id = u.papel_id
      where u.id = auth.uid() and u.ativo),
    false);
$$;

-- membro ativo da mesma org do registro
create or replace function public.mesma_org(alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select alvo is not null and alvo = public.org_atual();
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.organizacoes enable row level security;
alter table public.papeis       enable row level security;
alter table public.usuarios     enable row level security;
alter table public.convites     enable row level security;

-- ORGANIZACOES
create policy org_select on public.organizacoes
  for select using (id = public.org_atual());
create policy org_update on public.organizacoes
  for update using (id = public.org_atual() and public.tem_permissao('admin.org'));

-- PAPEIS: todo mundo da org le (precisa pra montar a UI); so admin escreve
create policy papeis_select on public.papeis
  for select using (public.mesma_org(org_id));
create policy papeis_insert on public.papeis
  for insert with check (public.mesma_org(org_id) and public.tem_permissao('admin.usuarios'));
create policy papeis_update on public.papeis
  for update using (public.mesma_org(org_id) and public.tem_permissao('admin.usuarios'));
create policy papeis_delete on public.papeis
  for delete using (public.mesma_org(org_id) and public.tem_permissao('admin.usuarios') and not sistema);

-- USUARIOS
create policy usuarios_select_self on public.usuarios
  for select using (id = auth.uid());
create policy usuarios_select_org on public.usuarios
  for select using (public.mesma_org(org_id));
create policy usuarios_update_self on public.usuarios
  for update using (id = auth.uid())
  with check (id = auth.uid() and org_id = public.org_atual());
create policy usuarios_admin_insert on public.usuarios
  for insert with check (public.mesma_org(org_id) and public.tem_permissao('admin.usuarios'));
create policy usuarios_admin_update on public.usuarios
  for update using (public.mesma_org(org_id) and public.tem_permissao('admin.usuarios'));
create policy usuarios_admin_delete on public.usuarios
  for delete using (public.mesma_org(org_id) and public.tem_permissao('admin.usuarios') and id <> auth.uid());

-- CONVITES
create policy convites_admin on public.convites
  for all using (public.mesma_org(org_id) and public.tem_permissao('admin.usuarios'))
  with check (public.mesma_org(org_id) and public.tem_permissao('admin.usuarios'));

-- ============================================================
-- BOOTSTRAP: primeiro cadastro cria a org e vira Administrador.
-- Convidado (existe convite valido) entra na org do convite.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_convite  public.convites%rowtype;
  v_org      uuid;
  v_papel    uuid;
  v_nome     text;
begin
  v_nome := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
                     split_part(new.email, '@', 1));

  select * into v_convite
    from public.convites
   where lower(email) = lower(new.email)
     and aceito_em is null
     and expira_em > now()
   order by criado_em desc
   limit 1;

  if found then
    insert into public.usuarios (id, org_id, papel_id, nome, email)
    values (new.id, v_convite.org_id, v_convite.papel_id,
            coalesce(v_convite.nome, v_nome), new.email);
    update public.convites set aceito_em = now() where id = v_convite.id;
    return new;
  end if;

  -- sem convite: cria org propria
  insert into public.organizacoes (nome)
  values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'organizacao'), ''),
                   'Minha empresa'))
  returning id into v_org;

  -- papeis base. comissoes.ver = false em todos, exceto Administrador.
  insert into public.papeis (org_id, nome, descricao, sistema, permissoes) values
    (v_org, 'Administrador', 'Acesso total, inclusive comissoes', true, jsonb_build_object(
      'admin.org', true, 'admin.usuarios', true, 'admin.config', true,
      'crm.ver', true, 'crm.ver_todos', true, 'crm.editar', true, 'crm.excluir', true,
      'simulador.usar', true, 'simulador.tabelas', true,
      'carteira.ver', true, 'carteira.ver_todas', true, 'carteira.editar', true,
      'comissoes.ver', true)),
    (v_org, 'Gerente', 'Ve tudo da operacao, sem comissoes', false, jsonb_build_object(
      'admin.usuarios', false, 'admin.config', false,
      'crm.ver', true, 'crm.ver_todos', true, 'crm.editar', true, 'crm.excluir', false,
      'simulador.usar', true, 'simulador.tabelas', false,
      'carteira.ver', true, 'carteira.ver_todas', true, 'carteira.editar', true,
      'comissoes.ver', false)),
    (v_org, 'Vendedor', 'Ve e trabalha apenas a propria carteira', false, jsonb_build_object(
      'crm.ver', true, 'crm.ver_todos', false, 'crm.editar', true, 'crm.excluir', false,
      'simulador.usar', true, 'simulador.tabelas', false,
      'carteira.ver', true, 'carteira.ver_todas', false, 'carteira.editar', true,
      'comissoes.ver', false)),
    (v_org, 'Indicadora', 'Apenas cadastra indicacoes e acompanha as suas', false, jsonb_build_object(
      'crm.ver', true, 'crm.ver_todos', false, 'crm.editar', true, 'crm.excluir', false,
      'simulador.usar', false, 'simulador.tabelas', false,
      'carteira.ver', false, 'carteira.ver_todas', false, 'carteira.editar', false,
      'comissoes.ver', false));

  select id into v_papel from public.papeis
   where org_id = v_org and nome = 'Administrador';

  insert into public.usuarios (id, org_id, papel_id, nome, email)
  values (new.id, v_org, v_papel, v_nome, new.email);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
