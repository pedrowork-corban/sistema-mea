import * as React from "react";
import {
  Copy,
  FileDown,
  History,
  ImageDown,
  MessageSquareText,
  Save,
  Sliders,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useContatos } from "@/hooks/useCrm";
import {
  useExcluirSimulacao,
  useSalvarSimulacao,
  useSimulacoes,
  useTabelas,
} from "@/hooks/useSimulador";
import { financiamento, simular, type Reducao } from "@/lib/consorcio";
import type { Segmento, Simulacao } from "@/lib/types";
import { SEGMENTOS } from "@/lib/types";
import {
  CartaoProposta,
  propostaEmTexto,
  TEMAS,
  type DadosProposta,
  type Marca,
} from "@/components/PropostaConsorcio";
import { baixarPdf, baixarPng, copiarImagem, copiarTexto } from "@/lib/exportar";
import { Botao, Campo, Cartao, Carregando, Input, Modal, Select, Vazio } from "@/components/ui";
import { cn, formatarDataHora, moeda, moedaExata, pct } from "@/lib/utils";

interface Form {
  tabelaId: string;
  administradora: string;
  segmento: Segmento;
  credito: number;
  prazoMeses: number;
  taxaAdm: number;
  fundoReserva: number;
  seguroMensal: number;
  lanceProprio: number;
  lanceEmbutidoPct: number;
  mesContemplacao: number;
  reducao: Reducao;
  compararFin: boolean;
  jurosMes: number;
  marca: Marca;
  titulo: string;
  contatoId: string;
  cliente: string;
}

const INICIAL: Form = {
  tabelaId: "",
  administradora: "Banco do Brasil",
  segmento: "auto",
  credito: 80_000,
  prazoMeses: 80,
  taxaAdm: 24,
  fundoReserva: 5.3,
  seguroMensal: 0.045,
  lanceProprio: 0,
  lanceEmbutidoPct: 0,
  mesContemplacao: 1,
  reducao: "parcela",
  compararFin: false,
  jurosMes: 1.8,
  marca: "ma",
  titulo: "Simulação de consórcio",
  contatoId: "",
  cliente: "",
};

/** Input numérico que aceita vírgula e não briga com o usuário enquanto digita. */
function Numero({
  valor,
  aoMudar,
  sufixo,
  ...props
}: {
  valor: number;
  aoMudar: (v: number) => void;
  sufixo?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [texto, setTexto] = React.useState(String(valor));
  const [focado, setFocado] = React.useState(false);

  React.useEffect(() => {
    if (!focado) setTexto(String(valor));
  }, [valor, focado]);

  return (
    <div className="relative">
      <Input
        {...props}
        inputMode="decimal"
        value={texto}
        onFocus={() => setFocado(true)}
        onBlur={() => {
          setFocado(false);
          setTexto(String(valor));
        }}
        onChange={(e) => {
          setTexto(e.target.value);
          const n = Number(e.target.value.replace(",", "."));
          if (!Number.isNaN(n)) aoMudar(n);
        }}
        className={cn("font-num tabular-nums", sufixo && "pr-9")}
      />
      {sufixo && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
          {sufixo}
        </span>
      )}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Cartao className="p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      {children}
    </Cartao>
  );
}

