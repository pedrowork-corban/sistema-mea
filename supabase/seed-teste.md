# Conta de teste (apenas desenvolvimento local)

Usada para validar o fluxo de cadastro → bootstrap da organização → importação da carteira.
Não use em produção e não reaproveite esta senha em nenhum outro serviço.

- E-mail: `teste.local@example.com`
  (o Supabase rejeita TLDs reservados como `.test` e `.local`)
- Senha: `ma-teste-2026-local`
- Empresa criada no cadastro: `Martinelle & Avelar (teste)`

Para limpar: apague o usuário em Authentication → Users no painel do Supabase.
A exclusão em cascata remove organização, papéis, etapas, origens e contatos de teste.
