export type Temperatura = "quente" | "morno" | "frio";
export type TipoEtapa = "aberta" | "ganha" | "perdida";
export type TipoInteracao =
  | "whatsapp"
  | "ligacao"
  | "reuniao"
  | "email"
  | "presencial"
  | "nota";

export type Permissoes = Record<string, boolean>;

export interface Papel {
  id: string;
  org_id: string;
  nome: string;
  descricao: string | null;
  permissoes: Permissoes;
  sistema: boolean;
}

export interface Usuario {
  id: string;
  org_id: string;
  papel_id: string | null;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  papel?: Papel | null;
}

export interface Convite {
  id: string;
  org_id: string;
  papel_id: string | null;
  email: string;
  nome: string | null;
  token: string;
  criado_por: string | null;
  expira_em: string;
  aceito_em: string | null;
  criado_em: string;
}

export interface Organizacao {
  id: string;
  nome: string;
  cidade: string | null;
}

export interface Etapa {
  id: string;
  org_id: string;
  nome: string;
  ordem: number;
  cor: string;
  tipo: TipoEtapa;
}

export interface Origem {
  id: string;
  org_id: string;
  nome: string;
  ativa: boolean;
}

export interface Contato {
  id: string;
  org_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  cidade: string | null;
  origem_id: string | null;
  parceiro_id: string | null;
  indicado_por_id: string | null;
  indicado_por: string | null;
  interesse: string | null;
  valor_estimado: number | null;
  etapa_id: string | null;
  temperatura: Temperatura;
  responsavel_id: string | null;
  ultimo_contato_em: string | null;
  proxima_acao_em: string | null;
  proxima_acao: string | null;
  proxima_acao_tipo: TipoInteracao | null;
  obs: string | null;

  /* Dados para gravação do consórcio na administradora. */
  cnpj: string | null;
  rg: string | null;
  rg_emissor: string | null;
  data_nascimento: string | null;
  naturalidade: string | null;
  profissao: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  endereco_cidade: string | null;
  uf: string | null;

  tags: string[];
  arquivado: boolean;
  ordem: number;
  criado_por: string | null;
  criado_em: string;
  updated_at: string;
}

export interface Interacao {
  id: string;
  org_id: string;
  contato_id: string;
  usuario_id: string | null;
  data: string;
  tipo: TipoInteracao;
  resumo: string;
  etapa_antes: string | null;
  etapa_depois: string | null;
  /** Gerada pelo sistema na mudança de etapa — não conta como atividade. */
  automatica: boolean;
}

/* ------------------------- Simulador e carteira --------------------------- */

export type Segmento = "imovel" | "auto" | "pesado" | "servico";
export type StatusCota = "ativa" | "contemplada" | "quitada" | "cancelada";
export type FormaContemplacao = "sorteio" | "lance";
export type Reducao = "parcela" | "prazo";

export interface TabelaConsorcio {
  id: string;
  org_id: string;
  administradora: string;
  nome: string;
  segmento: Segmento;
  prazo_meses: number;
  taxa_adm: number;
  fundo_reserva: number;
  seguro_mensal: number;
  lance_embutido_max: number;
  credito_min: number | null;
  credito_max: number | null;
  ativa: boolean;
  ordem: number;
}

export interface Simulacao {
  id: string;
  org_id: string;
  contato_id: string | null;
  usuario_id: string | null;
  tabela_id: string | null;
  titulo: string;
  cliente_nome: string | null;
  administradora: string;
  segmento: Segmento;
  credito: number;
  prazo_meses: number;
  taxa_adm: number;
  fundo_reserva: number;
  seguro_mensal: number;
  lance_proprio: number;
  lance_embutido_pct: number;
  mes_contemplacao: number;
  reducao: Reducao;
  parcela: number;
  total_pago: number;
  criado_em: string;
}

export interface Cota {
  id: string;
  org_id: string;
  contato_id: string | null;
  vendedor_id: string | null;
  simulacao_id: string | null;
  cliente_nome: string;
  administradora: string;
  grupo: string | null;
  cota: string | null;
  segmento: Segmento;
  credito: number;
  prazo_meses: number;
  parcela: number | null;
  parcelas_pagas: number;
  data_venda: string;
  status: StatusCota;
  contemplada_em: string | null;
  forma: FormaContemplacao | null;
  obs: string | null;
  criado_por: string | null;
  criado_em: string;
}

