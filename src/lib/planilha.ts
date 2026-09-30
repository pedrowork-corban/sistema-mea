/**
 * Importação da carteira por planilha.
 *
 * O formato é CSV com ponto e vírgula: é o que o Excel em português salva por
 * padrão ("Salvar como → CSV UTF-8"), e o Google Planilhas lê e exporta igual.
 * O arquivo modelo sai com BOM, senão o Excel come os acentos.
 */

import type { Cota, FormaContemplacao, Segmento, StatusCota } from "@/lib/types";
import { SEGMENTOS, STATUS_COTA } from "@/lib/types";

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
  "Data da venda",
  "Situação",
  "Contemplada em",
  "Como (sorteio/lance)",
  "Observações",
] as const;

const EXEMPLOS = [
  ["Maria Silva", "Banco do Brasil", "Imóvel", "1234", "567", "300.000,00", "1.980,00", "200", "12", "15/03/2026", "Ativa", "", "", "Indicação do escritório"],
  ["João Souza", "Canopus", "Automóvel", "7788", "12", "90.000,00", "1.150,00", "80", "30", "02/06/2026", "Contemplada", "10/09/2026", "Lance", ""],
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

/** Aceita dd/mm/aaaa e aaaa-mm-dd. Devolve sempre aaaa-mm-dd. */
function data(v: string): string | null {
  const t = v.trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
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
function mapaColunas(cabecalho: string[]) {
  const achar = (nome: string) => {
    const alvo = semAcento(nome);
    return cabecalho.findIndex((c) => {
      const atual = semAcento(c);
      return atual === alvo || atual.startsWith(alvo.split(" (")[0]);
    });
  };
  return Object.fromEntries(COLUNAS.map((c) => [c, achar(c)])) as Record<
    (typeof COLUNAS)[number],
    number
  >;
}

export function importarCarteira(texto: string): LinhaImportada[] {
  const linhas = lerCsv(texto.replace(/^\uFEFF/, ""));
  if (linhas.length < 2) return [];

  const col = mapaColunas(linhas[0]);
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
    if (!dataVenda) return erro(`Data da venda "${venda}" fora do formato dd/mm/aaaa.`);

    const contemplada = sit === "contemplada";
    const contEm = pega("Contemplada em");
    if (contemplada && contEm && !data(contEm)) {
      return erro(`Data de contemplação "${contEm}" fora do formato dd/mm/aaaa.`);
    }

    const forma = semAcento(pega("Como (sorteio/lance)"));

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
        data_venda: dataVenda,
        status: sit,
        contemplada_em: contemplada ? (contEm ? data(contEm) : dataVenda) : null,
        forma: contemplada ? ((forma === "lance" ? "lance" : "sorteio") as FormaContemplacao) : null,
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

export function baixarModeloCarteira() {
  // BOM no começo: sem ele o Excel abre os acentos errados.
  const blob = new Blob(["\uFEFF" + paraCsv([[...COLUNAS], ...EXEMPLOS])], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-carteira.csv";
  a.click();
  URL.revokeObjectURL(url);
}
