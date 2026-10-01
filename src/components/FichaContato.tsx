import * as React from "react";
import { Copy, MessageCircle, Phone, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
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
import { copiarTexto } from "@/lib/exportar";
import {
  cn,
  cnpjValido,
  cpfValido,
  formatarData,
  formatarDataHora,
  hoje,
  linkWhatsapp,
  mascaraCep,
  mascaraCnpj,
  mascaraCpf,
  moeda,
} from "@/lib/utils";

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

  const [aba, setAba] = React.useState<"dados" | "gravacao" | "historico">("dados");
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

      /* dados para gravação */
      cpf: form.cpf || null,
      cnpj: form.cnpj || null,
      rg: form.rg || null,
      rg_emissor: form.rg_emissor || null,
      data_nascimento: form.data_nascimento || null,
      naturalidade: form.naturalidade || null,
      profissao: form.profissao || null,
      banco: form.banco || null,
      agencia: form.agencia || null,
      conta: form.conta || null,
      cep: form.cep || null,
      logradouro: form.logradouro || null,
      numero: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      endereco_cidade: form.endereco_cidade || null,
      uf: form.uf || null,
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
          {(
            [
              { chave: "dados", rotulo: "Dados" },
              { chave: "gravacao", rotulo: "Dados para gravação" },
              { chave: "historico", rotulo: `Histórico (${interacoes.length})` },
            ] as const
          ).map((a) => (
            <button
              key={a.chave}
              onClick={() => setAba(a.chave)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-2 py-2.5 text-xs font-medium transition-colors",
                aba === a.chave
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {a.rotulo}
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
          ) : aba === "gravacao" ? (
            <DadosGravacao form={form} set={set} editavel={editavel} />
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

        {aba !== "historico" && editavel && (
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

/* ------------------------- Dados para gravação ---------------------------- */

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

/** Bloco de texto pronto para colar na proposta ou mandar pro back office. */
function fichaEmTexto(c: Contato): string {
  const l: string[] = [`*${c.nome}*`];
  const add = (r: string, v?: string | null) => v && l.push(`${r}: ${v}`);

  add("CPF", c.cpf);
  add("CNPJ", c.cnpj);
  add("RG", [c.rg, c.rg_emissor].filter(Boolean).join(" / "));
  add("Nascimento", c.data_nascimento ? formatarData(c.data_nascimento) : null);
  add("Naturalidade", c.naturalidade);
  add("Profissão", c.profissao);
  add("Telefone", c.telefone);
  add("E-mail", c.email);

  const banco = [c.banco && `Banco ${c.banco}`, c.agencia && `Ag. ${c.agencia}`, c.conta && `C/C ${c.conta}`]
    .filter(Boolean)
    .join(" · ");
  if (banco) l.push("", "*Conta para débito*", banco);

  const rua = [c.logradouro, c.numero].filter(Boolean).join(", ");
  const endereco = [
    [rua, c.complemento].filter(Boolean).join(" - "),
    c.bairro,
    [c.endereco_cidade, c.uf].filter(Boolean).join("/"),
    c.cep,
  ].filter((v): v is string => Boolean(v));
  if (endereco.length) l.push("", "*Endereço*", ...endereco);

  return l.join("\n");
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      <div className="grid grid-cols-6 gap-3">{children}</div>
    </section>
  );
}

function DadosGravacao({
  form,
  set,
  editavel,
}: {
  form: Contato;
  set: <K extends keyof Contato>(k: K, v: Contato[K]) => void;
  editavel: boolean;
}) {
  const [buscandoCep, setBuscandoCep] = React.useState(false);

  // Só reclama com o documento completo — avisar a cada tecla seria ruído.
  const erroCpf =
    form.cpf && form.cpf.replace(/\D/g, "").length === 11 && !cpfValido(form.cpf)
      ? "CPF inválido — confira os números."
      : undefined;
  const erroCnpj =
    form.cnpj && form.cnpj.replace(/\D/g, "").length === 14 && !cnpjValido(form.cnpj)
      ? "CNPJ inválido — confira os números."
      : undefined;

  /** Preenche o endereço pelo CEP. Se falhar, o usuário digita na mão. */
  async function buscarCep(valor: string) {
    const d = valor.replace(/\D/g, "");
    if (d.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = (await r.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (j.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      if (j.logradouro) set("logradouro", j.logradouro);
      if (j.bairro) set("bairro", j.bairro);
      if (j.localidade) set("endereco_cidade", j.localidade);
      if (j.uf) set("uf", j.uf);
    } catch {
      toast.error("Não deu para buscar o CEP. Preencha o endereço na mão.");
    } finally {
      setBuscandoCep(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
        Dados que a administradora pede na hora de gravar a cota. Preencha o que já
        tiver — nada aqui é obrigatório.
      </p>

      <Secao titulo="Documentos">
        <Campo label="CPF" erro={erroCpf} className="col-span-3">
          <Input
            value={form.cpf ?? ""}
            onChange={(e) => set("cpf", mascaraCpf(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            disabled={!editavel}
          />
        </Campo>
        <Campo label="CNPJ" hint="Se a cota for em nome da empresa." erro={erroCnpj} className="col-span-3">
          <Input
            value={form.cnpj ?? ""}
            onChange={(e) => set("cnpj", mascaraCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            disabled={!editavel}
          />
        </Campo>
        <Campo label="RG" className="col-span-3">
          <Input value={form.rg ?? ""} onChange={(e) => set("rg", e.target.value)} disabled={!editavel} />
        </Campo>
        <Campo label="Órgão emissor" className="col-span-3">
          <Input
            value={form.rg_emissor ?? ""}
            onChange={(e) => set("rg_emissor", e.target.value)}
            placeholder="SSP/MG"
            disabled={!editavel}
          />
        </Campo>
      </Secao>

      <Secao titulo="Dados pessoais">
        <Campo label="Data de nascimento" className="col-span-3">
          <Input
            type="date"
            value={form.data_nascimento ?? ""}
            max={hoje()}
            onChange={(e) => set("data_nascimento", e.target.value || null)}
            disabled={!editavel}
          />
        </Campo>
        <Campo label="Naturalidade" hint="Cidade onde nasceu." className="col-span-3">
          <Input
            value={form.naturalidade ?? ""}
            onChange={(e) => set("naturalidade", e.target.value)}
            placeholder="Belo Horizonte/MG"
            disabled={!editavel}
          />
        </Campo>
        <Campo label="Profissão" className="col-span-3">
          <Input
            value={form.profissao ?? ""}
            onChange={(e) => set("profissao", e.target.value)}
            disabled={!editavel}
          />
        </Campo>
        <Campo label="E-mail" className="col-span-3">
          <Input
            type="email"
            value={form.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
            placeholder="cliente@email.com"
            disabled={!editavel}
          />
        </Campo>
      </Secao>

      <Secao titulo="Conta para débito das parcelas">
        <Campo label="Banco" className="col-span-2">
          <Input
            value={form.banco ?? ""}
            onChange={(e) => set("banco", e.target.value)}
            placeholder="Banco do Brasil"
            disabled={!editavel}
          />
        </Campo>
        <Campo label="Agência" className="col-span-2">
          <Input
            value={form.agencia ?? ""}
            onChange={(e) => set("agencia", e.target.value)}
            placeholder="0000-0"
            disabled={!editavel}
          />
        </Campo>
        <Campo label="Conta" className="col-span-2">
          <Input
            value={form.conta ?? ""}
            onChange={(e) => set("conta", e.target.value)}
            placeholder="00000-0"
            disabled={!editavel}
          />
        </Campo>
      </Secao>

      <Secao titulo="Endereço">
        <Campo
          label="CEP"
          hint={buscandoCep ? "Buscando..." : "Busca o endereço."}
          className="col-span-2"
        >
          <Input
            value={form.cep ?? ""}
            onChange={(e) => {
              const v = mascaraCep(e.target.value);
              set("cep", v);
              void buscarCep(v);
            }}
            placeholder="00000-000"
            inputMode="numeric"
            disabled={!editavel}
          />
        </Campo>
        <Campo label="Logradouro" className="col-span-4">
          <Input
            value={form.logradouro ?? ""}
            onChange={(e) => set("logradouro", e.target.value)}
            placeholder="Rua, avenida..."
            disabled={!editavel}
          />
        </Campo>
        <Campo label="Número" className="col-span-2">
          <Input
            value={form.numero ?? ""}
            onChange={(e) => set("numero", e.target.value)}
            disabled={!editavel}
          />
        </Campo>
        <Campo label="Complemento" className="col-span-4">
          <Input
            value={form.complemento ?? ""}
            onChange={(e) => set("complemento", e.target.value)}
            placeholder="Apto 101, bloco B"
            disabled={!editavel}
          />
        </Campo>
        <Campo label="Bairro" className="col-span-2">
          <Input
            value={form.bairro ?? ""}
            onChange={(e) => set("bairro", e.target.value)}
            disabled={!editavel}
          />
        </Campo>
        <Campo label="Cidade" className="col-span-2">
          <Input
            value={form.endereco_cidade ?? ""}
            onChange={(e) => set("endereco_cidade", e.target.value)}
            disabled={!editavel}
          />
        </Campo>
        <Campo label="UF" className="col-span-2">
          <Select value={form.uf ?? ""} onChange={(e) => set("uf", e.target.value || null)} disabled={!editavel}>
            <option value="">—</option>
            {UFS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </Select>
        </Campo>
      </Secao>

      <Botao
        variante="contorno"
        tamanho="sm"
        onClick={async () => {
          const ok = await copiarTexto(fichaEmTexto(form));
          toast[ok ? "success" : "error"](
            ok ? "Ficha copiada." : "Seu navegador bloqueou a cópia.",
          );
        }}
      >
        <Copy className="h-3.5 w-3.5" />
        Copiar ficha
      </Botao>
    </div>
  );
}
