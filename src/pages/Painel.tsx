/**
 * Painel — a leitura do negócio a partir do que o CRM já registrou.
 *
 * Nenhum número é digitado aqui: tudo vem de contatos, interações e cotas.
 * Se um indicador aparece zerado, é porque o dado não foi lançado no CRM —
 * e isso em si já é a informação.
 */

import * as React from "react";
import {
  AlarmClock,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  Clock,
  Flame,
  Minus,
  Phone,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useContatos, useEtapas, useOrigens, useTodasInteracoes, useUsuarios } from "@/hooks/useCrm";
import { useCotas } from "@/hooks/useSimulador";
import FichaContato from "@/components/FichaContato";
import { BarrasHorizontais, Colunas, Funil, Rosca } from "@/components/graficos";
import { Cartao, Carregando, Select, Selo } from "@/components/ui";
import { SEGMENTOS, TIPOS_INTERACAO } from "@/lib/types";
import type { Contato } from "@/lib/types";
import {
  evolucaoMensal,
  montarPeriodo,
  pendencias,
  periodoAnterior,
  porOrigem,
  PERIODOS,
  ranking,
  resumoAtividades,
  resumoFunil,
  resumoVendas,
  saudeCarteira,
  variacao,
  type ChavePeriodo,
} from "@/lib/painel";
import { cn, formatarData, moeda, pct } from "@/lib/utils";

/* ------------------------------- Peças da tela ---------------------------- */

function Secao({
  titulo,
  descricao,
  acao,
  children,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
          {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Indicador principal. A variação só aparece quando há com o que comparar. */
function Indicador({
  icone: Icone,
  rotulo,
  valor,
  nota,
  variacaoPct,
  // Em cancelamento e atraso, subir é ruim. Sem isso o verde mentiria.
  subirEhBom = true,
  destaque,
}: {
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  valor: string;
  nota?: string;
  variacaoPct?: number | null;
  subirEhBom?: boolean;
  destaque?: boolean;
}) {
  const v = variacaoPct;
  const neutro = v === undefined || v === null || Math.abs(v) < 0.5;
  const bom = v != null && (v > 0) === subirEhBom;
  const Seta = neutro ? Minus : v! > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Cartao className={cn("p-3.5", destaque && "ring-1 ring-primary/30")}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icone className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-[11px] font-medium uppercase tracking-wide">{rotulo}</span>
      </div>
      <p className="mt-1.5 truncate font-num text-2xl font-semibold leading-none text-foreground">
        {valor}
      </p>
      <div className="mt-1.5 flex min-h-[16px] items-center gap-1.5">
        {v !== undefined && v !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-num text-[11px] font-medium",
              neutro ? "text-muted-foreground" : bom ? "text-emerald-600" : "text-destructive",
            )}
          >
            <Seta className="h-3 w-3" />
            {Math.abs(v) >= 999 ? "+999%" : `${Math.abs(v).toFixed(0)}%`}
          </span>
        )}
        {nota && <span className="truncate text-[11px] text-muted-foreground">{nota}</span>}
      </div>
    </Cartao>
  );
}

/** Contador clicável das pendências. Leva direto para a lista de trabalho. */
function Pendencia({
  rotulo,
  valor,
  tom = "neutro",
}: {
  rotulo: string;
  valor: number;
  tom?: "neutro" | "alerta" | "perigo";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="min-w-0 truncate text-xs text-muted-foreground">{rotulo}</span>
      <span
        className={cn(
          "shrink-0 font-num text-sm font-semibold tabular-nums",
          valor === 0
            ? "text-muted-foreground"
            : tom === "perigo"
              ? "text-destructive"
              : tom === "alerta"
                ? "text-amber-600"
                : "text-foreground",
        )}
      >
        {valor}
      </span>
    </div>
  );
}

const CORES = ["#0B5394", "#F6E27F", "#2E7D32", "#B45F06", "#7F6000", "#C0392B", "#7F7979"];

/* --------------------------------- Página --------------------------------- */

