/**
 * Escritor de .xlsx: várias abas, cabeçalho congelado, filtro automático e cada
 * célula com o tipo certo — número é número e data é data, não texto.
 *
 * Por que não CSV: um CSV é uma tabela só, e o dump do CRM são quatro (contatos,
 * histórico, simulações, cotas). Por que não uma biblioteca: um xlsx é um zip com
 * cinco XMLs dentro, e escrevê-los é menos código do que carregar meio megabyte
 * de dependência para gerar um arquivo de vez em quando.
 */

export type Celula = string | number | Date | null | undefined;

export interface Aba {
  nome: string;
  colunas: string[];
  linhas: Celula[][];
}

/* ---------------------------------- zip ---------------------------------- */

/** Uint8Array sobre ArrayBuffer comum — é o que o Blob aceita. */
type Bytes = Uint8Array<ArrayBuffer>;

const bytes = (s: string) => new TextEncoder().encode(s) as Bytes;

let tabelaCrc: Uint32Array | null = null;

function crc32(dados: Bytes): number {
  if (!tabelaCrc) {
    tabelaCrc = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabelaCrc[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of dados) crc = tabelaCrc[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Zip sem compressão (método "store"). O arquivo fica maior do que precisaria,
 * mas dispensa um compressor inteiro e o Excel abre igual.
 */
function zip(arquivos: { nome: string; dados: Bytes }[]): Blob {
  const agora = new Date();
  const hora =
    (agora.getHours() << 11) | (agora.getMinutes() << 5) | (Math.floor(agora.getSeconds() / 2) & 0x1f);
  const dia =
    ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();

  const partes: Bytes[] = [];
  const central: Bytes[] = [];
  let posicao = 0;

  for (const a of arquivos) {
    const nome = bytes(a.nome);
    const crc = crc32(a.dados);

    const local = new Uint8Array(30 + nome.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(4, 20, true); // versão mínima
    vl.setUint16(6, 0x0800, true); // nomes em UTF-8
    vl.setUint16(8, 0, true); // store
    vl.setUint16(10, hora, true);
    vl.setUint16(12, dia, true);
    vl.setUint32(14, crc, true);
    vl.setUint32(18, a.dados.length, true);
    vl.setUint32(22, a.dados.length, true);
    vl.setUint16(26, nome.length, true);
    local.set(nome, 30);

    const entrada = new Uint8Array(46 + nome.length);
    const ve = new DataView(entrada.buffer);
    ve.setUint32(0, 0x02014b50, true);
    ve.setUint16(4, 20, true);
    ve.setUint16(6, 20, true);
    ve.setUint16(8, 0x0800, true);
    ve.setUint16(10, 0, true);
    ve.setUint16(12, hora, true);
    ve.setUint16(14, dia, true);
    ve.setUint32(16, crc, true);
    ve.setUint32(20, a.dados.length, true);
    ve.setUint32(24, a.dados.length, true);
    ve.setUint16(28, nome.length, true);
    ve.setUint32(42, posicao, true);
    entrada.set(nome, 46);

    partes.push(local, a.dados);
    central.push(entrada);
    posicao += local.length + a.dados.length;
  }

  const tamanhoCentral = central.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22);
  const vf = new DataView(fim.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, arquivos.length, true);
  vf.setUint16(10, arquivos.length, true);
  vf.setUint32(12, tamanhoCentral, true);
  vf.setUint32(16, posicao, true);

  return new Blob([...partes, ...central, fim], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/* ---------------------------------- xml ---------------------------------- */

/** Escapa o XML e descarta os caracteres de controle, que o Excel recusa. */
function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 1 → A, 27 → AA. */
function letra(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Dias desde 1899-12-30 — a época do Excel, que acha que 1900 foi bissexto. */
function serial(d: Date): number {
  const local = Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
  );
  return (local - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** Excel não aceita : \ / ? * [ ] no nome da aba, e corta em 31 caracteres. */
function nomeAba(nome: string, usados: Set<string>): string {
  let limpo = nome.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Planilha";
  let n = 2;
  while (usados.has(limpo.toLowerCase())) limpo = `${limpo.slice(0, 28)} ${n++}`;
  usados.add(limpo.toLowerCase());
  return limpo;
}

const CABECALHO_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function celula(ref: string, v: Celula): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") {
    return Number.isFinite(v) ? `<c r="${ref}"><v>${v}</v></c>` : "";
  }
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    // Meia-noite em ponto é data pura (data_venda, nascimento); o resto é
    // timestamp e merece a hora junto.
    const comHora = v.getHours() || v.getMinutes() || v.getSeconds();
    return `<c r="${ref}" s="${comHora ? 2 : 1}"><v>${serial(v)}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function abaXml(aba: Aba): string {
  const totalCol = Math.max(aba.colunas.length, 1);
  const ultima = letra(totalCol);
  const totalLinhas = aba.linhas.length + 1;

  // Largura pelo maior conteúdo da coluna, olhando as primeiras linhas: varrer
  // 20 mil linhas para medir texto custa mais do que o ajuste fino vale.
  const larguras = aba.colunas.map((c, i) => {
    let max = c.length;
    for (const l of aba.linhas.slice(0, 200)) {
      const v = l[i];
      const t =
        v instanceof Date ? 16 : v === null || v === undefined ? 0 : String(v).length;
      if (t > max) max = t;
    }
    return Math.min(Math.max(max + 2, 9), 52);
  });

  const cols = larguras
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");

  const cabecalho = aba.colunas
    .map((c, i) => `<c r="${letra(i + 1)}1" t="inlineStr" s="3"><is><t>${esc(c)}</t></is></c>`)
    .join("");

  const corpo = aba.linhas
    .map((l, i) => {
      const r = i + 2;
      const cs = l.map((v, j) => celula(`${letra(j + 1)}${r}`, v)).join("");
      return `<row r="${r}">${cs}</row>`;
    })
    .join("");

  return (
    `${CABECALHO_XML}<worksheet xmlns="${NS}">` +
    `<dimension ref="A1:${ultima}${totalLinhas}"/>` +
    `<sheetViews><sheetView workbookViewId="0">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData><row r="1">${cabecalho}</row>${corpo}</sheetData>` +
    `<autoFilter ref="A1:${ultima}${totalLinhas}"/>` +
    `</worksheet>`
  );
}

const ESTILOS =
  `${CABECALHO_XML}<styleSheet xmlns="${NS}">` +
  `<numFmts count="2">` +
  `<numFmt numFmtId="164" formatCode="dd/mm/yyyy"/>` +
  `<numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/>` +
  `</numFmts>` +
  `<fonts count="2">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="3">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="4">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
  `</cellXfs>` +
  // Sem o estilo "Normal" declarado, alguns leitores reclamam que a pasta não
  // tem estilo padrão antes de abrir.
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

export function gerarXlsx(abas: Aba[]): Blob {
  const usados = new Set<string>();
  const nomes = abas.map((a) => nomeAba(a.nome, usados));

  const relsPlanilhas = nomes
    .map(
      (_n, i) =>
        `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("");

  const arquivos = [
    {
      nome: "[Content_Types].xml",
      conteudo:
        `${CABECALHO_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        nomes
          .map(
            (_n, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join("") +
        `</Types>`,
    },
    {
      nome: "_rels/.rels",
      conteudo:
        `${CABECALHO_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      nome: "xl/workbook.xml",
      conteudo:
        `${CABECALHO_XML}<workbook xmlns="${NS}" xmlns:r="${NS_REL}"><sheets>` +
        nomes
          .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join("") +
        `</sheets></workbook>`,
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      conteudo:
        `${CABECALHO_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        relsPlanilhas +
        `<Relationship Id="rId${nomes.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    },
    { nome: "xl/styles.xml", conteudo: ESTILOS },
    ...abas.map((a, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, conteudo: abaXml(a) })),
  ];

  return zip(arquivos.map((a) => ({ nome: a.nome, dados: bytes(a.conteudo) })));
}

export function baixarXlsx(arquivo: string, abas: Aba[]): void {
  const url = URL.createObjectURL(gerarXlsx(abas));
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo;
  a.click();
  URL.revokeObjectURL(url);
}
