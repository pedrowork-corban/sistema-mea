import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  Download,
  LayoutGrid,
  MessageCircle,
  PhoneOff,
  Plus,
  Rows3,
  Search,
  Upload,
  Users,
} from "lucide-react";
import {
  useContatos,
  useEtapas,
  useImportarContatos,
  useMoverEtapa,
  useOrigens,
  useSalvarContato,
  useUsuarios,
} from "@/hooks/useCrm";
import { useAuth } from "@/contexts/AuthContext";
import FichaContato from "@/components/FichaContato";
import { AtividadeRapida, FaixaAtividade } from "@/components/Atividade";
import { Botao, Campo, Carregando, Cartao, Input, Modal, Select, Selo, Vazio } from "@/components/ui";
import type { Contato, Temperatura } from "@/lib/types";
import { INTERESSES, TEMPERATURAS } from "@/lib/types";
import type { LinhaContato } from "@/lib/planilha";
import { baixarModeloContatos, importarContatos } from "@/lib/planilha";
import { cn, diasAte, diasDesde, linkWhatsapp, moeda } from "@/lib/utils";

/* ------------------------------- Cartão do kanban ------------------------- */

function CartaoContato({
  contato,
  aoAbrir,
  aoAgendar,
  arrastavel,
}: {
  contato: Contato;
  aoAbrir: () => void;
  aoAgendar: () => void;
  arrastavel: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: contato.id,
    disabled: !arrastavel,
  });

  const temp = TEMPERATURAS.find((t) => t.valor === contato.temperatura);
  const semContato = diasDesde(contato.ultimo_contato_em);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={aoAbrir}
      className={cn(
        // pb-7 abre espaço para a faixa de atividade, que fica colada no rodapé
        "relative cursor-pointer rounded-md border border-border bg-card p-2.5 pb-7 text-left shadow-sm transition-shadow hover:shadow-card",
        isDragging && "opacity-30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{contato.nome}</p>
        {temp && <span className={cn("rounded px-1.5 py-px text-[10px] font-medium", temp.classe)}>{temp.rotulo}</span>}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {contato.interesse && <span>{contato.interesse}</span>}
        {contato.valor_estimado ? <span className="font-num">{moeda(contato.valor_estimado)}</span> : null}
        {!contato.telefone && (
          <span className="inline-flex items-center gap-1 text-destructive">
            <PhoneOff className="h-3 w-3" /> sem telefone
          </span>
        )}
        {contato.proxima_acao_em === null && semContato !== null && (
          <span>{semContato}d sem contato</span>
        )}
      </div>

      {contato.tags?.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {contato.tags.map((t) => (
            <span
              key={t}
              title={t}
              className="max-w-full truncate rounded bg-secondary px-1.5 py-px text-[10px] text-secondary-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <FaixaAtividade contato={contato} aoAgendar={aoAgendar} />
    </div>
  );
}

/* --------------------------------- Coluna --------------------------------- */

function Coluna({
  id,
  nome,
  cor,
  contatos,
  aoAbrir,
  aoAgendar,
  arrastavel,
}: {
  id: string;
  nome: string;
  cor: string;
  contatos: Contato[];
  aoAbrir: (c: Contato) => void;
  aoAgendar: (c: Contato) => void;
  arrastavel: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const total = contatos.reduce((s, c) => s + (c.valor_estimado ?? 0), 0);

  return (
    <div className="flex w-[264px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
        <p className="flex-1 truncate text-sm font-medium text-foreground">{nome}</p>
        <span className="rounded bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">
          {contatos.length}
        </span>
      </div>
      {total > 0 && (
        <p className="mb-2 px-1 font-num text-[11px] text-muted-foreground">{moeda(total)}</p>
      )}
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver ? "border-primary bg-primary/5" : "border-border/70 bg-muted/30",
        )}
      >
        {contatos.map((c) => (
          <CartaoContato
            key={c.id}
            contato={c}
            aoAbrir={() => aoAbrir(c)}
            aoAgendar={() => aoAgendar(c)}
            arrastavel={arrastavel}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Novo contato ------------------------------ */

function NovoContato({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { data: etapas = [] } = useEtapas();
  const { data: origens = [] } = useOrigens();
  const salvar = useSalvarContato();

  const [nome, setNome] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [interesse, setInteresse] = React.useState("");
  const [etapaId, setEtapaId] = React.useState("");
  const [origemId, setOrigemId] = React.useState("");
  const [temperatura, setTemperatura] = React.useState<Temperatura>("morno");
  const [valor, setValor] = React.useState("");

  React.useEffect(() => {
    if (aberto) {
      setNome("");
      setTelefone("");
      setInteresse("");
      setOrigemId("");
      setValor("");
      setTemperatura("morno");
      setEtapaId(etapas.find((e) => e.tipo === "aberta")?.id ?? "");
    }
  }, [aberto, etapas]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    salvar.mutate(
      {
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        interesse: interesse || null,
        etapa_id: etapaId || null,
        origem_id: origemId || null,
        temperatura,
        valor_estimado: valor ? Number(valor) : null,
      },
      { onSuccess: aoFechar },
    );
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Novo contato" descricao="O resto você completa na ficha.">
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <Campo label="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Telefone" hint="Com DDD.">
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="34 99999-0000" />
          </Campo>
          <Campo label="Interesse">
            <Select value={interesse} onChange={(e) => setInteresse(e.target.value)}>
              <option value="">—</option>
              {INTERESSES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Etapa">
            <Select value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
              {etapas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Origem">
            <Select value={origemId} onChange={(e) => setOrigemId(e.target.value)}>
              <option value="">—</option>
              {origens.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Temperatura">
            <Select
              value={temperatura}
              onChange={(e) => setTemperatura(e.target.value as Temperatura)}
            >
              {TEMPERATURAS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Valor estimado" hint="Só números.">
            <Input
              type="number"
              min={0}
              step="any"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="font-num"
            />
          </Campo>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Botao type="button" variante="contorno" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            Criar contato
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------- Importação ------------------------------- */

/**
 * Importa contatos de planilha. A tela mostra o que vai entrar antes de gravar —
 * importação é das poucas ações que mexem em centenas de linhas de uma vez, e
 * desfazer no banco depois é bem mais chato do que conferir aqui.
 *
 * Repetido não é erro: a mesma pessoa pode aparecer de novo com dado novo. Por
 * padrão fica de fora, mas dá para trazer marcando a caixa.
 */
function ImportarContatos({ aoFechar }: { aoFechar: () => void }) {
  const importar = useImportarContatos();
  const { data: etapas = [] } = useEtapas();
  const { data: origens = [] } = useOrigens();
  const { data: usuarios = [] } = useUsuarios();
  const { data: contatos = [] } = useContatos();

  const [linhas, setLinhas] = React.useState<LinhaContato[] | null>(null);
  const [arquivo, setArquivo] = React.useState("");
  const [trazerRepetidos, setTrazerRepetidos] = React.useState(false);

  const validas = linhas?.filter((l) => l.contato) ?? [];
  const problemas = linhas?.filter((l) => l.erro) ?? [];
  const repetidas = validas.filter((l) => l.duplicadoDe);
  const aImportar = trazerRepetidos ? validas : validas.filter((l) => !l.duplicadoDe);

  async function ler(f: File) {
    setArquivo(f.name);
    setLinhas(
      importarContatos(await f.text(), {
        etapas,
        origens,
        usuarios,
        existentes: contatos.map((c) => ({ nome: c.nome, telefone: c.telefone })),
      }),
    );
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Importar contatos de planilha" largura="max-w-3xl">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>
            Baixe o modelo, preencha um contato por linha e salve como <strong>CSV</strong> (no
            Excel: Salvar como → CSV UTF-8; no Google Planilhas: Fazer download → .csv). Só o nome é
            obrigatório — o resto entra em branco se faltar.
          </p>
          <Botao
            type="button"
            tamanho="sm"
            variante="contorno"
            className="mt-2"
            onClick={baixarModeloContatos}
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
              <strong className="text-foreground">{arquivo}</strong> — {aImportar.length} contato(s)
              prontos
              {problemas.length > 0 && `, ${problemas.length} linha(s) com problema`}
              {repetidas.length > 0 && `, ${repetidas.length} já na base`}.
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

            {repetidas.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {repetidas.length} linha(s) parecem já existir:{" "}
                    {repetidas
                      .slice(0, 5)
                      .map((l) => l.duplicadoDe)
                      .join(", ")}
                    {repetidas.length > 5 && ` e mais ${repetidas.length - 5}`}.
                  </span>
                </p>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={trazerRepetidos}
                    onChange={(e) => setTrazerRepetidos(e.target.checked)}
                    className="h-3.5 w-3.5 cursor-pointer accent-primary"
                  />
                  Importar os repetidos também (vira um contato novo, não atualiza o antigo)
                </label>
              </div>
            )}

            {aImportar.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 text-left text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-2 py-1.5">Nome</th>
                      <th className="px-2 py-1.5">Telefone</th>
                      <th className="px-2 py-1.5">Interesse</th>
                      <th className="px-2 py-1.5">Valor</th>
                      <th className="px-2 py-1.5">Etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aImportar.map((l) => (
                      <tr key={l.linha} className="border-t border-border/60">
                        <td className="px-2 py-1.5">{l.contato!.nome}</td>
                        <td className="px-2 py-1.5 font-num">{l.contato!.telefone ?? "—"}</td>
                        <td className="px-2 py-1.5">{l.contato!.interesse ?? "—"}</td>
                        <td className="px-2 py-1.5 font-num">
                          {l.contato!.valor_estimado ? moeda(l.contato!.valor_estimado) : "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          {etapas.find((e) => e.id === l.contato!.etapa_id)?.nome ?? "—"}
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
            disabled={aImportar.length === 0}
            carregando={importar.isPending}
            onClick={() =>
              importar.mutate(
                aImportar.map((l) => l.contato!),
                { onSuccess: aoFechar },
              )
            }
          >
            Importar {aImportar.length} contato(s)
          </Botao>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------- Página -------------------------------- */

export default function Crm() {
  const { pode } = useAuth();
  const { data: etapas = [], isLoading: carregandoEtapas } = useEtapas();
  const { data: contatos = [], isLoading } = useContatos();
  const { data: usuarios = [] } = useUsuarios();
  const mover = useMoverEtapa();

  const [visao, setVisao] = React.useState<"kanban" | "lista">("kanban");
  const [busca, setBusca] = React.useState("");
  const [fResponsavel, setFResponsavel] = React.useState("");
  const [fTemperatura, setFTemperatura] = React.useState("");
  const [novoAberto, setNovoAberto] = React.useState(false);
  const [importando, setImportando] = React.useState(false);
  const [abertoId, setAbertoId] = React.useState<string | null>(null);
  const [atividadeId, setAtividadeId] = React.useState<string | null>(null);
  const [arrastando, setArrastando] = React.useState<Contato | null>(null);

  const editar = pode("crm.editar");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtrados = React.useMemo(() => {
    const t = busca.trim().toLowerCase();
    return contatos.filter((c) => {
      if (fResponsavel && c.responsavel_id !== fResponsavel) return false;
      if (fTemperatura && c.temperatura !== fTemperatura) return false;
      if (!t) return true;
      return [c.nome, c.telefone, c.interesse, c.cidade, c.obs]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(t));
    });
  }, [contatos, busca, fResponsavel, fTemperatura]);

  const porEtapa = React.useMemo(() => {
    const m = new Map<string, Contato[]>();
    for (const e of etapas) m.set(e.id, []);
    const semEtapa: Contato[] = [];
    for (const c of filtrados) {
      if (c.etapa_id && m.has(c.etapa_id)) m.get(c.etapa_id)!.push(c);
      else semEtapa.push(c);
    }
    return { m, semEtapa };
  }, [filtrados, etapas]);

  const aberto = contatos.find((c) => c.id === abertoId) ?? null;
  const emAtividade = contatos.find((c) => c.id === atividadeId) ?? null;

  function aoIniciar(e: DragStartEvent) {
    setArrastando(contatos.find((c) => c.id === e.active.id) ?? null);
  }

  function aoSoltar(e: DragEndEvent) {
    setArrastando(null);
    const destino = e.over?.id as string | undefined;
    if (!destino) return;
    const contato = contatos.find((c) => c.id === e.active.id);
    if (!contato || contato.etapa_id === destino) return;
    mover.mutate({ id: contato.id, etapaId: destino });
  }

  if (isLoading || carregandoEtapas) return <Carregando texto="Carregando contatos..." />;

  return (
    <div className="flex h-full min-h-screen flex-col">
      {/* cabeçalho */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold text-foreground">CRM</h1>
            <p className="text-xs text-muted-foreground">
              {filtrados.length} de {contatos.length} contato(s)
            </p>
          </div>

          <div className="flex items-center rounded-md border border-border p-0.5">
            <button
              onClick={() => setVisao("kanban")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                visao === "kanban" ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Funil
            </button>
            <button
              onClick={() => setVisao("lista")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                visao === "lista" ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              <Rows3 className="h-3.5 w-3.5" /> Lista
            </button>
          </div>

          {editar && (
            <>
              <Botao
                variante="contorno"
                tamanho="sm"
                onClick={() => setImportando(true)}
                title="Traz contatos de um arquivo .csv. Dá para baixar o modelo na janela."
              >
                <Upload className="h-3.5 w-3.5" /> Importar planilha
              </Botao>
              <Botao tamanho="sm" onClick={() => setNovoAberto(true)}>
                <Plus className="h-3.5 w-3.5" /> Novo contato
              </Botao>
            </>
          )}
        </div>

        {/* filtros */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, telefone, cidade..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select
            value={fTemperatura}
            onChange={(e) => setFTemperatura(e.target.value)}
            className="h-8 w-auto text-xs"
          >
            <option value="">Toda temperatura</option>
            {TEMPERATURAS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </Select>
          {pode("crm.ver_todos") && (
            <Select
              value={fResponsavel}
              onChange={(e) => setFResponsavel(e.target.value)}
              className="h-8 w-auto text-xs"
            >
              <option value="">Todos os responsáveis</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {/* conteúdo */}
      <div className="min-h-0 flex-1 p-5">
        {contatos.length === 0 ? (
          <Vazio
            icone={Users}
            titulo="Nenhum contato ainda"
            descricao="Importe os contatos da sua planilha de acompanhamento ou cadastre o primeiro na mão."
            acao={
              editar && (
                <div className="flex gap-2">
                  <Botao variante="contorno" onClick={() => setImportando(true)}>
                    <Upload className="h-4 w-4" /> Importar planilha
                  </Botao>
                  <Botao onClick={() => setNovoAberto(true)}>
                    <Plus className="h-4 w-4" /> Novo contato
                  </Botao>
                </div>
              )
            }
          />
        ) : visao === "kanban" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={aoIniciar}
            onDragEnd={aoSoltar}
            onDragCancel={() => setArrastando(null)}
          >
            <div className="flex gap-3 overflow-x-auto pb-4">
              {etapas.map((e) => (
                <Coluna
                  key={e.id}
                  id={e.id}
                  nome={e.nome}
                  cor={e.cor}
                  contatos={porEtapa.m.get(e.id) ?? []}
                  aoAbrir={(c) => setAbertoId(c.id)}
                  aoAgendar={(c) => (editar ? setAtividadeId(c.id) : setAbertoId(c.id))}
                  arrastavel={editar}
                />
              ))}
              {porEtapa.semEtapa.length > 0 && (
                <Coluna
                  id="__sem_etapa"
                  nome="Sem etapa"
                  cor="#7F7979"
                  contatos={porEtapa.semEtapa}
                  aoAbrir={(c) => setAbertoId(c.id)}
                  aoAgendar={(c) => (editar ? setAtividadeId(c.id) : setAbertoId(c.id))}
                  arrastavel={false}
                />
              )}
            </div>
            <DragOverlay>
              {arrastando && (
                <div className="w-[248px] rotate-1 rounded-md border border-border bg-card p-2.5 shadow-pop">
                  <p className="truncate text-sm font-medium">{arrastando.nome}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          <Lista contatos={filtrados} etapas={etapas} aoAbrir={(c) => setAbertoId(c.id)} />
        )}
      </div>

      {aberto && <FichaContato contato={aberto} aoFechar={() => setAbertoId(null)} />}
      <AtividadeRapida contato={emAtividade} aoFechar={() => setAtividadeId(null)} />
      <NovoContato aberto={novoAberto} aoFechar={() => setNovoAberto(false)} />
      {importando && <ImportarContatos aoFechar={() => setImportando(false)} />}
    </div>
  );
}

/* --------------------------------- Lista ---------------------------------- */

function Lista({
  contatos,
  etapas,
  aoAbrir,
}: {
  contatos: Contato[];
  etapas: { id: string; nome: string; cor: string }[];
  aoAbrir: (c: Contato) => void;
}) {
  if (contatos.length === 0)
    return <Vazio icone={Search} titulo="Nada encontrado" descricao="Tente outro termo ou limpe os filtros." />;

  return (
    <Cartao className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Nome</th>
            <th className="px-4 py-2.5 font-medium">Etapa</th>
            <th className="px-4 py-2.5 font-medium">Interesse</th>
            <th className="px-4 py-2.5 text-right font-medium">Valor</th>
            <th className="px-4 py-2.5 font-medium">Últ. contato</th>
            <th className="px-4 py-2.5 font-medium">Próx. ação</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {contatos.map((c) => {
            const etapa = etapas.find((e) => e.id === c.etapa_id);
            const dias = diasDesde(c.ultimo_contato_em);
            const atraso = diasAte(c.proxima_acao_em);
            const wa = linkWhatsapp(c.telefone);
            return (
              <tr
                key={c.id}
                onClick={() => aoAbrir(c)}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50"
              >
                <td className="px-4 py-2.5">
                  <p className="font-medium text-foreground">{c.nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.telefone ?? <span className="text-destructive">sem telefone</span>}
                  </p>
                </td>
                <td className="px-4 py-2.5">
                  {etapa && <Selo cor={etapa.cor}>{etapa.nome}</Selo>}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.interesse ?? "—"}</td>
                <td className="px-4 py-2.5 text-right font-num">{moeda(c.valor_estimado)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {dias === null ? "nunca" : dias === 0 ? "hoje" : `há ${dias}d`}
                </td>
                <td className="px-4 py-2.5">
                  {atraso === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={cn(
                        "rounded px-1.5 py-px text-[11px] font-medium",
                        atraso < 0
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                          : atraso === 0
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {atraso < 0 ? `${-atraso}d atrasado` : atraso === 0 ? "hoje" : `em ${atraso}d`}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Abrir no WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Cartao>
  );
}
