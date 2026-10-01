-- Marco de comissão da cota.
--
-- A administradora paga a comissão conforme o cliente paga as parcelas: veículo
-- fecha em 7, imóvel em 12. Guardamos o número por cota em vez de deixar fixo no
-- código porque cada contrato pode negociar o seu — quando a coluna fica nula, o
-- sistema usa o padrão do segmento.
alter table cotas
  add column if not exists parcelas_comissao integer
    check (parcelas_comissao is null or parcelas_comissao between 1 and 300);

comment on column cotas.parcelas_comissao is
  'Parcelas pagas necessárias para fechar a comissão. Nulo = padrão do segmento (7 veículo, 12 imóvel).';
