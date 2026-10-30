/**
 * Dump do CRM em .xlsx: contatos, histórico, simulações e cotas, uma aba cada.
 *
 * As primeiras colunas da aba Contatos são exatamente as do modelo de importação,
 * na mesma ordem — exportar, mexer no Excel e reimportar tem que funcionar. O que
 * vem depois é o resto do cadastro (documentos, endereço, bancários) e os campos
 * de controle, com o ID interno por último, onde não incomoda.
 *
 * Datas saem como Date para o Excel tratar como data, não como texto: assim o
 * filtro "é depois de" e a ordenação funcionam.
 */

import type { Aba, Celula } from "@/lib/xlsx";
import { baixarXlsx } from "@/lib/xlsx";
import { COLUNAS_CONTATO } from "@/lib/planilha";
import type {
  Contato,
  Cota,
  Etapa,
  Interacao,
  Origem,
  Simulacao,
  Usuario,
} from "@/lib/types";
import { SEGMENTOS, STATUS_COTA, TEMPERATURAS, TIPOS_INTERACAO } from "@/lib/types";

export interface DadosCrm {
  contatos: Contato[];
  interacoes: Interacao[];
  simulacoes: Simulacao[];
  cotas: Cota[];
  etapas: Etapa[];
  origens: Origem[];
  usuarios: Usuario[];
}

