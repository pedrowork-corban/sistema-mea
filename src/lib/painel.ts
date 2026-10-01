/**
 * Cálculo dos indicadores do painel.
 *
 * Tudo aqui é função pura sobre os dados que o CRM já tem — nada é digitado à
 * mão em lugar nenhum. Fica fora do React de propósito: facilita conferir a
 * conta e deixa a tela só com apresentação.
 *
 * A agregação roda no navegador, não no banco. Com o volume da M&A isso é
 * instantâneo e tem uma vantagem real: a RLS já entregou só o que a pessoa
 * pode ver, então o painel respeita permissão de graça. Uma view agregada no
 * Postgres precisaria repetir essa regra e poderia vazar o total da empresa
 * para quem só enxerga a própria carteira.
 */

import type { Contato, Cota, Etapa, Interacao, Origem, Usuario } from "./types";
import { diasAte, diasDesde, hoje } from "./utils";

export interface Periodo {
  inicio: string; // aaaa-mm-dd, inclusivo
  fim: string; // aaaa-mm-dd, inclusivo
  rotulo: string;
}

export type ChavePeriodo = "7d" | "30d" | "90d" | "mes" | "mes_passado" | "ano" | "tudo";

const DIA = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const soma = (base: string, dias: number) => iso(new Date(new Date(`${base}T12:00:00`).getTime() + dias * DIA));

export const PERIODOS: { valor: ChavePeriodo; rotulo: string }[] = [
  { valor: "7d", rotulo: "Últimos 7 dias" },
  { valor: "30d", rotulo: "Últimos 30 dias" },
  { valor: "90d", rotulo: "Últimos 90 dias" },
  { valor: "mes", rotulo: "Este mês" },
  { valor: "mes_passado", rotulo: "Mês passado" },
  { valor: "ano", rotulo: "Este ano" },
  { valor: "tudo", rotulo: "Desde o começo" },
];

export function montarPeriodo(chave: ChavePeriodo): Periodo {
  const h = hoje();
  const [ano, mes] = h.split("-").map(Number);
  const rotulo = PERIODOS.find((p) => p.valor === chave)!.rotulo;
  const ultimoDia = (a: number, m: number) => new Date(a, m, 0).getDate();

  switch (chave) {
    case "7d":
      return { inicio: soma(h, -6), fim: h, rotulo };
    case "30d":
      return { inicio: soma(h, -29), fim: h, rotulo };
    case "90d":
      return { inicio: soma(h, -89), fim: h, rotulo };
    case "mes":
      return { inicio: `${ano}-${String(mes).padStart(2, "0")}-01`, fim: h, rotulo };
    case "mes_passado": {
      const a = mes === 1 ? ano - 1 : ano;
      const m = mes === 1 ? 12 : mes - 1;
      const mm = String(m).padStart(2, "0");
      return { inicio: `${a}-${mm}-01`, fim: `${a}-${mm}-${ultimoDia(a, m)}`, rotulo };
    }
    case "ano":
      return { inicio: `${ano}-01-01`, fim: h, rotulo };
    case "tudo":
      return { inicio: "2000-01-01", fim: h, rotulo };
  }
}

/** Mesma duração, imediatamente antes. É com isso que a variação % compara. */
export function periodoAnterior(p: Periodo): Periodo {
  const dias = Math.round(
    (new Date(`${p.fim}T12:00:00`).getTime() - new Date(`${p.inicio}T12:00:00`).getTime()) / DIA,
  );
  return {
    inicio: soma(p.inicio, -(dias + 1)),
    fim: soma(p.inicio, -1),
    rotulo: "período anterior",
  };
}

const dentro = (data: string | null | undefined, p: Periodo) =>
  !!data && data.slice(0, 10) >= p.inicio && data.slice(0, 10) <= p.fim;

/** Variação percentual. null quando não havia base de comparação. */
export function variacao(agora: number, antes: number): number | null {
  if (antes === 0) return agora === 0 ? 0 : null;
  return ((agora - antes) / antes) * 100;
}

/* --------------------------------- Vendas --------------------------------- */

export interface ResumoVendas {
  vendas: number;
  credito: number;
  ticket: number;
  parcelaMensal: number;
  contempladas: number;
  porSegmento: { chave: string; vendas: number; credito: number }[];
  porAdministradora: { chave: string; vendas: number; credito: number }[];
}

