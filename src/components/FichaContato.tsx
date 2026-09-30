import * as React from "react";
import { MessageCircle, Phone, Plus, Trash2, X } from "lucide-react";
import {
  useEtapas,
  useExcluirContato,
  useInteracoes,
  useOrigens,
  useRegistrarInteracao,
  useSalvarContato,
  useUsuarios,
} from "@/hooks/useCrm";
import { useAuth } from "@/contexts/AuthContext";
import type { Contato, Temperatura, TipoInteracao } from "@/lib/types";
import { INTERESSES, TEMPERATURAS, TIPOS_INTERACAO } from "@/lib/types";
import { Botao, Campo, Input, Select, Selo, Textarea } from "@/components/ui";
import { cn, formatarDataHora, hoje, linkWhatsapp, moeda } from "@/lib/utils";

export default function FichaContato({
  contato,
  aoFechar,
}: {
  contato: Contato;
  aoFechar: () => void;
}) {
  const { pode, usuario } = useAuth();
  const { data: etapas = [] } = useEtapas();
  const { data: origens = [] } = useOrigens();
  const { data: usuarios = [] } = useUsuarios();
  const { data: interacoes = [] } = useInteracoes(contato.id);
  const salvar = useSalvarContato();
  const excluir = useExcluirContato();
  const registrar = useRegistrarInteracao();

  const [aba, setAba] = React.useState<"dados" | "historico">("dados");
  const [form, setForm] = React.useState<Contato>(contato);
  React.useEffect(() => setForm(contato), [contato]);

  // form de nova interação
  const [tipo, setTipo] = React.useState<TipoInteracao>("whatsapp");
  const [resumo, setResumo] = React.useState("");
  const [proxAcao, setProxAcao] = React.useState("");
  const [proxData, setProxData] = React.useState("");

  const editavel = pode("crm.editar");
  const wa = linkWhatsapp(form.telefone);
  const set = <K extends keyof Contato>(k: K, v: Contato[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function salvarDados() {
    salvar.mutate({
      id: form.id,
      nome: form.nome,
      telefone: form.telefone || null,
      email: form.email || null,
      cidade: form.cidade || null,
      origem_id: form.origem_id || null,
      indicado_por: form.indicado_por || null,
      interesse: form.interesse || null,
      valor_estimado: form.valor_estimado ?? null,
      etapa_id: form.etapa_id || null,
      temperatura: form.temperatura,
      responsavel_id: form.responsavel_id || null,
      ultimo_contato_em: form.ultimo_contato_em || null,
      proxima_acao_em: form.proxima_acao_em || null,
      proxima_acao: form.proxima_acao || null,
      obs: form.obs || null,
    });
  }

  function enviarInteracao(e: React.FormEvent) {
    e.preventDefault();
    if (!resumo.trim()) return;
    registrar.mutate(
      {
        contato_id: contato.id,
        tipo,
        resumo: resumo.trim(),
        // Só mexe na próxima ação se o usuário preencheu algo aqui.
        // Deixar em branco mantém o que já estava agendado.
        proxima_acao: proxAcao.trim() || undefined,
        proxima_acao_em: proxData || undefined,
      },
      {
        onSuccess: () => {
          setResumo("");
          setProxAcao("");
          setProxData("");
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={aoFechar} />

      <aside className="relative flex h-full w-full max-w-lg animate-fade-in flex-col border-l border-border bg-card shadow-pop">
        {/* topo */}
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-semibold">{form.nome}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {form.interesse && <Selo>{form.interesse}</Selo>}
              <Selo className={TEMPERATURAS.find((t) => t.valor === form.temperatura)?.classe}>
                {TEMPERATURAS.find((t) => t.valor === form.temperatura)?.rotulo}
              </Selo>
              {form.valor_estimado ? <Selo>{moeda(form.valor_estimado)}</Selo> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                title="Abrir no WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
            {form.telefone && (
              <a
                href={`tel:${form.telefone.replace(/\D/g, "")}`}
                title="Ligar"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={aoFechar}
              className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* abas */}
        <div className="flex gap-1 border-b border-border px-5">
          {(["dados", "historico"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={cn(
                "-mb-px border-b-2 px-2 py-2.5 text-xs font-medium transition-colors",
                aba === a
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {a === "dados" ? "Dados" : `Histórico (${interacoes.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {aba === "dados" ? (
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nome" className="col-span-2">
                <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} disabled={!editavel} />
              </Campo>
              <Campo label="Telefone">
                <Input
                  value={form.telefone ?? ""}
                  onChange={(e) => set("telefone", e.target.value)}
                  placeholder="31 99999-9999"
                  disabled={!editavel}
                />
              </Campo>
              <Campo label="Cidade">
                <Input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} disabled={!editavel} />
              </Campo>
              <Campo label="Etapa">
                <Select
                  value={form.etapa_id ?? ""}
                  onChange={(e) => set("etapa_id", e.target.value || null)}
                  disabled={!editavel}
                >
                  <option value="">—</option>
                  {etapas.map((et) => (
                    <option key={et.id} value={et.id}>{et.nome}</option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Temperatura">
                <Select
                  value={form.temperatura}
                  onChange={(e) => set("temperatura", e.target.value as Temperatura)}
                  disabled={!editavel}
                >
                  {TEMPERATURAS.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.rotulo}</option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Interesse">
                <Select
                  value={form.interesse ?? ""}
                  onChange={(e) => set("interesse", e.target.value || null)}
                  disabled={!editavel}
                >
                  <option value="">A descobrir</option>
                  {INTERESSES.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Valor estimado (R$)">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.valor_estimado ?? ""}
                  onChange={(e) =>
                    set("valor_estimado", e.target.value ? Number(e.target.value) : null)
                  }
                  disabled={!editavel}
                />
              </Campo>
              <Campo label="Origem">
                <Select
                  value={form.origem_id ?? ""}
                  onChange={(e) => set("origem_id", e.target.value || null)}
                  disabled={!editavel}
                >
                  <option value="">—</option>
                  {origens.map((o) => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Quem indicou" hint="Nome de quem trouxe o contato.">
                <Input
                  value={form.indicado_por ?? ""}
                  onChange={(e) => set("indicado_por", e.target.value)}
                  disabled={!editavel}
                />
              </Campo>
              <Campo label="Responsável">
                <Select
                  value={form.responsavel_id ?? ""}
                  onChange={(e) => set("responsavel_id", e.target.value || null)}
                  disabled={!editavel}
                >
                  <option value="">Sem responsável</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}{u.id === usuario?.id ? " (você)" : ""}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Último contato">
                <Input
                  type="date"
                  value={form.ultimo_contato_em ?? ""}
                  onChange={(e) => set("ultimo_contato_em", e.target.value || null)}
                  disabled={!editavel}
                />
              </Campo>
              <Campo label="Próxima ação em">
                <Input
                  type="date"
                  value={form.proxima_acao_em ?? ""}
                  onChange={(e) => set("proxima_acao_em", e.target.value || null)}
                  disabled={!editavel}
                />
              </Campo>
              <Campo label="O que fazer" className="col-span-2">
                <Input
                  value={form.proxima_acao ?? ""}
                  onChange={(e) => set("proxima_acao", e.target.value)}
                  placeholder="Ex.: enviar simulação de imóvel"
                  disabled={!editavel}
                />
              </Campo>
              <Campo label="Observações" className="col-span-2">
                <Textarea
                  value={form.obs ?? ""}
                  onChange={(e) => set("obs", e.target.value)}
                  disabled={!editavel}
                />
              </Campo>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {editavel && (
                <form
                  onSubmit={enviarInteracao}
                  className="rounded-lg border border-border bg-surface-2 p-3"
                >
                  <div className="grid grid-cols-2 gap-2.5">
                    <Campo label="Tipo">
                      <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoInteracao)}>
                        {TIPOS_INTERACAO.map((t) => (
                          <option key={t.valor} value={t.valor}>{t.rotulo}</option>
                        ))}
                      </Select>
                    </Campo>
                    <Campo label="Próximo contato em">
                      <Input
                        type="date"
                        value={proxData}
                        min={hoje()}
                        onChange={(e) => setProxData(e.target.value)}
                      />
                    </Campo>
                    <Campo label="O que aconteceu" className="col-span-2">
                      <Textarea
                        value={resumo}
                        onChange={(e) => setResumo(e.target.value)}
                        placeholder="Resumo da conversa..."
                        required
                      />
                    </Campo>
                    <Campo label="Próxima ação" className="col-span-2">
                      <Input
                        value={proxAcao}
                        onChange={(e) => setProxAcao(e.target.value)}
                        placeholder="Ex.: mandar proposta na segunda"
                      />
                    </Campo>
                  </div>
                  <Botao type="submit" tamanho="sm" carregando={registrar.isPending} className="mt-2.5 w-full">
                    <Plus className="h-3.5 w-3.5" />
                    Registrar
                  </Botao>
                </form>
              )}

              {interacoes.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Nenhuma interação registrada ainda.
                </p>
              ) : (
                <ol className="flex flex-col gap-2.5">
                  {interacoes.map((i) => (
                    <li key={i.id} className="rounded-lg border border-border bg-surface-1 p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Selo>{TIPOS_INTERACAO.find((t) => t.valor === i.tipo)?.rotulo}</Selo>
                        <span className="text-[11px] text-muted-foreground">
                          {formatarDataHora(i.data)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{i.resumo}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {aba === "dados" && editavel && (
          <footer className="flex items-center gap-2 border-t border-border px-5 py-3">
            <Botao onClick={salvarDados} carregando={salvar.isPending} className="flex-1">
              Salvar alterações
            </Botao>
            {pode("crm.excluir") && (
              <Botao
                variante="contorno"
                tamanho="icone"
                title="Excluir contato"
                onClick={() => {
                  if (confirm(`Excluir "${form.nome}" em definitivo?`))
                    excluir.mutate(form.id, { onSuccess: aoFechar });
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Botao>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}
