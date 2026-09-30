-- ============================================================
-- Fase 2 + 3: tabelas das administradoras, simulacoes e carteira de cotas
-- ============================================================

create type public.segmento_consorcio  as enum ('imovel', 'auto', 'pesado', 'servico');
create type public.status_cota         as enum ('ativa', 'contemplada', 'quitada', 'cancelada');
create type public.forma_contemplacao  as enum ('sorteio', 'lance');
create type public.reducao_pos_lance   as enum ('parcela', 'prazo');

-- ------------------------------------------------------------
-- Tabelas das administradoras (a "tabela de venda")
-- ------------------------------------------------------------
create table public.tabelas_consorcio (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizacoes(id) on delete cascade,
  administradora     text not null,
  nome               text not null,
  segmento           public.segmento_consorcio not null,
  prazo_meses        int  not null check (prazo_meses between 1 and 300),
  -- percentuais sobre o valor do credito, no total do plano
  taxa_adm           numeric(6,3) not null default 0 check (taxa_adm >= 0),
  fundo_reserva      numeric(6,3) not null default 0 check (fundo_reserva >= 0),
  -- percentual ao mes sobre o credito
  seguro_mensal      numeric(6,4) not null default 0 check (seguro_mensal >= 0),
  -- teto de lance embutido, em % do credito
  lance_embutido_max numeric(5,2) not null default 0 check (lance_embutido_max between 0 and 100),
  credito_min        numeric(14,2),
  credito_max        numeric(14,2),
  ativa              boolean not null default true,
  ordem              int not null default 0,
  criado_em          timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, administradora, nome, prazo_meses)
);

create index tabelas_consorcio_org_idx on public.tabelas_consorcio (org_id, ativa, segmento, ordem);
create trigger set_updated_at before update on public.tabelas_consorcio
  for each row execute function public.tg_set_updated_at();

comment on column public.tabelas_consorcio.taxa_adm is
  'Taxa de administracao total do plano, em % do credito. Ex.: 22.9 = 22,9%.';
comment on column public.tabelas_consorcio.seguro_mensal is
  'Seguro prestamista mensal, em % do credito. Zero quando a tabela nao cobra.';