/** "2026-10-30" → 30/10/2026 no Excel, sem hora e sem fuso atravessado. */
function dia(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = v.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

/** Timestamp do banco → data e hora no fuso de quem está exportando. */
function instante(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const rotuloSegmento = (v: string) => SEGMENTOS.find((s) => s.valor === v)?.rotulo ?? v;
const rotuloStatus = (v: string) => STATUS_COTA.find((s) => s.valor === v)?.rotulo ?? v;
const rotuloTemperatura = (v: string) => TEMPERATURAS.find((t) => t.valor === v)?.rotulo ?? v;
const rotuloTipo = (v: string | null) =>
  v ? (TIPOS_INTERACAO.find((t) => t.valor === v)?.rotulo ?? v) : "";

const EXTRAS_CONTATO = [
  "CNPJ",
  "RG",
  "Órgão emissor",
  "Data de nascimento",
  "Naturalidade",
  "Profissão",
  "Banco",
  "Agência",
  "Conta",
  "CEP",
  "Logradouro",
  "Número",
  "Complemento",
  "Bairro",
  "Cidade (endereço)",
  "UF",
  "Interações",
  "Simulações",
  "Cotas",
  "Arquivado",
  "Cadastrado por",
  "Cadastrado em",
  "Atualizado em",
  "ID",
] as const;

export function abasCrm(d: DadosCrm): Aba[] {
  const nome = <T extends { id: string; nome: string }>(lista: T[]) =>
    new Map(lista.map((x) => [x.id, x.nome]));
  const etapas = nome(d.etapas);
  const origens = nome(d.origens);
  const pessoas = nome(d.usuarios);
  const contatos = new Map(d.contatos.map((c) => [c.id, c]));

  const conta = <T>(itens: T[], chave: (x: T) => string | null) => {
    const m = new Map<string, number>();
    for (const x of itens) {
      const k = chave(x);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const porInteracao = conta(d.interacoes, (i) => i.contato_id);
  const porSimulacao = conta(d.simulacoes, (s) => s.contato_id);
  const porCota = conta(d.cotas, (c) => c.contato_id);

  const abaContatos: Aba = {
    nome: "Contatos",
    colunas: [...COLUNAS_CONTATO, ...EXTRAS_CONTATO],
    linhas: d.contatos.map((c): Celula[] => [
      c.nome,
      c.telefone,
      c.email,
      c.cpf,
      c.cidade,
      c.origem_id ? (origens.get(c.origem_id) ?? "") : "",
      c.indicado_por_id ? (contatos.get(c.indicado_por_id)?.nome ?? "") : c.indicado_por,
      c.interesse,
      c.valor_estimado,
      c.etapa_id ? (etapas.get(c.etapa_id) ?? "") : "",
      rotuloTemperatura(c.temperatura),
      c.responsavel_id ? (pessoas.get(c.responsavel_id) ?? "") : "",
      dia(c.ultimo_contato_em),
      c.proxima_acao,
      dia(c.proxima_acao_em),
      c.tags?.join("; ") ?? "",
      c.obs,

      c.cnpj,
      c.rg,
      c.rg_emissor,
      dia(c.data_nascimento),
      c.naturalidade,
      c.profissao,
      c.banco,
      c.agencia,
      c.conta,
      c.cep,
      c.logradouro,
      c.numero,
      c.complemento,
      c.bairro,
      c.endereco_cidade,
      c.uf,
      porInteracao.get(c.id) ?? 0,
      porSimulacao.get(c.id) ?? 0,
      porCota.get(c.id) ?? 0,
      c.arquivado ? "Sim" : "Não",
      c.criado_por ? (pessoas.get(c.criado_por) ?? "") : "",
      instante(c.criado_em),
      instante(c.updated_at),
      c.id,
    ]),
  };

  const abaHistorico: Aba = {
    nome: "Histórico",
    colunas: [
      "Data",
      "Cliente",
      "Telefone",
      "Tipo",
      "Resumo",
      "Etapa anterior",
      "Etapa nova",
      "Registrado por",
      "Automática",
      "Contato ID",
    ],
    linhas: d.interacoes.map((i): Celula[] => {
      const c = contatos.get(i.contato_id);
      return [
        instante(i.data),
        c?.nome ?? "",
        c?.telefone ?? "",
        rotuloTipo(i.tipo),
        i.resumo,
        i.etapa_antes ? (etapas.get(i.etapa_antes) ?? "") : "",
        i.etapa_depois ? (etapas.get(i.etapa_depois) ?? "") : "",
        i.usuario_id ? (pessoas.get(i.usuario_id) ?? "") : "",
        i.automatica ? "Sim" : "Não",
        i.contato_id,
      ];
    }),
  };

  const abaSimulacoes: Aba = {
    nome: "Simulações",
    colunas: [
      "Data",
      "Título",
      "Cliente",
      "Administradora",
      "Segmento",
      "Crédito",
      "Prazo (meses)",
      "Parcela",
      "Parcela digitada",
      "Taxa adm (%)",
      "Fundo de reserva (%)",
      "Seguro mensal (%)",
      "Lance próprio",
      "Lance embutido (%)",
      "Mês da contemplação",
      "Redução",
      "Total desembolsado",
      "Feita por",
      "Contato ID",
    ],
    linhas: d.simulacoes.map((s): Celula[] => [
      instante(s.criado_em),
      s.titulo,
      s.cliente_nome || (s.contato_id ? (contatos.get(s.contato_id)?.nome ?? "") : ""),
      s.administradora,
      rotuloSegmento(s.segmento),
      s.credito,
      s.prazo_meses,
      s.parcela,
      s.parcela_manual,
      s.taxa_adm,
      s.fundo_reserva,
      s.seguro_mensal,
      s.lance_proprio,
      s.lance_embutido_pct,
      s.mes_contemplacao,
      s.reducao === "prazo" ? "Prazo" : "Parcela",
      s.total_pago,
      s.usuario_id ? (pessoas.get(s.usuario_id) ?? "") : "",
      s.contato_id,
    ]),
  };

  const abaCotas: Aba = {
    nome: "Cotas",
    colunas: [
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
      "Como",
      "Vendedor",
      "Observações",
      "Contato ID",
    ],
    linhas: d.cotas.map((c): Celula[] => [
      c.cliente_nome,
      c.administradora,
      rotuloSegmento(c.segmento),
      c.grupo,
      c.cota,
      c.credito,
      c.parcela,
      c.prazo_meses,
      c.parcelas_pagas,
      c.parcelas_comissao,
      dia(c.data_venda),
      rotuloStatus(c.status),
      dia(c.contemplada_em),
      c.forma === "lance" ? "Lance" : c.forma === "sorteio" ? "Sorteio" : "",
      c.vendedor_id ? (pessoas.get(c.vendedor_id) ?? "") : "",
      c.obs,
      c.contato_id,
    ]),
  };

  return [abaContatos, abaHistorico, abaSimulacoes, abaCotas];
}

export function exportarCrm(d: DadosCrm): void {
  const hoje = new Date().toISOString().slice(0, 10);
  baixarXlsx(`crm-${hoje}.xlsx`, abasCrm(d));
}