export function resumoVendas(cotas: Cota[], p: Periodo): ResumoVendas {
  // Cancelada não é venda. Sai de tudo, inclusive do ticket médio — senão uma
  // cota cancelada derruba a média de quem vendeu bem.
  const noPeriodo = cotas.filter((c) => c.status !== "cancelada" && dentro(c.data_venda, p));
  const credito = noPeriodo.reduce((s, c) => s + Number(c.credito), 0);

  const agrupar = (chave: (c: Cota) => string) => {
    const m = new Map<string, { vendas: number; credito: number }>();
    for (const c of noPeriodo) {
      const k = chave(c);
      const a = m.get(k) ?? { vendas: 0, credito: 0 };
      m.set(k, { vendas: a.vendas + 1, credito: a.credito + Number(c.credito) });
    }
    return [...m.entries()]
      .map(([chave, v]) => ({ chave, ...v }))
      .sort((a, b) => b.credito - a.credito);
  };

  return {
    vendas: noPeriodo.length,
    credito,
    ticket: noPeriodo.length ? credito / noPeriodo.length : 0,
    parcelaMensal: noPeriodo.reduce((s, c) => s + Number(c.parcela ?? 0), 0),
    contempladas: cotas.filter((c) => dentro(c.contemplada_em, p)).length,
    porSegmento: agrupar((c) => c.segmento),
    porAdministradora: agrupar((c) => c.administradora),
  };
}

/* --------------------------------- Carteira ------------------------------- */

export interface SaudeCarteira {
  ativas: number;
  contempladas: number;
  quitadas: number;
  canceladas: number;
  creditoVivo: number;
  parcelaMensal: number;
  taxaContemplacao: number; // % das cotas vendidas que já foram contempladas
  taxaCancelamento: number; // % de desistência — o indicador que dói
  porSorteio: number;
  porLance: number;
  /** Cotas que já deveriam ter parcela paga e estão com o pagamento atrasado. */
  parcelasEmAtraso: number;
}

export function saudeCarteira(cotas: Cota[]): SaudeCarteira {
  const conta = (s: Cota["status"]) => cotas.filter((c) => c.status === s).length;
  const ativas = conta("ativa");
  const contempladas = conta("contemplada");
  const quitadas = conta("quitada");
  const canceladas = conta("cancelada");
  const vivas = cotas.filter((c) => c.status !== "cancelada");

  // Quantas parcelas já deveriam ter sido pagas desde a venda. Mês cheio só:
  // o cliente paga no mês seguinte à adesão, então arredonda para baixo.
  const emAtraso = vivas.filter((c) => {
    const dias = diasDesde(c.data_venda);
    if (dias === null) return false;
    const esperadas = Math.min(Math.floor(dias / 30), c.prazo_meses);
    return c.parcelas_pagas < esperadas - 1; // 1 mês de folga, boleto atrasa
  }).length;

  return {
    ativas,
    contempladas,
    quitadas,
    canceladas,
    creditoVivo: vivas.reduce((s, c) => s + Number(c.credito), 0),
    parcelaMensal: cotas
      .filter((c) => c.status === "ativa" || c.status === "contemplada")
      .reduce((s, c) => s + Number(c.parcela ?? 0), 0),
    taxaContemplacao: cotas.length ? ((contempladas + quitadas) / cotas.length) * 100 : 0,
    taxaCancelamento: cotas.length ? (canceladas / cotas.length) * 100 : 0,
    porSorteio: cotas.filter((c) => c.forma === "sorteio").length,
    porLance: cotas.filter((c) => c.forma === "lance").length,
    parcelasEmAtraso: emAtraso,
  };
}

/* ---------------------------------- Funil --------------------------------- */

export interface ResumoFunil {
  porEtapa: { etapa: Etapa; contatos: number; valor: number }[];
  novos: number;
  ganhos: number;
  perdidos: number;
  conversao: number; // % dos decididos que viraram venda
  pipeline: number; // R$ parado em etapa aberta
  emAberto: number;
  cicloMedioDias: number | null; // da entrada do lead até fechar
}

