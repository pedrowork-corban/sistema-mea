# Sistema Martinelle & Avelar

CRM comercial da M&A. React + TypeScript + Vite + Tailwind, banco no Supabase.

## Rodar

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

As chaves do Supabase ficam no `.env` (veja `.env.example`).
A chave publicável é pública por natureza — quem protege os dados é o RLS.

## Primeiro acesso

1. Abra `/login` e clique em **Criar uma agora**.
2. O cadastro cria a organização, 4 papéis base (Administrador, Gerente, Vendedor,
   Indicadora), 6 etapas de funil e 10 origens. Quem cria a conta vira Administrador.
3. No CRM, clique em **Importar planilha** para trazer os 32 contatos do
   `Acompanhamento_Pedro_2.0.xlsx`. É idempotente: rodar de novo não duplica.

Para adicionar alguém: **Usuários e papéis → Convidar**. A pessoa entra sozinha
criando a conta com exatamente aquele e-mail.

## Permissões

Papéis são livres: você cria com o nome que quiser e liga só o que quiser.
`admin.org` ("Dono da conta") passa em qualquer verificação.

**`comissoes.ver` vem desligada em todo papel novo e só está ligada no Administrador.**
Ela está marcada como sensível na tela de papéis. Não ligue para quem não é sócio.

## Estrutura

```
src/
  contexts/AuthContext.tsx   sessão, perfil, papel, pode()
  components/Layout.tsx      sidebar + <Protegido permissao="...">
  components/FichaContato    painel lateral do contato + histórico
  hooks/useCrm.ts            contatos, etapas, origens, interações
  hooks/useAdmin.ts          papéis, usuários, convites, config
  pages/                     Crm, Hoje, Usuarios, Config, Login
supabase/                    migrations aplicadas via MCP
```

## Fases

- **Fase 1 (feito)** — CRM: funil kanban, lista, ficha, interações, fila do dia,
  usuários e papéis, configuração de etapas e origens.
- **Fase 2** — simulador de consórcio + proposta em PDF.
- **Fase 3** — carteira de cotas.
- **Fase 4** — metas e tarefas.
- **Fase 5** — comissões e parceiros (área privada).
