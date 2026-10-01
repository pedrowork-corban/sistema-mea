import * as React from "react";
import {
  CheckCircle2,
  Circle,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useContatos, useUsuarios } from "@/hooks/useCrm";
import {
  useCotas,
  useEditarCotasEmMassa,
  useExcluirCota,
  useImportarCotas,
  useSalvarCota,
} from "@/hooks/useSimulador";
import type { Cota, FormaContemplacao, Segmento, StatusCota } from "@/lib/types";
import { comissaoFechada, parcelasComissao, SEGMENTOS, STATUS_COTA } from "@/lib/types";
import { baixarModeloCarteira, importarCarteira, type LinhaImportada } from "@/lib/planilha";
import {
  Botao,
  Campo,
  Cartao,
  Carregando,
  Input,
  Modal,
  Select,
  Textarea,
  Vazio,
} from "@/components/ui";
import { cn, formatarData, hoje, moeda, moedaExata } from "@/lib/utils";

/* --------------------------------- Editor --------------------------------- */

const VAZIA: Partial<Cota> = {
  cliente_nome: "",
  administradora: "Banco do Brasil",
  grupo: "",
  cota: "",
  segmento: "auto",
  credito: 0,
  prazo_meses: 80,
  parcela: null,
  parcelas_pagas: 0,
  parcelas_comissao: null,
  status: "ativa",
  obs: "",
};