export function resumoFunil(
  contatos: Contato[],
  etapas: Etapa[],
  interacoes: Interacao[],
  p: Periodo,
): ResumoFunil {
  const porId = new Map(etapas.map((e) => [e.id, e]));
  const tipoDe = (id: string | null) => (id ? porId.get(id)?.tipo : undefined);

  const porEtapa = etapas.map((etapa) => {
    const lista = contatos.filter((c) => c.etapa_id === etapa.id);
    return {
      etapa,
      contatos: lista.length,
      valor: lista.reduce((s, c) => s + Number(c.valor_estimado ?? 0), 0),
    };
  });

  // Ganho/perdido vêm do histórico de movimentação, não da etapa atual: o que
  // interessa é o que foi decidido dentro do período, não onde o contato está
  // parado hoje.
  const movidas = interacoes.filter((i) => i.etapa_depois && dentro(i.data, p));
  const ganhos = movidas.filter((i) => tipoDe(i.etapa_depois) === "ganha").length;
  const perdidos = movidas.filter((i) => tipoDe(i.etapa_depois) === "perdida").length;
  const decididos = ganhos + perdidos;

  // Ciclo de venda: da criação do contato até a interação que o marcou ganho.
  const ciclos: number[] = [];
  for (const i of movidas) {
    if (tipoDe(i.etapa_depois) !== "ganha") continue;
    const c = contatos.find((x) => x.id === i.contato_id);
    if (!c) continue;
    const dias = Math.round(
      (new Date(i.data).getTime() - new Date(c.criado_em).getTime()) / DIA,
    );
    if (dias >= 0) ciclos.push(dias);
  }

  const abertos = contatos.filter((c) => !c.etapa_id || tipoDe(c.etapa_id) === "aberta");

  return {
    porEtapa,
    novos: contatos.filter((c) => dentro(c.criado_em, p)).length,
    ganhos,
    perdidos,
    conversao: decididos ? (ganhos / decididos) * 100 : 0,
    pipeline: abertos.reduce((s, c) => s + Number(c.valor_estimado ?? 0), 0),
    emAberto: abertos.length,
    cicloMedioDias: ciclos.length
      ? Math.round(ciclos.reduce((a, b) => a + b, 0) / ciclos.length)
      : null,
  };
}

/* ------------------------------- Atividades ------------------------------- */

export interface ResumoAtividades {
  total: number;
  porTipo: { tipo: string; total: number }[];
  mediaDia: number;
  diasComAtividade: number;
  /** Série diária para o gráfico, já com os dias vazios preenchidos. */
  serie: { dia: string; total: number }[];
}

export function resumoAtividades(interacoes: Interacao[], p: Periodo): ResumoAtividades {
  // Mudança de etapa é registro do sistema. Contar como atividade inflaria o
  // número de quem só arrasta card no kanban sem falar com ninguém.
  const reais = interacoes.filter((i) => !i.automatica && dentro(i.data, p));

  const porDia = new Map<string, number>();
  for (const i of reais) {
    const d = i.data.slice(0, 10);
    porDia.set(d, (porDia.get(d) ?? 0) + 1);
  }

  const serie: { dia: string; total: number }[] = [];
  const fim = new Date(`${p.fim}T12:00:00`).getTime();
  // Teto de 90 colunas: acima disso a barra fica fina demais para ler.
  for (let d = new Date(`${p.inicio}T12:00:00`).getTime(); d <= fim; d += DIA) {
    const dia = iso(new Date(d));
    serie.push({ dia, total: porDia.get(dia) ?? 0 });
  }
  const recorte = serie.length > 90 ? serie.slice(-90) : serie;

  const tipos = new Map<string, number>();
  for (const i of reais) tipos.set(i.tipo, (tipos.get(i.tipo) ?? 0) + 1);

  return {
    total: reais.length,
    porTipo: [...tipos.entries()]
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total),
    mediaDia: recorte.length ? reais.length / recorte.length : 0,
    diasComAtividade: porDia.size,
    serie: recorte,
  };
}

/* ------------------------- Follow-up e saúde da base ---------------------- */

export interface Pendencias {
  atrasadas: number;
  paraHoje: number;
  proximos7: number;
  semProximaAcao: number;
  semTelefone: number;
  semResponsavel: number;
  parados30: number;
  nuncaContatados: number;
  /** Quem está mais atrasado, para a tela mandar direto ao ponto. */
  piores: { contato: Contato; diasAtraso: number }[];
}

export function pendencias(contatos: Contato[], etapas: Etapa[]): Pendencias {
  const abertas = new Set(etapas.filter((e) => e.tipo === "aberta").map((e) => e.id));
  // Só cobra follow-up de quem ainda está em jogo. Cliente fechado ou perdido
  // não deve aparecer como atraso.
  const ativos = contatos.filter((c) => !c.etapa_id || abertas.has(c.etapa_id));

  const atrasados: { contato: Contato; diasAtraso: number }[] = [];
  let paraHoje = 0;
  let proximos7 = 0;

  for (const c of ativos) {
    const d = diasAte(c.proxima_acao_em);
    if (d === null) continue;
    if (d < 0) atrasados.push({ contato: c, diasAtraso: -d });
    else if (d === 0) paraHoje++;
    else if (d <= 7) proximos7++;
  }

  return {
    atrasadas: atrasados.length,
    paraHoje,
    proximos7,
    semProximaAcao: ativos.filter((c) => !c.proxima_acao_em).length,
    semTelefone: ativos.filter((c) => !c.telefone).length,
    semResponsavel: ativos.filter((c) => !c.responsavel_id).length,
    parados30: ativos.filter((c) => {
      const d = diasDesde(c.ultimo_contato_em);
      return d !== null && d >= 30;
    }).length,
    nuncaContatados: ativos.filter((c) => !c.ultimo_contato_em).length,
    piores: atrasados.sort((a, b) => b.diasAtraso - a.diasAtraso).slice(0, 8),
  };
}