export const SEGMENTOS: { valor: Segmento; rotulo: string; bem: string }[] = [
  { valor: "imovel", rotulo: "Imóvel", bem: "Imóvel" },
  { valor: "auto", rotulo: "Automóvel", bem: "Veículo" },
  { valor: "pesado", rotulo: "Pesados", bem: "Veículo pesado" },
  { valor: "servico", rotulo: "Serviços", bem: "Serviços" },
];

export const STATUS_COTA: { valor: StatusCota; rotulo: string; classe: string }[] = [
  { valor: "ativa", rotulo: "Ativa", classe: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" },
  { valor: "contemplada", rotulo: "Contemplada", classe: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  { valor: "quitada", rotulo: "Quitada", classe: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200" },
  { valor: "cancelada", rotulo: "Cancelada", classe: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
];

export const INTERESSES = [
  "Carro",
  "Imóvel",
  "Caminhão",
  "Moto",
  "Investimento",
  "Carta contemplada",
  "Serviços/Crédito",
] as const;

export const TEMPERATURAS: { valor: Temperatura; rotulo: string; classe: string }[] = [
  { valor: "quente", rotulo: "Quente", classe: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  { valor: "morno", rotulo: "Morno", classe: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  { valor: "frio", rotulo: "Frio", classe: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" },
];

export const TIPOS_INTERACAO: { valor: TipoInteracao; rotulo: string }[] = [
  { valor: "whatsapp", rotulo: "WhatsApp" },
  { valor: "ligacao", rotulo: "Ligação" },
  { valor: "reuniao", rotulo: "Reunião" },
  { valor: "presencial", rotulo: "Presencial" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "nota", rotulo: "Nota interna" },
];

/** Todas as permissões do sistema, agrupadas para a tela de Papéis. */
export const CATALOGO_PERMISSOES: {
  grupo: string;
  itens: { chave: string; rotulo: string; descricao: string; sensivel?: boolean }[];
}[] = [
  {
    grupo: "Administração",
    itens: [
      { chave: "admin.org", rotulo: "Dono da conta", descricao: "Acesso irrestrito a tudo. Ignora as demais permissões." },
      { chave: "admin.usuarios", rotulo: "Gerenciar usuários e papéis", descricao: "Convidar pessoas, criar papéis e definir permissões." },
      { chave: "admin.config", rotulo: "Configurar o sistema", descricao: "Editar etapas do funil e origens de lead." },
    ],
  },
  {
    grupo: "CRM",
    itens: [
      { chave: "crm.ver", rotulo: "Acessar o CRM", descricao: "Necessário para abrir a área de contatos." },
      { chave: "crm.ver_todos", rotulo: "Ver contatos de todo mundo", descricao: "Sem isso, a pessoa só vê os contatos em que é responsável, indicadora ou que cadastrou." },
      { chave: "crm.editar", rotulo: "Criar e editar contatos", descricao: "Cadastrar contatos e registrar interações." },
      { chave: "crm.excluir", rotulo: "Excluir contatos", descricao: "Apagar contatos em definitivo." },
    ],
  },
  {
    grupo: "Simulador (Fase 2)",
    itens: [
      { chave: "simulador.usar", rotulo: "Fazer simulações", descricao: "Simular consórcio e gerar proposta." },
      { chave: "simulador.tabelas", rotulo: "Editar tabelas das administradoras", descricao: "Alterar taxas, prazos e faixas de crédito." },
    ],
  },
  {
    grupo: "Carteira (Fase 3)",
    itens: [
      { chave: "carteira.ver", rotulo: "Ver a carteira", descricao: "Acessar as cotas vendidas." },
      { chave: "carteira.ver_todas", rotulo: "Ver a carteira de todo mundo", descricao: "Sem isso, só enxerga as próprias vendas." },
      { chave: "carteira.editar", rotulo: "Lançar e editar cotas", descricao: "Registrar vendas na carteira." },
    ],
  },
  {
    grupo: "Financeiro",
    itens: [
      {
        chave: "comissoes.ver",
        rotulo: "Ver comissões",
        descricao: "Valores de comissão da empresa e a receber. Mantenha desligado para quem não é sócio.",
        sensivel: true,
      },
    ],
  },
];
