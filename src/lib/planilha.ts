/**
 * Importação por planilha — carteira (cotas) e CRM (contatos).
 *
 * O formato é CSV com ponto e vírgula: é o que o Excel em português salva por
 * padrão ("Salvar como → CSV UTF-8"), e o Google Planilhas lê e exporta igual.
 * O arquivo modelo sai com BOM, senão o Excel come os acentos.
 *
 * Os dois importadores dividem o mesmo parser e as mesmas conversões de célula.
 * A diferença é que o contato precisa resolver nome → id (etapa, origem,
 * responsável), então `importarContatos` recebe as listas do CRM como contexto.
 */

import type {
  Contato,
  Cota,
  Etapa,
  FormaContemplacao,
  Origem,
  Segmento,
  StatusCota,
  Temperatura,
  TipoInteracao,
  Usuario,
} from "@/lib/types";
import { SEGMENTOS, STATUS_COTA, TEMPERATURAS, TIPOS_INTERACAO } from "@/lib/types";

export const COLUNAS = [
  "Cliente",
  "Administradora",
  "Segmento",
  "Grupo",
  "Cota",
  "Crédito",
  "Parcela",
  "Prazo (meses)",
  "Parcelas pagas",
  "Parcelas p/ comissão",
  "Data da venda",
  "Situação",
  "Contemplada em",
  "Como (sorteio/lance)",
  "Observações",
] as const;

const EXEMPLOS = [
  ["Maria Silva", "Banco do Brasil", "Imóvel", "1234", "567", "300.000,00", "1.980,00", "200", "12", "", "15/03/2026", "Ativa", "", "", "Indicação do escritório"],
  ["João Souza", "Canopus", "Automóvel", "7788", "12", "90.000,00", "", "80", "30", "", "02/06/2026", "Contemplada", "10/09/2026", "Lance", "Parcela em branco: é opcional"],
];

/* ------------------------------- leitura CSV ------------------------------ */

/** Separador: o que aparecer mais vezes na primeira linha, entre ";" e ",". */
function separador(texto: string) {
  const linha = texto.split(/\r?\n/)[0] ?? "";
  return (linha.match(/;/g)?.length ?? 0) >= (linha.match(/,/g)?.length ?? 0) ? ";" : ",";
}

/** Parser CSV com aspas — campo entre aspas pode conter separador e quebra de linha. */
function lerCsv(texto: string): string[][] {
  const sep = separador(texto);
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += ch;
      continue;
    }
    if (ch === '"') aspas = true;
    else if (ch === sep) {
      linha.push(campo);
      campo = "";
    } else if (ch === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else if (ch !== "\r") campo += ch;
  }
  linha.push(campo);
  linhas.push(linha);

  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

/* ----------------------------- conversão de célula ---------------------------- */

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/**
 * Aceita "85.500,00", "85500.00", "85500" e "R$ 85.500".
 *
 * A vírgula manda: se existe, ela é o decimal e o ponto é separador de milhar.
 * Sem vírgula o ponto é ambíguo — "90.000" pode ser noventa mil (pt-BR) ou
 * noventa (en-US). Desempata o formato: pontos separando grupos de 3 dígitos
 * são milhar. É o caso das planilhas em português, que é de onde vem o arquivo.
 */
function numero(v: string): number | null {
  const limpo = v.replace(/[^\d.,-]/g, "");
  if (!limpo) return null;

  let normalizado: string;
  if (limpo.includes(",")) normalizado = limpo.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) normalizado = limpo.replace(/\./g, "");
  else normalizado = limpo;

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/**
 * Aceita dd/mm/aaaa e aaaa-mm-dd. Devolve sempre aaaa-mm-dd.
 *
 * Confere se o dia existe de verdade: "31/31/2026" casa com o formato mas não é
 * data. Passando adiante, o Postgres recusa a planilha inteira com uma mensagem
 * que não diz qual linha estava errada.
 */