export default function Simulador() {
  const { usuario, papel, pode } = useAuth();
  const { data: tabelas = [], isLoading } = useTabelas();
  const { data: contatos = [] } = useContatos();
  const salvar = useSalvarSimulacao();

  const [f, setF] = React.useState<Form>(INICIAL);
  const [vendedor, setVendedor] = React.useState({ nome: "", cargo: "", telefone: "", email: "" });
  const [historicoAberto, setHistoricoAberto] = React.useState(false);
  const [exportando, setExportando] = React.useState<string | null>(null);
  const cartaoRef = React.useRef<HTMLDivElement>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // preenche o rodapé com os dados de quem está logado
  React.useEffect(() => {
    if (!usuario) return;
    setVendedor({
      nome: usuario.nome,
      cargo: papel?.nome ?? "Especialista em consórcio",
      telefone: usuario.telefone ?? "",
      email: usuario.email,
    });
  }, [usuario, papel]);

  // seleciona a primeira tabela assim que elas chegam
  React.useEffect(() => {
    if (f.tabelaId || tabelas.length === 0) return;
    aplicarTabela(tabelas[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabelas]);

  function aplicarTabela(id: string) {
    const t = tabelas.find((x) => x.id === id);
    if (!t) return;
    setF((p) => ({
      ...p,
      tabelaId: t.id,
      administradora: t.administradora,
      segmento: t.segmento,
      prazoMeses: t.prazo_meses,
      taxaAdm: Number(t.taxa_adm),
      fundoReserva: Number(t.fundo_reserva),
      seguroMensal: Number(t.seguro_mensal),
      lanceEmbutidoPct: Math.min(p.lanceEmbutidoPct, Number(t.lance_embutido_max)),
    }));
  }

  const tabela = tabelas.find((t) => t.id === f.tabelaId);

  const r = React.useMemo(
    () =>
      simular({
        credito: f.credito,
        prazoMeses: f.prazoMeses,
        taxaAdm: f.taxaAdm,
        fundoReserva: f.fundoReserva,
        seguroMensal: f.seguroMensal,
        lanceProprio: f.lanceProprio,
        lanceEmbutidoPct: f.lanceEmbutidoPct,
        mesContemplacao: f.mesContemplacao,
        reducao: f.reducao,
      }),
    [f],
  );

  const comparativo = React.useMemo(() => {
    if (!f.compararFin) return null;
    const fin = financiamento(f.credito, f.prazoMeses, f.jurosMes);
    return { jurosMes: f.jurosMes, parcela: fin.parcela, total: fin.total };
  }, [f.compararFin, f.credito, f.prazoMeses, f.jurosMes]);

  const dados: DadosProposta = {
    marca: f.marca,
    titulo: f.titulo,
    cliente: f.cliente,
    administradora: f.administradora,
    segmento: f.segmento,
    credito: f.credito,
    prazoMeses: f.prazoMeses,
    taxaAdm: f.taxaAdm,
    fundoReserva: f.fundoReserva,
    lanceProprio: f.lanceProprio,
    vendedorNome: vendedor.nome,
    vendedorCargo: vendedor.cargo,
    vendedorTelefone: vendedor.telefone,
    vendedorEmail: vendedor.email,
    comparativo,
  };

  const nomeArquivo = `proposta-${f.cliente || "consorcio"}-${moeda(f.credito)}`;

  async function comCartao(chave: string, fn: (el: HTMLElement) => Promise<unknown>) {
    const el = cartaoRef.current;
    if (!el) return;
    setExportando(chave);
    try {
      await fn(el);
    } catch (e) {
      toast.error(`Não consegui gerar o arquivo. ${(e as Error).message}`);
    } finally {
      setExportando(null);
    }
  }

  function salvarNoHistorico() {
    salvar.mutate({
      contato_id: f.contatoId || null,
      tabela_id: f.tabelaId || null,
      titulo: f.titulo,
      cliente_nome: f.cliente || null,
      administradora: f.administradora,
      segmento: f.segmento,
      credito: f.credito,
      prazo_meses: f.prazoMeses,
      taxa_adm: f.taxaAdm,
      fundo_reserva: f.fundoReserva,
      seguro_mensal: f.seguroMensal,
      lance_proprio: f.lanceProprio,
      lance_embutido_pct: f.lanceEmbutidoPct,
      mes_contemplacao: f.mesContemplacao,
      reducao: f.reducao,
      parcela: r.parcela,
      total_pago: r.desembolso,
    });
  }

  function carregar(s: Simulacao) {
    setF((p) => ({
      ...p,
      tabelaId: s.tabela_id ?? "",
      administradora: s.administradora,
      segmento: s.segmento,
      credito: Number(s.credito),
      prazoMeses: s.prazo_meses,
      taxaAdm: Number(s.taxa_adm),
      fundoReserva: Number(s.fundo_reserva),
      seguroMensal: Number(s.seguro_mensal),
      lanceProprio: Number(s.lance_proprio),
      lanceEmbutidoPct: Number(s.lance_embutido_pct),
      mesContemplacao: s.mes_contemplacao,
      reducao: s.reducao,
      titulo: s.titulo,
      contatoId: s.contato_id ?? "",
      cliente: s.cliente_nome ?? "",
    }));
    setHistoricoAberto(false);
  }

  if (isLoading) return <Carregando texto="Carregando tabelas..." />;

  const foraDaFaixa =
    tabela &&
    ((tabela.credito_min !== null && f.credito < Number(tabela.credito_min)) ||
      (tabela.credito_max !== null && f.credito > Number(tabela.credito_max)));

  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold text-foreground">Simulador</h1>
            <p className="text-xs text-muted-foreground">
              Monte a simulação e gere a proposta pronta para mandar no WhatsApp.
            </p>
          </div>
          <Botao variante="contorno" tamanho="sm" onClick={() => setHistoricoAberto(true)}>
            <History className="h-3.5 w-3.5" /> Histórico
          </Botao>
          <Botao tamanho="sm" onClick={salvarNoHistorico} carregando={salvar.isPending}>
            <Save className="h-3.5 w-3.5" /> Salvar
          </Botao>
        </div>
      </div>

      <div className="grid flex-1 gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_480px]">
        {/* ------------------------------ formulário ------------------------------ */}
        <div className="flex flex-col gap-4">
          <Bloco titulo="Tabela">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                label="Administradora e plano"
                className="sm:col-span-2"
                hint={
                  tabela
                    ? `${tabela.prazo_meses} meses · adm ${pct(Number(tabela.taxa_adm), 1)} · FR ${pct(Number(tabela.fundo_reserva), 1)} · lance embutido até ${pct(Number(tabela.lance_embutido_max), 0)}`
                    : "Nenhuma tabela cadastrada."
                }
              >
                <Select value={f.tabelaId} onChange={(e) => aplicarTabela(e.target.value)}>
                  {tabelas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.administradora} — {t.nome}
                    </option>
                  ))}
                </Select>
              </Campo>

              <Campo label="Segmento">
                <Select
                  value={f.segmento}
                  onChange={(e) => set("segmento", e.target.value as Segmento)}
                >
                  {SEGMENTOS.map((s) => (
                    <option key={s.valor} value={s.valor}>
                      {s.rotulo}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Administradora no papel">
                <Input
                  value={f.administradora}
                  onChange={(e) => set("administradora", e.target.value)}
                />
              </Campo>
            </div>
          </Bloco>

          <Bloco titulo="Plano">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                label="Crédito"
                erro={foraDaFaixa ? "Fora da faixa desta tabela." : undefined}
                hint={
                  tabela && !foraDaFaixa
                    ? `Faixa: ${moeda(Number(tabela.credito_min))} a ${moeda(Number(tabela.credito_max))}`
                    : undefined
                }
              >
                <Numero valor={f.credito} aoMudar={(v) => set("credito", v)} sufixo="R$" />
              </Campo>
              <Campo label="Prazo">
                <Numero
                  valor={f.prazoMeses}
                  aoMudar={(v) => set("prazoMeses", Math.round(v))}
                  sufixo="meses"
                />
              </Campo>
              <Campo label="Taxa de administração" hint="Total do plano, sobre o crédito.">
                <Numero valor={f.taxaAdm} aoMudar={(v) => set("taxaAdm", v)} sufixo="%" />
              </Campo>
              <Campo label="Fundo de reserva">
                <Numero valor={f.fundoReserva} aoMudar={(v) => set("fundoReserva", v)} sufixo="%" />
              </Campo>
              <Campo label="Seguro" hint="% do crédito ao mês. Zero se a tabela não cobra.">
                <Numero valor={f.seguroMensal} aoMudar={(v) => set("seguroMensal", v)} sufixo="%/mês" />
              </Campo>
            </div>
          </Bloco>

          <Bloco titulo="Lance">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Lance em dinheiro" hint="Sai do bolso do cliente.">
                <Numero valor={f.lanceProprio} aoMudar={(v) => set("lanceProprio", v)} sufixo="R$" />
              </Campo>
              <Campo
                label="Lance embutido"
                hint={
                  tabela
                    ? `Máximo desta tabela: ${pct(Number(tabela.lance_embutido_max), 0)}`
                    : "Sai do próprio crédito."
                }
              >
                <Numero
                  valor={f.lanceEmbutidoPct}
                  aoMudar={(v) => set("lanceEmbutidoPct", v)}
                  sufixo="%"
                />
              </Campo>
              <Campo label="Contemplação na parcela" hint="0 = contemplado já no ato.">
                <Numero
                  valor={f.mesContemplacao}
                  aoMudar={(v) => set("mesContemplacao", Math.round(v))}
                  sufixo="ª"
                />
              </Campo>
              <Campo label="Depois do lance">
                <Select value={f.reducao} onChange={(e) => set("reducao", e.target.value as Reducao)}>
                  <option value="parcela">Reduzir a parcela</option>
                  <option value="prazo">Reduzir o prazo</option>
                </Select>
              </Campo>
            </div>
            {f.lanceEmbutidoPct > 0 && (
              <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                O lance embutido sai do próprio crédito: o cliente recebe{" "}
                <strong className="text-foreground">{moedaExata(r.creditoLiquido)}</strong> em vez de{" "}
                {moedaExata(f.credito)}. Ele antecipa a contemplação, mas não reduz o custo do
                consórcio.
              </p>
            )}
          </Bloco>

          <Bloco titulo="Comparativo com financiamento">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={f.compararFin}
                onChange={(e) => set("compararFin", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Mostrar quanto sairia financiado
            </label>
            {f.compararFin && (
              <div className="mt-3 max-w-[220px]">
                <Campo label="Juros do financiamento">
                  <Numero valor={f.jurosMes} aoMudar={(v) => set("jurosMes", v)} sufixo="% a.m." />
                </Campo>
              </div>
            )}
          </Bloco>

          <Bloco titulo="Proposta">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Marca do material">
                <Select value={f.marca} onChange={(e) => set("marca", e.target.value as Marca)}>
                  {(Object.keys(TEMAS) as Marca[]).map((m) => (
                    <option key={m} value={m}>
                      {TEMAS[m].rotulo}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Título">
                <Input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} />
              </Campo>
              <Campo label="Cliente do CRM" hint="Vincula a simulação ao contato.">
                <Select
                  value={f.contatoId}
                  onChange={(e) => {
                    const c = contatos.find((x) => x.id === e.target.value);
                    setF((p) => ({
                      ...p,
                      contatoId: e.target.value,
                      cliente: c?.nome ?? p.cliente,
                    }));
                  }}
                >
                  <option value="">— avulsa —</option>
                  {contatos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Nome no cabeçalho">
                <Input
                  value={f.cliente}
                  onChange={(e) => set("cliente", e.target.value)}
                  placeholder="Opcional"
                />
              </Campo>
            </div>

            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Assinatura
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Nome">
                <Input
                  value={vendedor.nome}
                  onChange={(e) => setVendedor((v) => ({ ...v, nome: e.target.value }))}
                />
              </Campo>
              <Campo label="Cargo">
                <Input
                  value={vendedor.cargo}
                  onChange={(e) => setVendedor((v) => ({ ...v, cargo: e.target.value }))}
                />
              </Campo>
              <Campo label="Telefone">
                <Input
                  value={vendedor.telefone}
                  onChange={(e) => setVendedor((v) => ({ ...v, telefone: e.target.value }))}
                  placeholder="(34) 99999-0000"
                />
              </Campo>
              <Campo label="E-mail">
                <Input
                  value={vendedor.email}
                  onChange={(e) => setVendedor((v) => ({ ...v, email: e.target.value }))}
                />
              </Campo>
            </div>
          </Bloco>
        </div>

        {/* -------------------------------- preview ------------------------------- */}
        <div className="flex flex-col gap-3 xl:sticky xl:top-5 xl:self-start">
          <Cartao className="grid grid-cols-3 divide-x divide-border">
            {[
              { r: "Parcela", v: moedaExata(r.parcela) },
              {
                r: r.temLance ? "Após o lance" : "Total do plano",
                v: r.temLance
                  ? r.lanceQuita
                    ? "quitado"
                    : moedaExata(r.novaParcela)
                  : moedaExata(r.totalPlano),
              },
              { r: "Custo ao mês", v: pct(r.custoMensalPct, 2) },
            ].map((x) => (
              <div key={x.r} className="px-3 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{x.r}</p>
                <p className="font-num text-sm font-semibold tabular-nums">{x.v}</p>
              </div>
            ))}
          </Cartao>

          <div className="flex flex-wrap gap-2">
            <Botao
              tamanho="sm"
              onClick={() => comCartao("pdf", (el) => baixarPdf(el, nomeArquivo))}
              carregando={exportando === "pdf"}
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Botao>
            <Botao
              variante="contorno"
              tamanho="sm"
              onClick={() => comCartao("png", (el) => baixarPng(el, nomeArquivo))}
              carregando={exportando === "png"}
            >
              <ImageDown className="h-3.5 w-3.5" /> Imagem
            </Botao>
            <Botao
              variante="contorno"
              tamanho="sm"
              onClick={() =>
                comCartao("copia", async (el) => {
                  const ok = await copiarImagem(el);
                  toast[ok ? "success" : "error"](
                    ok ? "Imagem copiada. É só colar no WhatsApp." : "Seu navegador não deixa copiar imagem.",
                  );
                })
              }
              carregando={exportando === "copia"}
            >
              <Copy className="h-3.5 w-3.5" /> Copiar imagem
            </Botao>
            <Botao
              variante="contorno"
              tamanho="sm"
              onClick={async () => {
                const ok = await copiarTexto(propostaEmTexto(dados, r));
                toast[ok ? "success" : "error"](
                  ok ? "Texto copiado." : "Seu navegador não deixa copiar.",
                );
              }}
            >
              <MessageSquareText className="h-3.5 w-3.5" /> Copiar texto
            </Botao>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4">
            <div className="mx-auto w-fit overflow-hidden rounded-lg shadow-pop">
              <CartaoProposta ref={cartaoRef} dados={dados} r={r} />
            </div>
          </div>

          {pode("simulador.tabelas") && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sliders className="h-3 w-3" />
              As taxas vêm das tabelas em Configurações → Tabelas das administradoras.
            </p>
          )}
        </div>
      </div>

      <HistoricoSimulacoes
        aberto={historicoAberto}
        aoFechar={() => setHistoricoAberto(false)}
        aoCarregar={carregar}
      />
    </div>
  );
}

/* -------------------------------- Histórico ------------------------------- */

function HistoricoSimulacoes({
  aberto,
  aoFechar,
  aoCarregar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCarregar: (s: Simulacao) => void;
}) {
  const { data: simulacoes = [], isLoading } = useSimulacoes();
  const excluir = useExcluirSimulacao();

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Simulações salvas" largura="max-w-2xl">
      {isLoading ? (
        <Carregando />
      ) : simulacoes.length === 0 ? (
        <Vazio
          icone={History}
          titulo="Nada salvo ainda"
          descricao="Clique em Salvar para guardar a simulação e reabrir depois."
        />
      ) : (
        <ul className="flex max-h-[60vh] flex-col divide-y divide-border overflow-y-auto">
          {simulacoes.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {s.cliente_nome ?? s.titulo}{" "}
                  <span className="font-num text-muted-foreground">
                    · {moeda(Number(s.credito))} em {s.prazo_meses}x
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {s.administradora} · parcela {moedaExata(Number(s.parcela))} ·{" "}
                  {formatarDataHora(s.criado_em)}
                </p>
              </div>
              <Botao variante="contorno" tamanho="sm" onClick={() => aoCarregar(s)}>
                Abrir
              </Botao>
              <button
                onClick={() => excluir.mutate(s.id)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