function EditorCota({
  cota,
  aoFechar,
}: {
  cota: Partial<Cota> | null;
  aoFechar: () => void;
}) {
  const { pode } = useAuth();
  const { data: contatos = [] } = useContatos();
  const { data: usuarios = [] } = useUsuarios();
  const salvar = useSalvarCota();

  const [c, setC] = React.useState<Partial<Cota>>(VAZIA);

  React.useEffect(() => {
    if (cota) setC({ data_venda: hoje(), ...cota });
  }, [cota]);

  if (!cota) return null;
  const set = <K extends keyof Cota>(k: K, v: Cota[K]) => setC((p) => ({ ...p, [k]: v }));
  const contemplada = c.status === "contemplada";
  const padraoSegmento = SEGMENTOS.find((s) => s.valor === (c.segmento ?? "auto"))?.comissao ?? 7;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    salvar.mutate(
      {
        ...c,
        cliente_nome: (c.cliente_nome ?? "").trim(),
        grupo: c.grupo?.trim() || null,
        cota: c.cota?.trim() || null,
        obs: c.obs?.trim() || null,
        contemplada_em: contemplada ? (c.contemplada_em ?? hoje()) : null,
        forma: contemplada ? (c.forma ?? "sorteio") : null,
      },
      { onSuccess: aoFechar },
    );
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={c.id ? "Editar cota" : "Lançar cota na carteira"}
      largura="max-w-2xl"
    >
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Cliente">
            <Input
              value={c.cliente_nome ?? ""}
              onChange={(e) => set("cliente_nome", e.target.value)}
              required
              autoFocus
            />
          </Campo>
          <Campo label="Contato do CRM" hint="Liga a cota à ficha do cliente.">
            <Select
              value={c.contato_id ?? ""}
              onChange={(e) => {
                const ct = contatos.find((x) => x.id === e.target.value);
                setC((p) => ({
                  ...p,
                  contato_id: e.target.value || null,
                  cliente_nome: ct?.nome ?? p.cliente_nome,
                }));
              }}
            >
              <option value="">— sem vínculo —</option>
              {contatos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Administradora">
            <Input
              value={c.administradora ?? ""}
              onChange={(e) => set("administradora", e.target.value)}
              required
            />
          </Campo>
          <Campo label="Segmento">
            <Select
              value={c.segmento ?? "auto"}
              onChange={(e) => set("segmento", e.target.value as Segmento)}
            >
              {SEGMENTOS.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Grupo">
            <Input value={c.grupo ?? ""} onChange={(e) => set("grupo", e.target.value)} />
          </Campo>
          <Campo label="Cota">
            <Input value={c.cota ?? ""} onChange={(e) => set("cota", e.target.value)} />
          </Campo>

          <Campo label="Crédito">
            <Input
              type="number"
              min={1}
              step="any"
              value={c.credito ?? 0}
              onChange={(e) => set("credito", Number(e.target.value))}
              className="font-num"
              required
            />
          </Campo>
          <Campo label="Parcela" hint="Opcional — deixe em branco se ainda não souber.">
            <Input
              type="number"
              min={0}
              step="any"
              value={c.parcela ?? ""}
              onChange={(e) => set("parcela", e.target.value ? Number(e.target.value) : null)}
              className="font-num"
            />
          </Campo>

          <Campo label="Prazo (meses)">
            <Input
              type="number"
              min={1}
              max={300}
              value={c.prazo_meses ?? 0}
              onChange={(e) => set("prazo_meses", Number(e.target.value))}
              className="font-num"
              required
            />
          </Campo>
          <Campo label="Parcelas pagas">
            <Input
              type="number"
              min={0}
              value={c.parcelas_pagas ?? 0}
              onChange={(e) => set("parcelas_pagas", Number(e.target.value))}
              className="font-num"
            />
          </Campo>

          <Campo
            label="Parcelas para fechar a comissão"
            className="sm:col-span-2"
            hint={`Quando as parcelas pagas chegarem aqui, a cota aparece com o visto de comissão paga. Em branco usa o padrão do segmento: ${padraoSegmento} parcela(s).`}
          >
            <Input
              type="number"
              min={1}
              max={300}
              placeholder={String(padraoSegmento)}
              value={c.parcelas_comissao ?? ""}
              onChange={(e) =>
                set("parcelas_comissao", e.target.value ? Number(e.target.value) : null)
              }
              className="font-num"
            />
          </Campo>

          <Campo label="Data da venda">
            <Input
              type="date"
              value={c.data_venda ?? hoje()}
              onChange={(e) => set("data_venda", e.target.value)}
            />
          </Campo>
          <Campo label="Situação">
            <Select
              value={c.status ?? "ativa"}
              onChange={(e) => set("status", e.target.value as StatusCota)}
            >
              {STATUS_COTA.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </Select>
          </Campo>

          {contemplada && (
            <>
              <Campo label="Contemplada em">
                <Input
                  type="date"
                  value={c.contemplada_em ?? hoje()}
                  onChange={(e) => set("contemplada_em", e.target.value)}
                />
              </Campo>
              <Campo label="Como">
                <Select
                  value={c.forma ?? "sorteio"}
                  onChange={(e) => set("forma", e.target.value as FormaContemplacao)}
                >
                  <option value="sorteio">Sorteio</option>
                  <option value="lance">Lance</option>
                </Select>
              </Campo>
            </>
          )}

          {pode("carteira.ver_todas") && (
            <Campo label="Vendedor" className="sm:col-span-2">
              <Select
                value={c.vendedor_id ?? ""}
                onChange={(e) => set("vendedor_id", e.target.value || null)}
              >
                <option value="">— eu —</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </Select>
            </Campo>
          )}
        </div>

        <Campo label="Observações">
          <Textarea value={c.obs ?? ""} onChange={(e) => set("obs", e.target.value)} />
        </Campo>

        <div className="mt-1 flex justify-end gap-2">
          <Botao type="button" variante="contorno" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            {c.id ? "Salvar" : "Lançar cota"}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------- Importação ------------------------------- */

function ImportarPlanilha({ aoFechar }: { aoFechar: () => void }) {
  const importar = useImportarCotas();
  const [linhas, setLinhas] = React.useState<LinhaImportada[] | null>(null);
  const [arquivo, setArquivo] = React.useState("");

  const validas = linhas?.filter((l) => l.cota) ?? [];
  const problemas = linhas?.filter((l) => l.erro) ?? [];

  async function ler(f: File) {
    setArquivo(f.name);
    setLinhas(importarCarteira(await f.text()));
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Importar carteira de planilha" largura="max-w-3xl">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>
            Baixe o modelo, preencha uma cota por linha e salve como <strong>CSV</strong> (no Excel:
            Salvar como → CSV UTF-8; no Google Planilhas: Fazer download → .csv). Depois é só
            anexar aqui.
          </p>
          <Botao
            type="button"
            tamanho="sm"
            variante="contorno"
            className="mt-2"
            onClick={baixarModeloCarteira}
          >
            <Download className="h-3.5 w-3.5" /> Baixar modelo
          </Botao>
        </div>

        <Campo label="Planilha" hint="Arquivo .csv com o cabeçalho do modelo.">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void ler(f);
            }}
            className="h-auto py-1.5 text-xs file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
          />
        </Campo>

        {linhas && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{arquivo}</strong> — {validas.length} cota(s)
              prontas
              {problemas.length > 0 && `, ${problemas.length} linha(s) com problema`}.
            </p>

            {problemas.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <ul className="flex flex-col gap-1 text-xs text-destructive">
                  {problemas.map((p) => (
                    <li key={p.linha}>
                      Linha {p.linha}: {p.erro}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validas.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 text-left text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-2 py-1.5">Cliente</th>
                      <th className="px-2 py-1.5">Administradora</th>
                      <th className="px-2 py-1.5">Crédito</th>
                      <th className="px-2 py-1.5">Parcela</th>
                      <th className="px-2 py-1.5">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validas.map((l) => (
                      <tr key={l.linha} className="border-t border-border/60">
                        <td className="px-2 py-1.5">{l.cota!.cliente_nome}</td>
                        <td className="px-2 py-1.5">{l.cota!.administradora}</td>
                        <td className="px-2 py-1.5 font-num">{moeda(l.cota!.credito!)}</td>
                        <td className="px-2 py-1.5 font-num">
                          {l.cota!.parcela ? moedaExata(l.cota!.parcela) : "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          {STATUS_COTA.find((s) => s.valor === l.cota!.status)?.rotulo}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            disabled={validas.length === 0}
            carregando={importar.isPending}
            onClick={() =>
              importar.mutate(
                validas.map((l) => l.cota!),
                { onSuccess: aoFechar },
              )
            }
          >
            Importar {validas.length} cota(s)
          </Botao>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Edição em massa --------------------------- */

/**
 * Edita várias cotas de uma vez. Só vai para o banco o campo que foi marcado —
 * a alternativa (mandar o formulário inteiro) apagaria o vendedor de todo mundo
 * só porque alguém queria mudar a situação.
 */
function EdicaoEmMassa({
  ids,
  aoFechar,
}: {
  ids: string[];
  aoFechar: (limparSelecao: boolean) => void;
}) {
  const { pode } = useAuth();
  const { data: usuarios = [] } = useUsuarios();
  const emMassa = useEditarCotasEmMassa();

  const [mudarStatus, setMudarStatus] = React.useState(true);
  const [status, setStatus] = React.useState<StatusCota>("ativa");
  const [contempladaEm, setContempladaEm] = React.useState(hoje());
  const [forma, setForma] = React.useState<FormaContemplacao>("sorteio");

  const [mudarVendedor, setMudarVendedor] = React.useState(false);
  const [vendedor, setVendedor] = React.useState("");

  const [mudarAdm, setMudarAdm] = React.useState(false);
  const [adm, setAdm] = React.useState("");

  const [mudarComissao, setMudarComissao] = React.useState(false);
  const [comissao, setComissao] = React.useState("");

  const contemplada = status === "contemplada";
  const nada = !mudarStatus && !mudarVendedor && !mudarAdm && !mudarComissao;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const patch: Partial<Cota> = {};
    if (mudarStatus) {
      patch.status = status;
      // Espelha o editor de uma cota: contemplada exige data e forma, e sair de
      // contemplada tem que limpar as duas, senão fica lixo na linha.
      patch.contemplada_em = contemplada ? contempladaEm : null;
      patch.forma = contemplada ? forma : null;
    }
    if (mudarVendedor) patch.vendedor_id = vendedor || null;
    if (mudarAdm) patch.administradora = adm.trim();
    if (mudarComissao) patch.parcelas_comissao = comissao ? Number(comissao) : null;

    emMassa.mutate({ ids, patch }, { onSuccess: () => aoFechar(true) });
  }

  return (
    <Modal
      aberto
      aoFechar={() => aoFechar(false)}
      titulo={`Editar ${ids.length} cota(s)`}
      largura="max-w-lg"
    >
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Marque o que quer mudar. Os campos desmarcados ficam como estão em cada cota.
        </p>

        <LinhaMassa marcado={mudarStatus} aoMarcar={setMudarStatus} rotulo="Situação">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusCota)}>
            {STATUS_COTA.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </Select>
          {contemplada && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={contempladaEm}
                onChange={(e) => setContempladaEm(e.target.value)}
                aria-label="Contemplada em"
              />
              <Select
                value={forma}
                onChange={(e) => setForma(e.target.value as FormaContemplacao)}
                aria-label="Como"
              >
                <option value="sorteio">Sorteio</option>
                <option value="lance">Lance</option>
              </Select>
            </div>
          )}
        </LinhaMassa>

        <LinhaMassa marcado={mudarAdm} aoMarcar={setMudarAdm} rotulo="Administradora">
          <Input
            value={adm}
            onChange={(e) => setAdm(e.target.value)}
            placeholder="Banco do Brasil"
            required={mudarAdm}
          />
        </LinhaMassa>

        <LinhaMassa
          marcado={mudarComissao}
          aoMarcar={setMudarComissao}
          rotulo="Parcelas para fechar a comissão"
        >
          <Input
            type="number"
            min={1}
            max={300}
            value={comissao}
            onChange={(e) => setComissao(e.target.value)}
            placeholder="Em branco volta ao padrão do segmento"
            className="font-num"
          />
        </LinhaMassa>

        {pode("carteira.ver_todas") && (
          <LinhaMassa marcado={mudarVendedor} aoMarcar={setMudarVendedor} rotulo="Vendedor">
            <Select value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
              <option value="">— sem vendedor —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Select>
          </LinhaMassa>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Botao type="button" variante="contorno" onClick={() => aoFechar(false)}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={nada} carregando={emMassa.isPending}>
            Aplicar a {ids.length} cota(s)
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

/** Campo da edição em massa: só entra no update se a caixa estiver marcada. */
function LinhaMassa({
  marcado,
  aoMarcar,
  rotulo,
  children,
}: {
  marcado: boolean;
  aoMarcar: (v: boolean) => void;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        marcado ? "border-primary/40 bg-primary/[0.04]" : "border-border",
      )}
    >
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => aoMarcar(e.target.checked)}
          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary"
        />
        <span className="text-xs font-medium text-foreground">{rotulo}</span>
      </label>
      <div className={cn("mt-2", !marcado && "pointer-events-none opacity-40")}>{children}</div>
    </div>
  );
}

/* --------------------------------- Página --------------------------------- */

export default function Carteira() {
  const { pode } = useAuth();
  const { data: cotas = [], isLoading } = useCotas();
  const { data: usuarios = [] } = useUsuarios();
  const excluir = useExcluirCota();

  const [busca, setBusca] = React.useState("");
  const [fStatus, setFStatus] = React.useState("");
  const [editando, setEditando] = React.useState<Partial<Cota> | null>(null);
  const [importando, setImportando] = React.useState(false);
  const [selecao, setSelecao] = React.useState<Set<string>>(new Set());
  const [massa, setMassa] = React.useState(false);

  const editar = pode("carteira.editar");

  const filtradas = React.useMemo(() => {
    const t = busca.trim().toLowerCase();
    return cotas.filter((c) => {
      if (fStatus && c.status !== fStatus) return false;
      if (!t) return true;
      return [c.cliente_nome, c.administradora, c.grupo, c.cota]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(t));
    });
  }, [cotas, busca, fStatus]);

  const resumo = React.useMemo(() => {
    const vivas = cotas.filter((c) => c.status !== "cancelada");
    const canceladas = cotas.length - vivas.length;
    return {
      cotas: vivas.length,
      credito: vivas.reduce((s, c) => s + Number(c.credito), 0),
      contempladas: cotas.filter((c) => c.status === "contemplada").length,
      canceladas,
      // Quem não cancelou está adimplente. Contemplada e quitada contam a favor:
      // chegaram lá pagando.
      adimplencia: cotas.length ? (vivas.length / cotas.length) * 100 : 0,
    };
  }, [cotas]);

  /* Seleção. Só sobrevive o que ainda está na tela: mudar o filtro com cotas
     marcadas fora dele faria a edição em massa pegar linha invisível. */
  const idsVisiveis = React.useMemo(() => filtradas.map((c) => c.id), [filtradas]);
  const marcadas = React.useMemo(
    () => idsVisiveis.filter((id) => selecao.has(id)),
    [idsVisiveis, selecao],
  );
  const todasMarcadas = idsVisiveis.length > 0 && marcadas.length === idsVisiveis.length;

  const alternar = (id: string) =>
    setSelecao((p) => {
      const n = new Set(p);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  if (isLoading) return <Carregando texto="Carregando carteira..." />;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold text-foreground">Carteira</h1>
            <p className="text-xs text-muted-foreground">
              {filtradas.length} de {cotas.length} cota(s)
            </p>
          </div>
          {editar && (
            <>
              <Botao tamanho="sm" variante="contorno" onClick={() => setImportando(true)}>
                <Upload className="h-3.5 w-3.5" /> Importar planilha
              </Botao>
              <Botao tamanho="sm" onClick={() => setEditando(VAZIA)}>
                <Plus className="h-3.5 w-3.5" /> Lançar cota
              </Botao>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente, administradora, grupo ou cota..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            className="h-8 w-auto text-xs"
          >
            <option value="">Todas as situações</option>
            {STATUS_COTA.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex-1 p-5">
        {cotas.length === 0 ? (
          <Vazio
            icone={Wallet}
            titulo="Carteira vazia"
            descricao="Lance aqui cada cota vendida. A carteira mostra o crédito total sob gestão e quem já foi contemplado."
            acao={
              editar && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Botao onClick={() => setEditando(VAZIA)}>
                    <Plus className="h-4 w-4" /> Lançar a primeira cota
                  </Botao>
                  <Botao variante="contorno" onClick={() => setImportando(true)}>
                    <Upload className="h-4 w-4" /> Importar planilha
                  </Botao>
                </div>
              )
            }
          />
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([
                { r: "Cotas na carteira", v: String(resumo.cotas) },
                { r: "Crédito sob gestão", v: moeda(resumo.credito) },
                { r: "Contempladas", v: String(resumo.contempladas) },
                {
                  r: "Taxa de adimplência",
                  v: `${resumo.adimplencia.toFixed(1).replace(".", ",")}%`,
                  nota: `${resumo.cotas} na carteira · ${resumo.canceladas} cancelada(s)`,
                },
              ] as { r: string; v: string; nota?: string }[]).map((x) => (
                <Cartao key={x.r} className="px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{x.r}</p>
                  <p className="mt-0.5 font-num text-lg font-semibold tabular-nums">{x.v}</p>
                  {x.nota && <p className="text-[11px] text-muted-foreground">{x.nota}</p>}
                </Cartao>
              ))}
            </div>

            {editar && marcadas.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/[0.06] px-4 py-2.5">
                <p className="min-w-0 flex-1 text-xs font-medium text-foreground">
                  {marcadas.length} cota(s) selecionada(s)
                </p>
                <Botao tamanho="sm" variante="contorno" onClick={() => setSelecao(new Set())}>
                  Limpar seleção
                </Botao>
                <Botao tamanho="sm" onClick={() => setMassa(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar em massa
                </Botao>
              </div>
            )}

            {filtradas.length === 0 ? (
              <Vazio icone={Search} titulo="Nada encontrado" descricao="Tente outro termo." />
            ) : (
              <Cartao className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      {editar && (
                        <th className="w-9 pl-4 pr-1">
                          <input
                            type="checkbox"
                            checked={todasMarcadas}
                            onChange={() =>
                              setSelecao(todasMarcadas ? new Set() : new Set(idsVisiveis))
                            }
                            title={
                              todasMarcadas
                                ? "Desmarcar todas"
                                : `Marcar as ${idsVisiveis.length} cota(s) da lista`
                            }
                            aria-label="Marcar todas as cotas da lista"
                            className="h-3.5 w-3.5 cursor-pointer accent-primary"
                          />
                        </th>
                      )}
                      <th className="px-4 py-2.5 font-medium">Cliente</th>
                      <th className="px-4 py-2.5 font-medium">Administradora</th>
                      <th className="px-4 py-2.5 font-medium">Grupo/cota</th>
                      <th className="px-4 py-2.5 text-right font-medium">Crédito</th>
                      <th className="px-4 py-2.5 text-right font-medium">Parcela</th>
                      <th className="px-4 py-2.5 font-medium">Andamento</th>
                      <th className="px-4 py-2.5 font-medium">Situação</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((c) => {
                      const st = STATUS_COTA.find((s) => s.valor === c.status);
                      const vendedor = usuarios.find((u) => u.id === c.vendedor_id);
                      const progresso = Math.min(
                        100,
                        Math.round((c.parcelas_pagas / Math.max(1, c.prazo_meses)) * 100),
                      );
                      const limite = parcelasComissao(c);
                      const paga = comissaoFechada(c);
                      const marcada = selecao.has(c.id);
                      return (
                        <tr
                          key={c.id}
                          className={cn(
                            "border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50",
                            marcada && "bg-primary/[0.06] hover:bg-primary/10",
                          )}
                        >
                          {editar && (
                            <td className="pl-4 pr-1">
                              <input
                                type="checkbox"
                                checked={marcada}
                                onChange={() => alternar(c.id)}
                                aria-label={`Selecionar a cota de ${c.cliente_nome}`}
                                className="h-3.5 w-3.5 cursor-pointer accent-primary"
                              />
                            </td>
                          )}
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-foreground">{c.cliente_nome}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatarData(c.data_venda)}
                              {vendedor && ` · ${vendedor.nome}`}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {c.administradora}
                            <span className="block text-[11px]">
                              {SEGMENTOS.find((s) => s.valor === c.segmento)?.rotulo}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-num text-muted-foreground">
                            {c.grupo ?? "—"}
                            {c.cota ? `/${c.cota}` : ""}
                          </td>
                          <td className="px-4 py-2.5 text-right font-num">
                            {moeda(Number(c.credito))}
                          </td>
                          <td className="px-4 py-2.5 text-right font-num">
                            {c.parcela ? moedaExata(Number(c.parcela)) : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${progresso}%` }}
                                />
                              </div>
                              <span className="font-num text-[11px] text-muted-foreground">
                                {c.parcelas_pagas}/{c.prazo_meses}
                              </span>
                            </div>
                            {/* Marco da comissão: o visto só aparece quando fecha,
                                e até lá mostra quanto falta. Em cota cancelada o
                                que falta não chega mais, então some a contagem —
                                mas se já tinha fechado, o visto fica. */}
                            {(paga || c.status !== "cancelada") && (
                            <span
                              className={cn(
                                "mt-1 inline-flex items-center gap-1 text-[10px]",
                                paga ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                              )}
                              title={
                                paga
                                  ? `Comissão fechada: ${limite} parcela(s) pagas.`
                                  : `Comissão fecha com ${limite} parcela(s) pagas.`
                              }
                            >
                              {paga ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 shrink-0" /> Comissão paga
                                </>
                              ) : (
                                <>
                                  <Circle className="h-3 w-3 shrink-0" /> Faltam{" "}
                                  {limite - c.parcelas_pagas} p/ comissão
                                </>
                              )}
                            </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                "rounded px-1.5 py-px text-[11px] font-medium",
                                st?.classe,
                              )}
                            >
                              {st?.rotulo}
                            </span>
                            {c.contemplada_em && (
                              <span className="block text-[10px] text-muted-foreground">
                                {c.forma === "lance" ? "lance" : "sorteio"} ·{" "}
                                {formatarData(c.contemplada_em)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {editar && (
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => setEditando(c)}
                                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Excluir a cota de ${c.cliente_nome}?`))
                                      excluir.mutate(c.id);
                                  }}
                                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Cartao>
            )}
          </>
        )}
      </div>

      <EditorCota cota={editando} aoFechar={() => setEditando(null)} />
      {importando && <ImportarPlanilha aoFechar={() => setImportando(false)} />}
      {massa && marcadas.length > 0 && (
        <EdicaoEmMassa
          ids={marcadas}
          aoFechar={(limpar) => {
            setMassa(false);
            if (limpar) setSelecao(new Set());
          }}
        />
      )}
    </div>
  );
}