function data(v: string): string | null {
  const t = v.trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  const [ano, mes, dia] = br
    ? [+br[3], +br[2], +br[1]]
    : iso
      ? [+iso[1], +iso[2], +iso[3]]
      : [0, 0, 0];
  if (!ano) return null;

  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function segmento(v: string): Segmento | null {
  const alvo = semAcento(v);
  if (!alvo) return null;
  const achado = SEGMENTOS.find((s) => semAcento(s.rotulo) === alvo || s.valor === alvo);
  if (achado) return achado.valor;
  // apelidos que aparecem nas planilhas do dia a dia
  if (/(carro|veiculo|moto|auto)/.test(alvo)) return "auto";
  if (/(imovel|casa|apartamento|terreno)/.test(alvo)) return "imovel";
  if (/(caminhao|pesad|trator|maquin)/.test(alvo)) return "pesado";
  if (/(servi|credito)/.test(alvo)) return "servico";
  return null;
}

function situacao(v: string): StatusCota | null {
  const alvo = semAcento(v);
  if (!alvo) return "ativa";
  return STATUS_COTA.find((s) => semAcento(s.rotulo) === alvo || s.valor === alvo)?.valor ?? null;
}

/* -------------------------------- importação ------------------------------- */

export interface LinhaImportada {
  /** número da linha no arquivo, contando o cabeçalho — é o que o usuário vê no Excel */
  linha: number;
  cota: Partial<Cota> | null;
  erro: string | null;
}

/** Casa o cabeçalho do arquivo com as colunas do modelo, ignorando acento e caixa. */
function mapaColunas<T extends readonly string[]>(cabecalho: string[], colunas: T) {
  const achar = (nome: string) => {
    const alvo = semAcento(nome);
    return cabecalho.findIndex((c) => {
      const atual = semAcento(c);
      return atual === alvo || atual.startsWith(alvo.split(" (")[0]);
    });
  };
  return Object.fromEntries(colunas.map((c) => [c, achar(c)])) as Record<T[number], number>;
}

export function importarCarteira(texto: string): LinhaImportada[] {
  const linhas = lerCsv(texto.replace(/^\uFEFF/, ""));
  if (linhas.length < 2) return [];

  const col = mapaColunas(linhas[0], COLUNAS);
  if (col.Cliente < 0) {
    return [{ linha: 1, cota: null, erro: 'Não achei a coluna "Cliente". Use o modelo.' }];
  }

  return linhas.slice(1).map((l, i) => {
    const linha = i + 2;
    const pega = (c: (typeof COLUNAS)[number]) => (col[c] >= 0 ? (l[col[c]] ?? "").trim() : "");
    const erro = (msg: string): LinhaImportada => ({ linha, cota: null, erro: msg });

    const cliente = pega("Cliente");
    if (!cliente) return erro("Sem nome do cliente.");

    const seg = segmento(pega("Segmento"));
    if (!seg) return erro(`Segmento "${pega("Segmento")}" não reconhecido.`);

    const credito = numero(pega("Crédito"));
    if (!credito || credito <= 0) return erro("Crédito vazio ou inválido.");

    const prazo = numero(pega("Prazo (meses)"));
    if (!prazo || prazo < 1) return erro("Prazo vazio ou inválido.");

    const sit = situacao(pega("Situação"));
    if (!sit) return erro(`Situação "${pega("Situação")}" não reconhecida.`);

    const venda = pega("Data da venda");
    const dataVenda = venda ? data(venda) : new Date().toISOString().slice(0, 10);
    if (!dataVenda) return erro(`Data da venda "${venda}" não é uma data válida. Use dd/mm/aaaa.`);

    const contemplada = sit === "contemplada";
    const contEm = pega("Contemplada em");
    if (contemplada && contEm && !data(contEm)) {
      return erro(`Data de contemplação "${contEm}" não é uma data válida. Use dd/mm/aaaa.`);
    }

    const forma = semAcento(pega("Como (sorteio/lance)"));

    const comissao = numero(pega("Parcelas p/ comissão"));
    if (comissao !== null && (comissao < 1 || comissao > 300)) {
      return erro(`Parcelas p/ comissão "${pega("Parcelas p/ comissão")}" fora de 1 a 300.`);
    }

    return {
      linha,
      erro: null,
      cota: {
        cliente_nome: cliente,
        administradora: pega("Administradora") || "Banco do Brasil",
        segmento: seg,
        grupo: pega("Grupo") || null,
        cota: pega("Cota") || null,
        credito,
        parcela: numero(pega("Parcela")),
        prazo_meses: Math.round(prazo),
        parcelas_pagas: Math.round(numero(pega("Parcelas pagas")) ?? 0),
        // Em branco significa "usa o padrão do segmento", não zero.
        parcelas_comissao: comissao === null ? null : Math.round(comissao),
        data_venda: dataVenda,
        status: sit,
        contemplada_em: contemplada ? (contEm ? data(contEm) : dataVenda) : null,
        forma: contemplada ? ((forma === "lance" ? "lance" : "sorteio") as FormaContemplacao) : null,
        obs: pega("Observações") || null,
      },
    };
  });
}

/* ------------------------------ contatos (CRM) ----------------------------- */

export const COLUNAS_CONTATO = [
  "Nome",
  "Telefone",
  "E-mail",
  "CPF",
  "Cidade",
  "Origem",
  "Indicado por",
  "Interesse",
  "Valor estimado",
  "Etapa",
  "Temperatura",
  "Responsável",
  "Último contato",
  "Próxima ação",
  "Próxima ação em",
  "Tags",
  "Observações",
] as const;

const EXEMPLOS_CONTATO = [
  ["Maria Silva", "31 98888-7777", "maria@email.com", "", "Belo Horizonte", "Indicação", "João Souza", "Imóvel", "300.000,00", "", "Quente", "", "01/10/2026", "Mandar simulação", "08/10/2026", "indicação;imóvel", "Quer entrada baixa"],
  ["Carlos Pereira", "34 99939-8276", "", "", "Uberlândia", "", "", "Carro", "80.000,00", "", "Morno", "", "", "", "", "", "Só o nome e o telefone já bastam"],
];

/** Telefone no padrão que o resto do sistema usa: "31 98888-7777". */
function telefone(v: string): string | null {
  const d = v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length < 10 || d.length > 11) return v.trim() || null;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  return `${ddd} ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
}

function temperatura(v: string): Temperatura | null {
  const alvo = semAcento(v);
  if (!alvo) return "frio";
  return TEMPERATURAS.find((t) => semAcento(t.rotulo) === alvo || t.valor === alvo)?.valor ?? null;
}

/**
 * Adivinha o canal a partir da próxima ação, que é texto livre ("Ligar para
 * confirmar", "Mandar simulação no zap"). Sem isso tudo virava WhatsApp e o
 * ícone na agenda mentia. Não achando nada, WhatsApp mesmo — é o canal da casa.
 */
function tipoAcao(v: string): TipoInteracao | null {
  const alvo = semAcento(v);
  if (!alvo) return null;
  const exato = TIPOS_INTERACAO.find((t) => semAcento(t.rotulo) === alvo || t.valor === alvo);
  if (exato) return exato.valor;
  if (/(ligar|ligac|telefon|chamar)/.test(alvo)) return "ligacao";
  if (/(reuni|call|meet|visita)/.test(alvo)) return "reuniao";
  if (/(presencial|escritorio|loja)/.test(alvo)) return "presencial";
  if (/(email|e-mail|mail)/.test(alvo)) return "email";
  return null;
}

/** Acha pelo nome, ignorando acento e caixa. */
function porNome<T extends { nome: string }>(lista: T[], v: string): T | undefined {
  const alvo = semAcento(v);
  return lista.find((x) => semAcento(x.nome) === alvo);
}

/** Só os dígitos do telefone — é por aqui que se reconhece o contato repetido. */
const soDigitos = (v?: string | null) => (v ?? "").replace(/\D/g, "");

export interface LinhaContato {
  linha: number;
  contato: Partial<Contato> | null;
  erro: string | null;
  /** Nome do contato que já existe na base e bate com esta linha. */
  duplicadoDe: string | null;
}

export interface ContextoContatos {
  etapas: Etapa[];
  origens: Origem[];
  usuarios: Usuario[];
  /** Base atual, para marcar quem já existe. */
  existentes: Pick<Contato, "nome" | "telefone">[];
}

/**
 * Lê a planilha de contatos.
 *
 * Diferente da carteira, aqui a planilha traz nomes ("Fechar", "Indicação",
 * "Bruna") e o banco quer ids. O que não casa vira erro com a lista do que é
 * aceito, em vez de entrar nulo: um lead que cai fora da etapa certa some do
 * kanban, e ninguém percebe que sumiu.
 */
export function importarContatos(texto: string, ctx: ContextoContatos): LinhaContato[] {
  const linhas = lerCsv(texto.replace(/^\uFEFF/, ""));
  if (linhas.length < 2) return [];

  const col = mapaColunas(linhas[0], COLUNAS_CONTATO);
  if (col.Nome < 0) {
    return [
      { linha: 1, contato: null, erro: 'Não achei a coluna "Nome". Use o modelo.', duplicadoDe: null },
    ];
  }

  const abertas = ctx.etapas.filter((e) => e.tipo === "aberta");
  const etapaPadrao = abertas[0] ?? ctx.etapas[0];

  // Telefones e nomes já existentes + os que forem aparecendo no próprio
  // arquivo, senão uma planilha com a mesma pessoa duas vezes passa batido.
  const fonesVistos = new Map<string, string>();
  const nomesVistos = new Map<string, string>();
  for (const c of ctx.existentes) {
    const f = soDigitos(c.telefone);
    if (f.length >= 10) fonesVistos.set(f, c.nome);
    nomesVistos.set(semAcento(c.nome), c.nome);
  }

  return linhas.slice(1).map((l, i) => {
    const linha = i + 2;
    const pega = (c: (typeof COLUNAS_CONTATO)[number]) =>
      col[c] >= 0 ? (l[col[c]] ?? "").trim() : "";
    const erro = (msg: string): LinhaContato => ({
      linha,
      contato: null,
      erro: msg,
      duplicadoDe: null,
    });

    const nome = pega("Nome");
    if (!nome) return erro("Sem nome.");

    const temp = temperatura(pega("Temperatura"));
    if (!temp) {
      return erro(
        `Temperatura "${pega("Temperatura")}" não reconhecida. Use ${TEMPERATURAS.map((t) => t.rotulo).join(", ")}.`,
      );
    }

    const nomeEtapa = pega("Etapa");
    const etapa = nomeEtapa ? porNome(ctx.etapas, nomeEtapa) : etapaPadrao;
    if (!etapa) {
      return erro(
        `Etapa "${nomeEtapa}" não existe. Use ${ctx.etapas.map((e) => e.nome).join(", ")}.`,
      );
    }

    const nomeOrigem = pega("Origem");
    const origem = nomeOrigem ? porNome(ctx.origens, nomeOrigem) : null;
    if (nomeOrigem && !origem) {
      return erro(
        ctx.origens.length
          ? `Origem "${nomeOrigem}" não existe. Use ${ctx.origens.map((o) => o.nome).join(", ")} — ou cadastre em Configurações.`
          : `Origem "${nomeOrigem}" não existe. Cadastre as origens em Configurações primeiro.`,
      );
    }

    const nomeResp = pega("Responsável");
    const resp = nomeResp ? porNome(ctx.usuarios, nomeResp) : null;
    if (nomeResp && !resp) {
      return erro(
        `Responsável "${nomeResp}" não encontrado. Use ${ctx.usuarios.map((u) => u.nome).join(", ")}.`,
      );
    }

    const ultimo = pega("Último contato");
    const ultimoEm = ultimo ? data(ultimo) : null;
    if (ultimo && !ultimoEm) {
      return erro(`Último contato "${ultimo}" não é uma data válida. Use dd/mm/aaaa.`);
    }

    const proxima = pega("Próxima ação em");
    const proximaEm = proxima ? data(proxima) : null;
    if (proxima && !proximaEm) {
      return erro(`Próxima ação em "${proxima}" não é uma data válida. Use dd/mm/aaaa.`);
    }

    const fone = telefone(pega("Telefone"));
    const digitos = soDigitos(fone);

    // Telefone é a identidade forte. Sem ele, cai no nome — que erra mais, mas
    // é melhor avisar e deixar o usuário decidir do que duplicar calado.
    const duplicadoDe =
      (digitos.length >= 10 ? fonesVistos.get(digitos) : undefined) ??
      nomesVistos.get(semAcento(nome)) ??
      null;

    if (digitos.length >= 10 && !fonesVistos.has(digitos)) fonesVistos.set(digitos, nome);
    if (!nomesVistos.has(semAcento(nome))) nomesVistos.set(semAcento(nome), nome);

    // Separa em ";" e em ",", menos a vírgula entre dígitos — ela é decimal, e
    // uma tag "R$ 1.300,00" virava duas: "R$ 1.300" e "00".
    const tags = pega("Tags")
      .split(/;|,(?!\d)|(?<!\d),/)
      .map((t) => t.trim())
      .filter(Boolean);

    const acao = pega("Próxima ação");

    return {
      linha,
      erro: null,
      duplicadoDe,
      contato: {
        nome,
        telefone: fone,
        email: pega("E-mail") || null,
        cpf: pega("CPF") || null,
        cidade: pega("Cidade") || null,
        origem_id: origem?.id ?? null,
        indicado_por: pega("Indicado por") || null,
        interesse: pega("Interesse") || null,
        valor_estimado: numero(pega("Valor estimado")),
        etapa_id: etapa.id,
        temperatura: temp,
        responsavel_id: resp?.id ?? null,
        ultimo_contato_em: ultimoEm,
        proxima_acao: acao || null,
        proxima_acao_em: proximaEm,
        proxima_acao_tipo: acao ? (tipoAcao(acao) ?? "whatsapp") : null,
        tags,
        obs: pega("Observações") || null,
      },
    };
  });
}

/* --------------------------------- modelo --------------------------------- */

function paraCsv(linhas: string[][]) {
  return linhas
    .map((l) => l.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";"))
    .join("\r\n");
}

function baixarModelo(arquivo: string, colunas: readonly string[], exemplos: string[][]) {
  // BOM no começo: sem ele o Excel abre os acentos errados.
  const blob = new Blob(["\uFEFF" + paraCsv([[...colunas], ...exemplos])], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function baixarModeloCarteira() {
  baixarModelo("modelo-carteira.csv", COLUNAS, EXEMPLOS);
}

export function baixarModeloContatos() {
  baixarModelo("modelo-contatos.csv", COLUNAS_CONTATO, EXEMPLOS_CONTATO);
}
