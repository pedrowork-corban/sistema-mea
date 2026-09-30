-- ============================================================
-- Martinelle & Avelar — Fase 1 / Migration 2
-- CRM: etapas, origens, parceiros, contatos, interacoes
-- ============================================================

create type public.tipo_etapa       as enum ('aberta', 'ganha', 'perdida');
create type public.temperatura      as enum ('quente', 'morno', 'frio');
create type public.tipo_interacao   as enum ('whatsapp', 'ligacao', 'reuniao', 'email', 'presencial', 'nota');
create type public.tipo_parceiro    as enum ('autoescola', 'concessionaria', 'imobiliaria', 'gerente', 'outro');

-- ------------------------------------------------------------
-- ETAPAS do pipeline (configuraveis)
-- ------------------------------------------------------------
create table public.etapas (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacoes(id) on delete cascade,
  nome       text not null,
  ordem      int  not null default 0,
  cor        text not null default '#7F7979',
  tipo       public.tipo_etapa not null default 'aberta',
  criado_em  timestamptz not null default now(),
  unique (org_id, nome)
);
create index on public.etapas (org_id, ordem);

-- ------------------------------------------------------------
-- ORIGENS de lead (configuraveis)
-- ------------------------------------------------------------
create table public.origens (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacoes(id) on delete cascade,
  nome       text not null,
  ativa      boolean not null default true,
  criado_em  timestamptz not null default now(),
  unique (org_id, nome)
);