export default function Painel() {
  const { usuario, pode } = useAuth();
  const { data: contatos = [], isLoading: carregandoContatos } = useContatos();
  const { data: etapas = [] } = useEtapas();
  const { data: origens = [] } = useOrigens();
  const { data: usuarios = [] } = useUsuarios();
  const { data: interacoes = [], isLoading: carregandoInteracoes } = useTodasInteracoes();
  const { data: cotas = [] } = useCotas();

  const [chave, setChave] = React.useState<ChavePeriodo>("30d");
  const [quem, setQuem] = React.useState<string>("");
  const [abertoId, setAbertoId] = React.useState<string | null>(null);

  const periodo = React.useMemo(() => montarPeriodo(chave), [chave]);
  const anterior = React.useMemo(() => periodoAnterior(periodo), [periodo]);

  // O filtro por pessoa recorta as três bases pelo mesmo critério: contato sob
  // responsabilidade dela, venda feita por ela, atividade registrada por ela.
  const base = React.useMemo(() => {
    if (!quem) return { contatos, cotas, interacoes };
    return {
      contatos: contatos.filter((c) => c.responsavel_id === quem),
      cotas: cotas.filter((c) => c.vendedor_id === quem),
      interacoes: interacoes.filter((i) => i.usuario_id === quem),
    };
  }, [contatos, cotas, interacoes, quem]);

  const vendas = React.useMemo(() => resumoVendas(base.cotas, periodo), [base.cotas, periodo]);
  const vendasAntes = React.useMemo(
    () => resumoVendas(base.cotas, anterior),
    [base.cotas, anterior],
  );
  const carteira = React.useMemo(() => saudeCarteira(base.cotas), [base.cotas]);
  const funil = React.useMemo(
    () => resumoFunil(base.contatos, etapas, base.interacoes, periodo),
    [base.contatos, etapas, base.interacoes, periodo],
  );
  const funilAntes = React.useMemo(
    () => resumoFunil(base.contatos, etapas, base.interacoes, anterior),
    [base.contatos, etapas, base.interacoes, anterior],
  );
  const atividades = React.useMemo(
    () => resumoAtividades(base.interacoes, periodo),
    [base.interacoes, periodo],
  );
  const atividadesAntes = React.useMemo(
    () => resumoAtividades(base.interacoes, anterior),
    [base.interacoes, anterior],
  );
  const pend = React.useMemo(() => pendencias(base.contatos, etapas), [base.contatos, etapas]);
  const origensLinhas = React.useMemo(
    () => porOrigem(base.contatos, origens, etapas),
    [base.contatos, origens, etapas],
  );
  const rank = React.useMemo(
    () => ranking(usuarios, contatos, cotas, interacoes, etapas, periodo),
    [usuarios, contatos, cotas, interacoes, etapas, periodo],
  );
  const meses = React.useMemo(
    () => evolucaoMensal(base.cotas, base.contatos),
    [base.cotas, base.contatos],
  );

  const aberto = contatos.find((c) => c.id === abertoId) ?? null;
  const verTodos = pode("crm.ver_todos");

  if (carregandoContatos || carregandoInteracoes) return <Carregando texto="Somando os números..." />;

  const rotuloSegmento = (s: string) => SEGMENTOS.find((x) => x.valor === s)?.rotulo ?? s;
  const rotuloTipo = (t: string) => TIPOS_INTERACAO.find((x) => x.valor === t)?.rotulo ?? t;

  return (
    <div className="flex min-h-screen flex-col">
      {/* cabeçalho e filtros */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/85 px-5 py-3.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold text-foreground">Painel</h1>
            <p className="text-xs text-muted-foreground">
              {periodo.rotulo} · {formatarData(periodo.inicio)} a {formatarData(periodo.fim)}
            </p>
          </div>

          <Select
            value={chave}
            onChange={(e) => setChave(e.target.value as ChavePeriodo)}
            className="h-9 w-auto min-w-[150px]"
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>{p.rotulo}</option>
            ))}
          </Select>

          {verTodos && (
            <Select
              value={quem}
              onChange={(e) => setQuem(e.target.value)}
              className="h-9 w-auto min-w-[160px]"
            >
              <option value="">Equipe inteira</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}{u.id === usuario?.id ? " (você)" : ""}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-7 px-5 py-5">
        {/* ---------------------------- topo: o resultado -------------------- */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Indicador
            icone={Trophy}
            rotulo="Vendas"
            valor={String(vendas.vendas)}
            variacaoPct={variacao(vendas.vendas, vendasAntes.vendas)}
            nota="no período"
            destaque
          />
          <Indicador
            icone={Wallet}
            rotulo="Crédito vendido"
            valor={moeda(vendas.credito)}
            variacaoPct={variacao(vendas.credito, vendasAntes.credito)}
          />
          <Indicador
            icone={Target}
            rotulo="Ticket médio"
            valor={moeda(vendas.ticket)}
            variacaoPct={variacao(vendas.ticket, vendasAntes.ticket)}
          />
          <Indicador
            icone={TrendingUp}
            rotulo="Conversão"
            valor={pct(funil.conversao, 0)}
            variacaoPct={variacao(funil.conversao, funilAntes.conversao)}
            nota={`${funil.ganhos}G · ${funil.perdidos}P`}
          />
          <Indicador
            icone={UserPlus}
            rotulo="Leads novos"
            valor={String(funil.novos)}
            variacaoPct={variacao(funil.novos, funilAntes.novos)}
          />
          <Indicador
            icone={Phone}
            rotulo="Atividades"
            valor={String(atividades.total)}
            variacaoPct={variacao(atividades.total, atividadesAntes.total)}
            nota={`${atividades.mediaDia.toFixed(1)}/dia`}
          />
        </div>

        {/* ---------------------------- funil + pendências ------------------- */}
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <Secao
            titulo="Funil"
            descricao={`${funil.emAberto} em aberto · ${moeda(funil.pipeline)} em negociação`}
            acao={
              funil.cicloMedioDias !== null ? (
                <Selo className="gap-1">
                  <Clock className="h-3 w-3" />
                  fecha em ~{funil.cicloMedioDias}d
                </Selo>
              ) : undefined
            }
          >
            <Cartao className="p-4">
              <Funil
                etapas={funil.porEtapa.map((e) => ({
                  rotulo: e.etapa.nome,
                  valor: e.contatos,
                  cor: e.etapa.cor,
                  valorSecundario: e.valor,
                }))}
                formatar={moeda}
              />
            </Cartao>
          </Secao>

          <Secao titulo="Precisa de ação" descricao="Fila de trabalho de hoje.">
            <Cartao className="divide-y divide-border/60 px-4 py-2">
              <Pendencia rotulo="Follow-up atrasado" valor={pend.atrasadas} tom="perigo" />
              <Pendencia rotulo="Marcado para hoje" valor={pend.paraHoje} tom="alerta" />
              <Pendencia rotulo="Próximos 7 dias" valor={pend.proximos7} />
              <Pendencia rotulo="Sem próxima ação" valor={pend.semProximaAcao} tom="alerta" />
              <Pendencia rotulo="Parados há 30+ dias" valor={pend.parados30} tom="alerta" />
              <Pendencia rotulo="Nunca contatados" valor={pend.nuncaContatados} tom="perigo" />
              <Pendencia rotulo="Sem telefone" valor={pend.semTelefone} />
              <Pendencia rotulo="Sem responsável" valor={pend.semResponsavel} />
            </Cartao>
          </Secao>
        </div>

        {/* ---------------------------- atrasados ---------------------------- */}
        {pend.piores.length > 0 && (
          <Secao
            titulo="Mais atrasados"
            descricao="Clique para abrir a ficha e resolver."
            acao={
              <Selo className="gap-1 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200">
                <AlarmClock className="h-3 w-3" />
                {pend.atrasadas} no total
              </Selo>
            }
          >
            <Cartao className="divide-y divide-border/60">
              {pend.piores.map(({ contato, diasAtraso }) => (
                <button
                  key={contato.id}
                  onClick={() => setAbertoId(contato.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{contato.nome}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {contato.proxima_acao ?? contato.interesse ?? "sem descrição"}
                    </p>
                  </div>
                  {contato.valor_estimado ? (
                    <span className="hidden font-num text-xs text-muted-foreground sm:block">
                      {moeda(contato.valor_estimado)}
                    </span>
                  ) : null}
                  <span className="shrink-0 rounded bg-red-100 px-1.5 py-px font-num text-[11px] font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
                    {diasAtraso}d
                  </span>
                </button>
              ))}
            </Cartao>
          </Secao>
        )}

        {/* ---------------------------- carteira ----------------------------- */}
        <Secao
          titulo="Carteira"
          descricao={`${carteira.ativas + carteira.contempladas + carteira.quitadas} cota(s) viva(s) · ${moeda(carteira.creditoVivo)} sob gestão`}
        >
          <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
            <Cartao className="p-4">
              <Rosca
                centro={String(carteira.ativas + carteira.contempladas + carteira.quitadas)}
                rotuloCentro="cotas vivas"
                fatias={[
                  { rotulo: "Ativas", valor: carteira.ativas, cor: "#0B5394" },
                  { rotulo: "Contempladas", valor: carteira.contempladas, cor: "#2E7D32" },
                  { rotulo: "Quitadas", valor: carteira.quitadas, cor: "#7F6000" },
                  { rotulo: "Canceladas", valor: carteira.canceladas, cor: "#C0392B" },
                ]}
              />
            </Cartao>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Indicador
                icone={Flame}
                rotulo="Contempladas"
                valor={String(vendas.contempladas)}
                nota="no período"
              />
              <Indicador
                icone={Target}
                rotulo="Taxa contemplação"
                valor={pct(carteira.taxaContemplacao, 0)}
                nota={`${carteira.porSorteio} sorteio · ${carteira.porLance} lance`}
              />
              <Indicador
                icone={Wallet}
                rotulo="Parcelas/mês"
                // O valor da parcela é opcional na cota. Sem nenhuma preenchida o
                // total seria R$ 0, que se lê como "ninguém paga nada" em vez de
                // "não foi informado" — então mostra travessão.
                valor={carteira.parcelaMensal > 0 ? moeda(carteira.parcelaMensal) : "—"}
                nota={carteira.parcelaMensal > 0 ? "pago pelos clientes" : "parcela não informada"}
              />
              <Indicador
                icone={AlarmClock}
                rotulo="Cancelamento"
                valor={pct(carteira.taxaCancelamento, 0)}
                nota={`${carteira.parcelasEmAtraso} com parcela atrasada`}
                subirEhBom={false}
              />
            </div>
          </div>
        </Secao>

        {/* ---------------------------- composição --------------------------- */}
        <div className="grid gap-5 lg:grid-cols-3">
          <Secao titulo="Por segmento" descricao="Crédito vendido no período.">
            <Cartao className="p-4">
              <BarrasHorizontais
                formatar={moeda}
                itens={vendas.porSegmento.map((s, i) => ({
                  rotulo: rotuloSegmento(s.chave),
                  valor: s.credito,
                  cor: CORES[i % CORES.length],
                  nota: `(${s.vendas})`,
                }))}
                vazio="Nenhuma venda lançada no período."
              />
            </Cartao>
          </Secao>

          <Secao titulo="Por administradora" descricao="Onde o volume está indo.">
            <Cartao className="p-4">
              <BarrasHorizontais
                formatar={moeda}
                itens={vendas.porAdministradora.map((s, i) => ({
                  rotulo: s.chave,
                  valor: s.credito,
                  cor: CORES[i % CORES.length],
                  nota: `(${s.vendas})`,
                }))}
                vazio="Nenhuma venda lançada no período."
              />
            </Cartao>
          </Secao>

          <Secao titulo="Tipo de contato" descricao="Como a equipe fala com o cliente.">
            <Cartao className="p-4">
              <BarrasHorizontais
                formatar={(v) => String(v)}
                itens={atividades.porTipo.map((t, i) => ({
                  rotulo: rotuloTipo(t.tipo),
                  valor: t.total,
                  cor: CORES[i % CORES.length],
                }))}
                vazio="Nenhuma interação registrada no período."
              />
            </Cartao>
          </Secao>
        </div>

        {/* ---------------------------- séries ------------------------------- */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Secao
            titulo="Ritmo de atividade"
            descricao={`${atividades.diasComAtividade} dia(s) com registro no período.`}
          >
            <Cartao className="p-4">
              <Colunas
                formatar={(v) => `${v} atividade(s)`}
                itens={atividades.serie.map((d) => ({
                  rotulo: d.dia.slice(8, 10),
                  valor: d.total,
                  detalhe: formatarData(d.dia),
                }))}
              />
            </Cartao>
          </Secao>

          <Secao titulo="Evolução mensal" descricao="Crédito vendido nos últimos 12 meses.">
            <Cartao className="p-4">
              <Colunas
                formatar={moeda}
                itens={meses.map((m) => ({
                  rotulo: m.rotulo,
                  valor: m.credito,
                  detalhe: `${m.vendas} venda(s) · ${m.leads} lead(s)`,
                }))}
              />
            </Cartao>
          </Secao>
        </div>

        {/* ---------------------------- origens ------------------------------ */}
        <Secao titulo="De onde vem o cliente" descricao="Lead que entra contra lead que fecha.">
          <Cartao className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Origem</th>
                  <th className="px-4 py-2.5 text-right font-medium">Leads</th>
                  <th className="px-4 py-2.5 text-right font-medium">Fechados</th>
                  <th className="px-4 py-2.5 text-right font-medium">Conversão</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor fechado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {origensLinhas.map((o) => (
                  <tr key={o.nome} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-2.5 text-foreground">{o.nome}</td>
                    <td className="px-4 py-2.5 text-right font-num tabular-nums">{o.leads}</td>
                    <td className="px-4 py-2.5 text-right font-num tabular-nums">{o.ganhos}</td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-num tabular-nums",
                        o.conversao >= 20 ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    >
                      {pct(o.conversao, 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-num tabular-nums text-muted-foreground">
                      {o.valor ? moeda(o.valor) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
        </Secao>

        {/* ---------------------------- ranking ------------------------------ */}
        {verTodos && usuarios.length > 1 && (
          <Secao
            titulo="Por pessoa"
            descricao="Ordenado por crédito vendido no período. Ignora o filtro de pessoa acima."
          >
            <Cartao className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Pessoa</th>
                    <th className="px-4 py-2.5 text-right font-medium">Vendas</th>
                    <th className="px-4 py-2.5 text-right font-medium">Crédito</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ticket</th>
                    <th className="px-4 py-2.5 text-right font-medium">Conversão</th>
                    <th className="px-4 py-2.5 text-right font-medium">Atividades</th>
                    <th className="px-4 py-2.5 text-right font-medium">Leads</th>
                    <th className="px-4 py-2.5 text-right font-medium">Em aberto</th>
                    <th className="px-4 py-2.5 text-right font-medium">Atrasados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rank.map((l) => (
                    <tr
                      key={l.usuario.id}
                      className={cn(
                        "transition-colors hover:bg-muted/40",
                        l.usuario.id === usuario?.id && "bg-primary/[0.04]",
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-foreground">{l.usuario.nome}</span>
                        {l.usuario.id === usuario?.id && (
                          <span className="ml-1.5 text-[11px] text-muted-foreground">você</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-num tabular-nums">{l.vendas}</td>
                      <td className="px-4 py-2.5 text-right font-num tabular-nums">
                        {l.credito ? moeda(l.credito) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-num tabular-nums text-muted-foreground">
                        {l.ticket ? moeda(l.ticket) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-num tabular-nums text-muted-foreground">
                        {l.ganhos ? pct(l.conversao, 0) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-num tabular-nums">{l.atividades}</td>
                      <td className="px-4 py-2.5 text-right font-num tabular-nums">{l.leads}</td>
                      <td className="px-4 py-2.5 text-right font-num tabular-nums text-muted-foreground">
                        {l.emAberto}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right font-num tabular-nums",
                          l.atrasadas > 0 ? "font-medium text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {l.atrasadas}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Cartao>
          </Secao>
        )}

        {/* ---------------------------- base --------------------------------- */}
        <Secao titulo="Base de contatos" descricao="Retrato de hoje, sem recorte de período.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Indicador icone={Users} rotulo="Contatos" valor={String(base.contatos.length)} />
            <Indicador icone={Target} rotulo="Em aberto" valor={String(funil.emAberto)} />
            <Indicador
              icone={Wallet}
              rotulo="Em negociação"
              valor={moeda(funil.pipeline)}
              nota="valor estimado"
            />
            <Indicador
              icone={CalendarCheck}
              rotulo="Com agenda"
              valor={pct(
                funil.emAberto ? ((funil.emAberto - pend.semProximaAcao) / funil.emAberto) * 100 : 0,
                0,
              )}
              nota="têm próxima ação"
            />
          </div>
        </Secao>
      </div>

      {aberto && <FichaContato contato={aberto as Contato} aoFechar={() => setAbertoId(null)} />}
    </div>
  );
}
