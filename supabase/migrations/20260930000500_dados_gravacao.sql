-- Dados cadastrais do cliente, usados na hora de gravar o consórcio na
-- administradora. Ficam na própria tabela de contatos: é um para um com o
-- contato e evita um join a mais em toda leitura do CRM.
--
-- Atenção: são dados pessoais sensíveis (documento, nascimento, conta bancária).
-- Quem enxerga o contato enxerga esses campos — a RLS de `contatos` já governa
-- isso via pode_ver_contato(), então não há política nova aqui.

alter table contatos
  -- documentos (cpf já existe)
  add column if not exists cnpj text,
  add column if not exists rg text,
  add column if not exists rg_emissor text,

  -- pessoa
  add column if not exists data_nascimento date,
  add column if not exists naturalidade text,
  add column if not exists profissao text,

  -- conta para débito das parcelas
  add column if not exists banco text,
  add column if not exists agencia text,
  add column if not exists conta text,

  -- endereço completo (cidade do lead continua em `cidade`, que é do funil)
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists endereco_cidade text,
  add column if not exists uf text;

comment on column contatos.cidade is
  'Cidade do lead, do funil. O endereço de cadastro fica em endereco_cidade/uf.';