/* --------------------------------- Origens -------------------------------- */

export interface LinhaOrigem {
  nome: string;
  leads: number;
  ganhos: number;
  conversao: number;
  valor: number;
}

export function porOrigem(contatos: Contato[], origens: Origem[], etapas: Etapa[]): LinhaOrigem[] {
  const ganhas = new Set(etapas.filter((e) => e.tipo === "ganha").map((e) => e.id));
  const nome = new Map(origens.map((o) => [o.id, o.nome]));

  const m = new Map<string, { leads: number; ganhos: number; valor: number }>();
  for (const c of contatos) {
    const k = (c.origem_id && nome.get(c.origem_id)) || "Sem origem";
    const a = m.get(k) ?? { leads: 0, ganhos: 0, valor: 0 };
    const ganhou = !!c.etapa_id && ganhas.has(c.etapa_id);
    m.set(k, {
      leads: a.leads + 1,
      ganhos: a.ganhos + (ganhou ? 1 : 0),
      valor: a.valor + (ganhou ? Number(c.valor_estimado ?? 0) : 0),
    });
  }

  return [...m.entries()]
    .map(([nome, v]) => ({
      nome,
      ...v,
      conversao: v.leads ? (v.ganhos / v.leads) * 100 : 0,
    }))
    .sort((a, b) => b.leads - a.leads);
}

/* --------------------------------- Ranking -------------------------------- */

export interface LinhaRanking {
  usuario: Usuario;
  vendas: number;
  credito: number;
  ticket: number;
  atividades: number;
  leads: number;
  emAberto: number;
  atrasadas: number;
  ganhos: number;
  conversao: number;
}

export function ranking(
  usuarios: Usuario[],
  contatos: Contato[],
  cotas: Cota[],
  interacoes: Interacao[],
  etapas: Etapa[],
  p: Periodo,
): LinhaRanking[] {
  const porId = new Map(etapas.map((e) => [e.id, e]));
  const abertas = new Set(etapas.filter((e) => e.tipo === "aberta").map((e) => e.id));

  return usuarios
    .map((u) => {
      const minhas = cotas.filter(
        (c) => c.vendedor_id === u.id && c.status !== "cancelada" && dentro(c.data_venda, p),
      );
      const credito = minhas.reduce((s, c) => s + Number(c.credito), 0);
      const meus = contatos.filter((c) => c.responsavel_id === u.id);
      const movidas = interacoes.filter(
        (i) => i.usuario_id === u.id && i.etapa_depois && dentro(i.data, p),
      );
      const ganhos = movidas.filter((i) => porId.get(i.etapa_depois!)?.tipo === "ganha").length;
      const perdidos = movidas.filter((i) => porId.get(i.etapa_depois!)?.tipo === "perdida").length;
      const abertos = meus.filter((c) => !c.etapa_id || abertas.has(c.etapa_id));

      return {
        usuario: u,
        vendas: minhas.length,
        credito,
        ticket: minhas.length ? credito / minhas.length : 0,
        atividades: interacoes.filter(
          (i) => i.usuario_id === u.id && !i.automatica && dentro(i.data, p),
        ).length,
        leads: meus.filter((c) => dentro(c.criado_em, p)).length,
        emAberto: abertos.length,
        atrasadas: abertos.filter((c) => {
          const d = diasAte(c.proxima_acao_em);
          return d !== null && d < 0;
        }).length,
        ganhos,
        conversao: ganhos + perdidos ? (ganhos / (ganhos + perdidos)) * 100 : 0,
      };
    })
    .sort((a, b) => b.credito - a.credito || b.atividades - a.atividades);
}

/* ------------------------------ Evolução mensal --------------------------- */

export interface MesSerie {
  mes: string; // aaaa-mm
  rotulo: string; // "set/26"
  vendas: number;
  credito: number;
  leads: number;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Últimos N meses até hoje, sempre completos — mês sem venda aparece zerado. */
export function evolucaoMensal(cotas: Cota[], contatos: Contato[], meses = 12): MesSerie[] {
  const h = new Date(`${hoje()}T12:00:00`);
  const linhas: MesSerie[] = [];

  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(h.getFullYear(), h.getMonth() - i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const vendidas = cotas.filter(
      (c) => c.status !== "cancelada" && c.data_venda?.slice(0, 7) === mes,
    );
    linhas.push({
      mes,
      rotulo: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      vendas: vendidas.length,
      credito: vendidas.reduce((s, c) => s + Number(c.credito), 0),
      leads: contatos.filter((c) => c.criado_em.slice(0, 7) === mes).length,
    });
  }
  return linhas;
}