-- ------------------------------------------------------------
-- Simulacoes (snapshot: a tabela pode mudar depois)
-- ------------------------------------------------------------
create table public.simulacoes (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizacoes(id) on delete cascade,
  contato_id         uuid references public.contatos(id) on delete set null,
  usuario_id         uuid references public.usuarios(id) on delete set null,
  tabela_id          uuid references public.tabelas_consorcio(id) on delete set null,

  titulo             text not null default 'Simulação de consórcio',
  cliente_nome       text,
  administradora     text not null,
  segmento           public.segmento_consorcio not null,

  credito            numeric(14,2) not null check (credito > 0),
  prazo_meses        int not null check (prazo_meses between 1 and 300),
  taxa_adm           numeric(6,3) not null default 0,
  fundo_reserva      numeric(6,3) not null default 0,
  seguro_mensal      numeric(6,4) not null default 0,

  lance_proprio      numeric(14,2) not null default 0 check (lance_proprio >= 0),
  lance_embutido_pct numeric(5,2)  not null default 0 check (lance_embutido_pct between 0 and 100),
  mes_contemplacao   int           not null default 0 check (mes_contemplacao >= 0),
  reducao            public.reducao_pos_lance not null default 'parcela',

  -- resultado congelado, para listar sem recalcular
  parcela            numeric(14,2) not null default 0,
  total_pago         numeric(14,2) not null default 0,

  criado_em          timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index simulacoes_org_idx     on public.simulacoes (org_id, criado_em desc);
create index simulacoes_contato_idx on public.simulacoes (contato_id, criado_em desc);
create trigger set_updated_at before update on public.simulacoes
  for each row execute function public.tg_set_updated_at();

-- ------------------------------------------------------------
-- Carteira de cotas vendidas
-- ------------------------------------------------------------
create table public.cotas (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacoes(id) on delete cascade,
  contato_id      uuid references public.contatos(id) on delete set null,
  vendedor_id     uuid references public.usuarios(id) on delete set null,
  simulacao_id    uuid references public.simulacoes(id) on delete set null,

  cliente_nome    text not null,
  administradora  text not null,
  grupo           text,
  cota            text,
  segmento        public.segmento_consorcio not null,

  credito         numeric(14,2) not null check (credito > 0),
  prazo_meses     int not null check (prazo_meses between 1 and 300),
  parcela         numeric(14,2),
  parcelas_pagas  int not null default 0 check (parcelas_pagas >= 0),

  data_venda      date not null default current_date,
  status          public.status_cota not null default 'ativa',
  contemplada_em  date,
  forma           public.forma_contemplacao,

  obs             text,
  criado_por      uuid references public.usuarios(id) on delete set null,
  criado_em       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint cotas_contemplacao_coerente check (
    (status = 'contemplada') or (contemplada_em is null and forma is null)
  )
);

create index cotas_org_idx      on public.cotas (org_id, status, data_venda desc);
create index cotas_vendedor_idx on public.cotas (vendedor_id);
create index cotas_contato_idx  on public.cotas (contato_id);
create trigger set_updated_at before update on public.cotas
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.tabelas_consorcio enable row level security;
alter table public.simulacoes        enable row level security;
alter table public.cotas             enable row level security;

-- Tabelas: quem simula le, quem tem simulador.tabelas edita.
create policy tabelas_select on public.tabelas_consorcio
  for select using (
    public.mesma_org(org_id)
    and (public.tem_permissao('simulador.usar') or public.tem_permissao('simulador.tabelas')));
create policy tabelas_write on public.tabelas_consorcio
  for all using (public.mesma_org(org_id) and public.tem_permissao('simulador.tabelas'))
  with check (public.mesma_org(org_id) and public.tem_permissao('simulador.tabelas'));

-- Simulacoes: cada um ve as suas; quem ve todos os contatos ve todas.
create policy simulacoes_select on public.simulacoes
  for select using (
    public.mesma_org(org_id)
    and public.tem_permissao('simulador.usar')
    and (public.tem_permissao('crm.ver_todos') or usuario_id = auth.uid()));
create policy simulacoes_insert on public.simulacoes
  for insert with check (public.mesma_org(org_id) and public.tem_permissao('simulador.usar'));
create policy simulacoes_update on public.simulacoes
  for update using (
    public.mesma_org(org_id)
    and public.tem_permissao('simulador.usar')
    and (public.tem_permissao('crm.ver_todos') or usuario_id = auth.uid()));
create policy simulacoes_delete on public.simulacoes
  for delete using (
    public.mesma_org(org_id)
    and (public.tem_permissao('crm.ver_todos') or usuario_id = auth.uid()));

-- Carteira: carteira.ver_todas abre a carteira da equipe.
create policy cotas_select on public.cotas
  for select using (
    public.mesma_org(org_id)
    and public.tem_permissao('carteira.ver')
    and (public.tem_permissao('carteira.ver_todas')
         or auth.uid() in (vendedor_id, criado_por)));
create policy cotas_insert on public.cotas
  for insert with check (public.mesma_org(org_id) and public.tem_permissao('carteira.editar'));
create policy cotas_update on public.cotas
  for update using (
    public.mesma_org(org_id)
    and public.tem_permissao('carteira.editar')
    and (public.tem_permissao('carteira.ver_todas')
         or auth.uid() in (vendedor_id, criado_por)));
create policy cotas_delete on public.cotas
  for delete using (public.mesma_org(org_id) and public.tem_permissao('carteira.editar'));

-- ============================================================
-- Seed das tabelas das administradoras da M&A
-- Numeros de partida vindos do CEREBRO_MARTINELLE_AVELAR.md.
-- Sao editaveis na tela do simulador.
-- ============================================================
create or replace function public.seed_tabelas_consorcio(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.tabelas_consorcio
    (org_id, administradora, nome, segmento, prazo_meses,
     taxa_adm, fundo_reserva, seguro_mensal, lance_embutido_max,
     credito_min, credito_max, ordem)
  values
    (p_org, 'Banco do Brasil', 'BB Imóvel 200',     'imovel',  200, 24.0, 2.0, 0.030, 30, 50000,  800000, 1),
    (p_org, 'Banco do Brasil', 'BB Imóvel 240',     'imovel',  240, 26.0, 2.0, 0.030, 30, 50000,  800000, 2),
    (p_org, 'Banco do Brasil', 'BB Auto 66',        'auto',     66, 22.9, 5.3, 0.045, 30, 26282,  200000, 3),
    (p_org, 'Banco do Brasil', 'BB Auto 80',        'auto',     80, 24.0, 5.3, 0.045, 30, 26282,  200000, 4),
    (p_org, 'Banco do Brasil', 'BB Auto 116',       'auto',    116, 26.0, 5.3, 0.045, 30, 26282,  200000, 5),
    (p_org, 'Canopus',         'Canopus Auto 80',   'auto',     80, 18.0, 2.0, 0.040, 25, 30000,  250000, 6),
    (p_org, 'Canopus',         'Canopus Imóvel 200','imovel',  200, 20.0, 2.0, 0.030, 25, 60000,  600000, 7),
    (p_org, 'Âncora',          'Âncora Auto 80',    'auto',     80, 17.0, 2.0, 0.040, 25, 30000,  250000, 8),
    (p_org, 'Âncora',          'Âncora Pesados 100','pesado',  100, 22.0, 2.0, 0.040, 25, 80000, 1000000, 9),
    (p_org, 'Âncora',          'Âncora Serviços 60','servico',  60, 14.0, 2.0, 0.000, 20, 10000,  100000, 10)
  on conflict do nothing;
end;
$$;

-- Passa a rodar junto do seed de etapas/origens
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

  perform public.seed_tabelas_consorcio(p_org);
end;
$$;

-- Orgs que ja existem antes desta migration tambem ganham as tabelas
do $$
declare o uuid;
begin
  for o in select id from public.organizacoes loop
    perform public.seed_tabelas_consorcio(o);
  end loop;
end;
$$;
