-- Parcela informada à mão na simulação.
--
-- Somar taxa de administração com fundo de reserva quase nunca chega na parcela
-- que está na tabela da administradora. O vendedor passou a poder digitar o valor
-- certo, e isso precisa sobreviver ao Salvar: sem esta coluna, reabrir a simulação
-- devolvia a parcela calculada e descartava o número real.
--
-- Nulo = calcular pelas taxas, que continua sendo o comportamento padrão.

alter table simulacoes add column if not exists parcela_manual numeric;

comment on column simulacoes.parcela_manual is
  'Parcela cheia da tabela da administradora, digitada pelo vendedor. Nulo = calculada pelas taxas.';
