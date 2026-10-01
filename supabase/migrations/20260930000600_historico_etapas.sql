-- Histórico de movimentação no funil.
--
-- As colunas etapa_antes/etapa_depois existem desde a migration do CRM, mas
-- nada as preenchia: o app só guardava a etapa atual do contato. Resultado: o
-- painel conseguia mostrar a foto de hoje e nunca a evolução — não dava para
-- responder "quantos fecharam em setembro" nem "quanto tempo leva para fechar".
--
-- Um trigger resolve melhor que mexer no app: pega todo caminho que move o
-- contato (arrastar no kanban, editar a ficha, importar planilha, SQL na mão),
-- sem depender de ninguém lembrar de registrar.

alter table interacoes
  add column if not exists automatica boolean not null default false;

comment on column interacoes.automatica is
  'Registro gerado pelo sistema (mudança de etapa), não digitado por alguém. '
  'O painel não conta isso como atividade do vendedor.';

-- Índice para o painel, que varre interações por período.
create index if not exists interacoes_org_data_idx on interacoes (org_id, data desc);

create or replace function public.tg_contato_loga_etapa()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes  text;
  v_depois text;
begin
  select nome into v_antes  from public.etapas where id = old.etapa_id;
  select nome into v_depois from public.etapas where id = new.etapa_id;

  insert into public.interacoes
    (org_id, contato_id, usuario_id, tipo, resumo, etapa_antes, etapa_depois, automatica)
  values (
    new.org_id,
    new.id,
    auth.uid(),
    -- 'nota' de propósito: mover no funil não é contato com o cliente, então
    -- não pode mexer no ultimo_contato_em. O trigger que atualiza essa data
    -- ignora 'nota', o que também evita o trigger chamar a si mesmo.
    'nota',
    case
      when old.etapa_id is null then format('Entrou em %s.', coalesce(v_depois, 'etapa removida'))
      when new.etapa_id is null then format('Saiu de %s.', v_antes)
      else format('Moveu de %s para %s.', v_antes, v_depois)
    end,
    old.etapa_id,
    new.etapa_id,
    true
  );
  return new;
end;
$$;

drop trigger if exists contato_loga_etapa on public.contatos;
create trigger contato_loga_etapa
  after update of etapa_id on public.contatos
  for each row
  when (old.etapa_id is distinct from new.etapa_id)
  execute function public.tg_contato_loga_etapa();

-- Marca o passado como automático para o painel não contar como atividade de
-- vendedor aquilo que nunca foi digitado por um. Nada hoje tem etapa_depois,
-- mas deixa a regra explícita caso algum registro antigo apareça.
update interacoes set automatica = true
 where etapa_depois is not null and automatica = false;
