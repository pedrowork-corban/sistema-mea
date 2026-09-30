-- ============================================================
-- Martinelle & Avelar — Fase 1 / Migration 3
-- Importa a carteira atual do Pedro (planilha Acompanhamento).
-- Chamada pela UI: select public.importar_carteira_inicial();
-- Idempotente: nao duplica quem ja existe (mesmo nome).
-- ============================================================

create or replace function public.importar_carteira_inicial()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org   uuid := public.org_atual();
  v_me    uuid := auth.uid();
  v_novos int  := 0;
  r       record;
  v_etapa uuid;
  v_orig  uuid;
begin
  if v_org is null then
    raise exception 'Usuario sem organizacao.';
  end if;
  if not public.tem_permissao('crm.editar') then
    raise exception 'Sem permissao para importar contatos.';
  end if;

  for r in
    select * from (values
      -- nome, telefone, origem, indicado_por, interesse, valor, etapa, temperatura, ult_contato, prox_acao_em, prox_acao, obs
      ('Sylas',          '34 99939-8276', 'Indicação',        'Bruna',         'Carro',             50000::numeric, 'Fechar',     'quente', '2026-09-22'::date, '2026-09-30'::date, 'Fechar proposta',            'Carro ~50k.'),
      ('Ernane',         '31 98286-9887', 'Carteira antiga',  null,            'Imóvel',            null,           'Fechar',     'quente', '2026-09-24',       '2026-09-30',       'Levar simulação de imóvel',  null),
      ('Arlem',          '31 98945-8182', 'Carteira antiga',  null,            'Caminhão',          null,           'Fechar',     'quente', '2026-09-24',       '2026-09-30',       'Fechar',                     'Grupo Canopus.'),
      ('Juliana',        '31 97176-2007', 'Carteira antiga',  null,            'Investimento',      null,           'Fechar',     'quente', null,               '2026-09-30',       'Primeiro contato do mês',    'Grupo Canopus.'),
      ('Ivone',          null,            'Indicação',        'Alessandra',    null,                null,           'Fechar',     'morno',  null,               '2026-10-01',       'Pedir telefone p/ Alessandra','FALTA TELEFONE.'),
      ('Uender',         null,            'Gerente/Parceiro', 'Yoham (Betim)', null,                null,           'Fechar',     'morno',  null,               '2026-10-01',       'Pedir telefone p/ Yoham',    'FALTA TELEFONE.'),
      ('Rosana',         null,            'Indicação',        'Luana',         null,                null,           'Fechar',     'morno',  null,               '2026-10-01',       'Pedir telefone p/ Luana',    'FALTA TELEFONE.'),
      ('Carlos',         null,            'Gerente/Parceiro', 'Yoham (Betim)', null,                null,           'Fechar',     'morno',  null,               '2026-10-01',       'Pedir telefone p/ Yoham',    'FALTA TELEFONE.'),
      ('Juan Regis',     null,            'Carteira antiga',  null,            null,                null,           'Fechar',     'morno',  null,               '2026-10-01',       'Buscar telefone',            'Cliente LTV (já é da casa).'),
      ('Robert',         '31 99954-0749', 'Carteira antiga',  null,            'Carta contemplada', null,           'Negociando', 'morno',  null,               '2026-10-01',       'Reativar',                   'Contemplada p/ imóvel.'),
      ('Jane',           '38 99923-3714', 'Indicação',        'Bruna',         'Investimento',      null,           'Negociando', 'quente', '2026-09-15',       '2026-09-30',       'Retomar negociação',         'Investimento + troca de carro.'),
      ('Gilmar e Thaís', '31 99789-9605', 'Carteira antiga',  null,            'Carro',             null,           'Negociando', 'quente', '2026-09-16',       '2026-09-30',       'Retomar negociação',         'Casal.'),
      ('Bruno',          '31 99820-1509', 'Indicação',        'Thaiane',       'Carro',             null,           'Negociando', 'morno',  null,               '2026-10-01',       'Reativar',                   null),
      ('Eni Maria',      '31 97364-9629', 'Carteira antiga',  null,            'Carro',             null,           'Negociando', 'morno',  '2026-09-18',       '2026-10-02',       'Follow-up',                  'Troca de carro.'),
      ('Edilaine',       '31 98574-8058', 'Carteira antiga',  null,            'Investimento',      null,           'Negociando', 'quente', '2026-09-21',       '2026-09-30',       'Retomar',                    null),
      ('Mariane',        '31 99386-5030', 'Carteira antiga',  null,            'Imóvel',            null,           'Negociando', 'quente', '2026-09-20',       '2026-09-30',       'Retomar',                    'Imóvel como investimento.'),
      ('Angelica',       '31 99431-6900', 'Indicação',        'Taina',         'Investimento',      null,           'Negociando', 'quente', '2026-09-19',       '2026-10-01',       'Enviar case',                'USAR CASE "CONTEMPLADO EM 10 MESES".'),
      ('Tiago',          '31 99632-4262', 'Carteira antiga',  null,            'Carta contemplada', null,           'Aquecer',    'frio',   null,               '2026-10-02',       'Reativar',                   'Contemplada p/ imóvel.'),
      ('Eli',            '31 99630-6080', 'Indicação',        'Thaiane',       'Carro',             null,           'Negociando', 'morno',  '2026-09-18',       '2026-10-01',       'Follow-up',                  null),
      ('Junia',          '31 99860-8827', 'Carteira antiga',  null,            'Imóvel',            null,           'Negociando', 'quente', '2026-09-19',       '2026-10-01',       'Enviar case',                'USAR CASE "CONTEMPLADO EM 10 MESES".'),
      ('Edvanio',        '33 98417-1797', 'Carteira antiga',  null,            null,                null,           'Aquecer',    'frio',   null,               '2026-10-02',       'Descobrir o interesse',      'Primeiro contato.'),
      ('Adriana',        '31 99867-2728', 'Carteira antiga',  null,            null,                null,           'Aquecer',    'frio',   null,               '2026-10-02',       'Descobrir o interesse',      'Primeiro contato.'),
      ('Fabiana',        '31 99711-2257', 'Gerente/Parceiro', 'Yoham',         'Investimento',      null,           'Aquecer',    'morno',  '2026-09-23',       '2026-10-01',       'Follow-up',                  null),
      ('Ingred',         '31 98012-0301', 'Indicação',        null,            'Carta contemplada', null,           'Aquecer',    'morno',  '2026-09-23',       '2026-10-01',       'Follow-up',                  'Carta contemplada imóvel.'),
      ('Izaias',         '31 97184-3638', 'Indicação',        null,            'Caminhão',          null,           'Aquecer',    'morno',  null,               '2026-10-02',       'Primeiro contato',           null),
      ('Eldem',          '31 98757-6382', 'Classificado',     null,            null,                null,           'Aquecer',    'frio',   null,               '2026-10-02',       'Qualificar',                 'Veio do classificado.'),
      ('Sergio',         '21 99325-6767', 'Tráfego pago',     null,            null,                null,           'Novo lead',  'frio',   null,               '2026-09-30',       'Responder rápido',           'Lead de tráfego.'),
      ('Rodrigo',        null,            'Indicação',        'Bruna',         null,                null,           'Aquecer',    'frio',   null,               '2026-10-01',       'Pedir telefone p/ Bruna',    'FALTA TELEFONE.'),
      ('Alan',           '31 99911-2964', 'Indicação',        'Alessandra',    null,                null,           'Aquecer',    'frio',   null,               '2026-10-02',       'Qualificar',                 null),
      ('Jaime',          null,            'Tráfego pago',     null,            null,                null,           'Novo lead',  'frio',   null,               '2026-09-30',       'Buscar no gerenciador',      'FALTA TELEFONE.'),
      ('Enzo',           null,            'Gerente/Parceiro', 'Yoham (Betim)', null,                null,           'Aquecer',    'frio',   null,               '2026-10-01',       'Pedir telefone p/ Yoham',    'FALTA TELEFONE.'),
      ('Guilherme',      null,            'Indicação',        'Cassia',        null,                null,           'Aquecer',    'morno',  '2026-09-23',       '2026-10-01',       'Pedir telefone p/ Cassia',   'FALTA TELEFONE.')
    ) as t(nome, telefone, origem, indicado_por, interesse, valor, etapa, temperatura, ult, prox_em, prox, obs)
  loop
    if exists (select 1 from public.contatos
                where org_id = v_org and lower(nome) = lower(r.nome)) then
      continue;
    end if;

    select id into v_etapa from public.etapas  where org_id = v_org and nome = r.etapa;
    select id into v_orig  from public.origens where org_id = v_org and nome = r.origem;

    insert into public.contatos (
      org_id, nome, telefone, origem_id, indicado_por, interesse, valor_estimado,
      etapa_id, temperatura, responsavel_id, ultimo_contato_em,
      proxima_acao_em, proxima_acao, obs, criado_por)
    values (
      v_org, r.nome, r.telefone, v_orig, r.indicado_por, r.interesse, r.valor,
      v_etapa, r.temperatura::public.temperatura, v_me, r.ult,
      r.prox_em, r.prox, r.obs, v_me);

    v_novos := v_novos + 1;
  end loop;

  return v_novos;
end;
$$;

revoke all on function public.importar_carteira_inicial() from public;
grant execute on function public.importar_carteira_inicial() to authenticated;