-- ------------------------------------------------------------
-- PARCEIROS (autoescola, concessionaria, imobiliaria, gerente BB)
-- ------------------------------------------------------------
create table public.parceiros (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacoes(id) on delete cascade,
  nome       text not null,
  tipo       public.tipo_parceiro not null default 'outro',
  contato    text,
  telefone   text,
  endereco   text,
  cidade     text,
  ativo      boolean not null default true,
  obs        text,
  criado_em  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.parceiros (org_id);
create trigger set_updated_at before update on public.parceiros
  for each row execute function public.tg_set_updated_at();

-- ------------------------------------------------------------
-- CONTATOS (o coracao do CRM)
-- ------------------------------------------------------------
create table public.contatos (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacoes(id) on delete cascade,
  nome            text not null,
  telefone        text,
  email           text,
  cpf             text,
  cidade          text,

  origem_id       uuid references public.origens(id)   on delete set null,
  parceiro_id     uuid references public.parceiros(id) on delete set null,
  indicado_por_id uuid references public.usuarios(id)  on delete set null,
  indicado_por    text,  -- indicador externo sem cadastro (ex.: "Bruna")

  interesse       text,  -- Carro, Imovel, Caminhao, Investimento, Carta contemplada...
  valor_estimado  numeric(14,2),

  etapa_id        uuid references public.etapas(id) on delete set null,
  temperatura     public.temperatura not null default 'frio',
  responsavel_id  uuid references public.usuarios(id) on delete set null,

  ultimo_contato_em date,
  proxima_acao_em   date,
  proxima_acao      text,

  obs        text,
  tags       text[] not null default '{}',
  arquivado  boolean not null default false,
  ordem      int not null default 0,   -- posicao dentro da coluna do kanban

  criado_por uuid references public.usuarios(id) on delete set null,
  criado_em  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.contatos (org_id, etapa_id);
create index on public.contatos (org_id, responsavel_id);
create index on public.contatos (org_id, proxima_acao_em);
create index on public.contatos using gin (tags);
create trigger set_updated_at before update on public.contatos
  for each row execute function public.tg_set_updated_at();

-- ------------------------------------------------------------
-- INTERACOES (historico)
-- ------------------------------------------------------------
create table public.interacoes (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacoes(id) on delete cascade,
  contato_id   uuid not null references public.contatos(id) on delete cascade,
  usuario_id   uuid references public.usuarios(id) on delete set null,
  data         timestamptz not null default now(),
  tipo         public.tipo_interacao not null default 'whatsapp',
  resumo       text not null,
  etapa_antes  uuid references public.etapas(id) on delete set null,
  etapa_depois uuid references public.etapas(id) on delete set null,
  criado_em    timestamptz not null default now()
);
create index on public.interacoes (contato_id, data desc);
create index on public.interacoes (org_id);

-- Registrar interacao atualiza o ultimo_contato do contato.
create or replace function public.tg_interacao_atualiza_contato()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo <> 'nota' then
    update public.contatos
       set ultimo_contato_em = greatest(coalesce(ultimo_contato_em, new.data::date), new.data::date)
     where id = new.contato_id;
  end if;
  return new;
end;
$$;
create trigger interacao_atualiza_contato
  after insert on public.interacoes
  for each row execute function public.tg_interacao_atualiza_contato();

-- ============================================================
-- RLS
-- "crm.ver_todos" ve a org inteira.
-- Sem ele, so ve contatos onde e responsavel, indicador ou criador.
-- ============================================================
alter table public.etapas     enable row level security;
alter table public.origens    enable row level security;
alter table public.parceiros  enable row level security;
alter table public.contatos   enable row level security;
alter table public.interacoes enable row level security;

-- Tabelas de apoio: qualquer membro le, quem tem admin.config escreve.
create policy etapas_select on public.etapas
  for select using (public.mesma_org(org_id));
create policy etapas_write on public.etapas
  for all using (public.mesma_org(org_id) and public.tem_permissao('admin.config'))
  with check (public.mesma_org(org_id) and public.tem_permissao('admin.config'));

create policy origens_select on public.origens
  for select using (public.mesma_org(org_id));
create policy origens_write on public.origens
  for all using (public.mesma_org(org_id) and public.tem_permissao('admin.config'))
  with check (public.mesma_org(org_id) and public.tem_permissao('admin.config'));

create policy parceiros_select on public.parceiros
  for select using (public.mesma_org(org_id) and public.tem_permissao('crm.ver'));
create policy parceiros_write on public.parceiros
  for all using (public.mesma_org(org_id) and public.tem_permissao('crm.editar'))
  with check (public.mesma_org(org_id) and public.tem_permissao('crm.editar'));

-- Visibilidade de contato
create or replace function public.pode_ver_contato(
  p_org uuid, p_responsavel uuid, p_indicador uuid, p_criador uuid)
returns boolean
language sql
stable
as $$
  select p_org = public.org_atual()
     and public.tem_permissao('crm.ver')
     and (
       public.tem_permissao('crm.ver_todos')
       or auth.uid() in (p_responsavel, p_indicador, p_criador)
     );
$$;

create policy contatos_select on public.contatos
  for select using (public.pode_ver_contato(org_id, responsavel_id, indicado_por_id, criado_por));
create policy contatos_insert on public.contatos
  for insert with check (public.mesma_org(org_id) and public.tem_permissao('crm.editar'));
create policy contatos_update on public.contatos
  for update using (
    public.tem_permissao('crm.editar')
    and public.pode_ver_contato(org_id, responsavel_id, indicado_por_id, criado_por));
create policy contatos_delete on public.contatos
  for delete using (public.mesma_org(org_id) and public.tem_permissao('crm.excluir'));

-- Interacoes seguem a visibilidade do contato
create policy interacoes_select on public.interacoes
  for select using (exists (
    select 1 from public.contatos c
     where c.id = interacoes.contato_id
       and public.pode_ver_contato(c.org_id, c.responsavel_id, c.indicado_por_id, c.criado_por)));
create policy interacoes_insert on public.interacoes
  for insert with check (
    public.tem_permissao('crm.editar')
    and exists (
      select 1 from public.contatos c
       where c.id = interacoes.contato_id
         and public.pode_ver_contato(c.org_id, c.responsavel_id, c.indicado_por_id, c.criado_por)));
create policy interacoes_update on public.interacoes
  for update using (usuario_id = auth.uid() or public.tem_permissao('crm.excluir'));
create policy interacoes_delete on public.interacoes
  for delete using (usuario_id = auth.uid() or public.tem_permissao('crm.excluir'));

-- ============================================================
-- Seeds padrao na criacao da org (roda junto do handle_new_user)
-- ============================================================
create or replace function public.seed_org(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.etapas (org_id, nome, ordem, cor, tipo) values
    (p_org, 'Novo lead',  1, '#0B5394', 'aberta'),
    (p_org, 'Aquecer',    2, '#7F6000', 'aberta'),
    (p_org, 'Negociando', 3, '#B45F06', 'aberta'),
    (p_org, 'Fechar',     4, '#000F30', 'aberta'),
    (p_org, 'Fechado',    5, '#2E7D32', 'ganha'),
    (p_org, 'Perdido',    6, '#C0392B', 'perdida')
  on conflict do nothing;

  insert into public.origens (org_id, nome) values
    (p_org, 'Indicação'),
    (p_org, 'Indicação interna'),
    (p_org, 'Lista fria'),
    (p_org, 'Carteira antiga'),
    (p_org, 'Tráfego pago'),
    (p_org, 'Classificado'),
    (p_org, 'Site'),
    (p_org, 'Instagram'),
    (p_org, 'Gerente/Parceiro'),
    (p_org, 'Outro')
  on conflict do nothing;
end;
$$;

-- Liga o seed ao cadastro do 1o usuario da org
create or replace function public.tg_seed_nova_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_org(new.id);
  return new;
end;
$$;

create trigger seed_nova_org
  after insert on public.organizacoes
  for each row execute function public.tg_seed_nova_org();
