import * as React from "react";
import { Lock, Mail, Plus, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { useUsuarios } from "@/hooks/useCrm";
import {
  useCancelarConvite,
  useConvites,
  useCriarConvite,
  useExcluirPapel,
  usePapeis,
  useSalvarPapel,
  useSalvarUsuario,
} from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Botao, Campo, Carregando, Cartao, Input, Modal, Select, Selo, Switch } from "@/components/ui";
import type { Papel, Permissoes } from "@/lib/types";
import { CATALOGO_PERMISSOES } from "@/lib/types";
import { cn, formatarData, iniciais } from "@/lib/utils";

/* ------------------------------ Editor de papel --------------------------- */

function EditorPapel({
  papel,
  aoFechar,
}: {
  papel: Papel | "novo" | null;
  aoFechar: () => void;
}) {
  const salvar = useSalvarPapel();
  const novo = papel === "novo";
  const atual = novo ? null : papel;

  const [nome, setNome] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [perms, setPerms] = React.useState<Permissoes>({});

  React.useEffect(() => {
    if (!papel) return;
    setNome(atual?.nome ?? "");
    setDescricao(atual?.descricao ?? "");
    setPerms(atual?.permissoes ?? {});
  }, [papel, atual]);

  const dono = perms["admin.org"] === true;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    salvar.mutate(
      {
        id: atual?.id,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        permissoes: perms,
      },
      { onSuccess: aoFechar },
    );
  }

  return (
    <Modal
      aberto={!!papel}
      aoFechar={aoFechar}
      titulo={novo ? "Novo papel" : `Papel: ${atual?.nome ?? ""}`}
      descricao="Você define o nome e exatamente o que esse papel pode fazer."
      largura="max-w-2xl"
    >
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nome do papel">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Consultor júnior"
              required
            />
          </Campo>
          <Campo label="Descrição" hint="Só para lembrar para que serve.">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </Campo>
        </div>

        {dono && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0" />
            <span>
              Este papel é <strong>dono da conta</strong>: passa em qualquer verificação, inclusive
              comissões. As permissões abaixo ficam sem efeito.
            </span>
          </div>
        )}

        <div className="max-h-[46vh] overflow-y-auto pr-1">
          {CATALOGO_PERMISSOES.map((g) => (
            <div key={g.grupo} className="mb-4 last:mb-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {g.grupo}
              </p>
              <div className="flex flex-col gap-1">
                {g.itens.map((i) => {
                  const ativo = perms[i.chave] === true;
                  return (
                    <div
                      key={i.chave}
                      className={cn(
                        "flex items-start gap-3 rounded-md border px-3 py-2",
                        i.sensivel
                          ? "border-ma-amarelo/60 bg-ma-amarelo/10"
                          : "border-transparent hover:bg-muted/50",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {i.sensivel && <Lock className="h-3 w-3 shrink-0 text-ma-cinza" />}
                          <p className="text-sm font-medium text-foreground">{i.rotulo}</p>
                          {i.sensivel && <Selo className="bg-ma-amarelo/40 text-ma-preto">sensível</Selo>}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{i.descricao}</p>
                      </div>
                      <div className="pt-1">
                        <Switch
                          checked={ativo}
                          disabled={dono && i.chave !== "admin.org"}
                          onChange={(v) => setPerms((p) => ({ ...p, [i.chave]: v }))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Botao type="button" variante="contorno" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            Salvar papel
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------- Convite -------------------------------- */

function NovoConvite({
  aberto,
  aoFechar,
  papeis,
}: {
  aberto: boolean;
  aoFechar: () => void;
  papeis: Papel[];
}) {
  const criar = useCriarConvite();
  const [email, setEmail] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [papelId, setPapelId] = React.useState("");

  React.useEffect(() => {
    if (aberto) {
      setEmail("");
      setNome("");
      setPapelId(papeis.find((p) => !p.permissoes["admin.org"])?.id ?? papeis[0]?.id ?? "");
    }
  }, [aberto, papeis]);

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Convidar pessoa"
      descricao="Ela entra sozinha: basta criar a conta usando exatamente este e-mail."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          criar.mutate({ email, nome: nome.trim() || null, papel_id: papelId || null }, { onSuccess: aoFechar });
        }}
        className="flex flex-col gap-3"
      >
        <Campo label="E-mail" hint="Precisa ser o mesmo e-mail que a pessoa vai usar no cadastro.">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Campo>
        <Campo label="Nome (opcional)">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo label="Papel">
          <Select value={papelId} onChange={(e) => setPapelId(e.target.value)}>
            {papeis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <div className="mt-1 flex justify-end gap-2">
          <Botao type="button" variante="contorno" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={criar.isPending}>
            Criar convite
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------- Página -------------------------------- */

export default function Usuarios() {
  const { usuario } = useAuth();
  const { data: usuarios = [], isLoading } = useUsuarios();
  const { data: papeis = [] } = usePapeis();
  const { data: convites = [] } = useConvites();
  const salvarUsuario = useSalvarUsuario();
  const excluirPapel = useExcluirPapel();
  const cancelarConvite = useCancelarConvite();

  const [papelAberto, setPapelAberto] = React.useState<Papel | "novo" | null>(null);
  const [conviteAberto, setConviteAberto] = React.useState(false);

  if (isLoading) return <Carregando />;

  return (
    <div className="mx-auto max-w-4xl px-5 py-6">
      <h1 className="font-display text-xl font-semibold text-foreground">Usuários e papéis</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Cadastre quantas pessoas quiser e crie papéis com os nomes que fizerem sentido para a M&A.
      </p>

      {/* ------------------------------ Usuários ------------------------------ */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Pessoas ({usuarios.length})</h2>
        <Botao tamanho="sm" onClick={() => setConviteAberto(true)}>
          <UserPlus className="h-3.5 w-3.5" /> Convidar
        </Botao>
      </div>

      <Cartao className="mt-2 divide-y divide-border/60">
        {usuarios.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ma-azul text-[11px] font-semibold text-ma-branco">
              {iniciais(u.nome)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {u.nome}
                {u.id === usuario?.id && (
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">(você)</span>
                )}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
            </div>

            <Select
              value={u.papel_id ?? ""}
              onChange={(e) => salvarUsuario.mutate({ id: u.id, papel_id: e.target.value || null })}
              className="h-8 w-auto text-xs"
            >
              <option value="">Sem papel</option>
              {papeis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>

            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Switch
                checked={u.ativo}
                disabled={u.id === usuario?.id}
                onChange={(v) => salvarUsuario.mutate({ id: u.id, ativo: v })}
              />
              {u.ativo ? "Ativo" : "Inativo"}
            </label>
          </div>
        ))}
      </Cartao>

      {/* ------------------------------ Convites ------------------------------ */}
      {convites.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-semibold text-foreground">Convites pendentes</h2>
          <Cartao className="mt-2 divide-y divide-border/60">
            {convites.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{c.email}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {papeis.find((p) => p.id === c.papel_id)?.nome ?? "Sem papel"} · expira em{" "}
                    {formatarData(c.expira_em)}
                  </p>
                </div>
                <button
                  onClick={() => cancelarConvite.mutate(c.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  title="Cancelar convite"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Cartao>
        </>
      )}

      {/* -------------------------------- Papéis ------------------------------ */}
      <div className="mt-8 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Papéis ({papeis.length})</h2>
          <p className="text-[11px] text-muted-foreground">
            <Lock className="mr-1 inline h-3 w-3" />
            Comissões vêm desligadas em todo papel novo. Ligue só para quem é sócio.
          </p>
        </div>
        <Botao tamanho="sm" variante="contorno" onClick={() => setPapelAberto("novo")}>
          <Plus className="h-3.5 w-3.5" /> Novo papel
        </Botao>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {papeis.map((p) => {
          const dono = p.permissoes["admin.org"] === true;
          const vêComissoes = dono || p.permissoes["comissoes.ver"] === true;
          const emUso = usuarios.filter((u) => u.papel_id === p.id).length;
          return (
            <Cartao key={p.id} className="p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground">{p.nome}</p>
                    {dono && <Selo className="bg-ma-azul/10 text-ma-azul dark:text-ma-amarelo">dono</Selo>}
                    {vêComissoes && (
                      <Selo className="bg-ma-amarelo/40 text-ma-preto">
                        <Lock className="h-2.5 w-2.5" /> comissões
                      </Selo>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.descricao ?? "Sem descrição"}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {emUso === 0 ? "Ninguém usando" : `${emUso} pessoa(s)`}
                  </p>
                </div>
                {!p.sistema && emUso === 0 && (
                  <button
                    onClick={() => excluirPapel.mutate(p.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    title="Excluir papel"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Botao
                tamanho="sm"
                variante="contorno"
                className="mt-2 w-full"
                onClick={() => setPapelAberto(p)}
              >
                Editar permissões
              </Botao>
            </Cartao>
          );
        })}
      </div>

      <EditorPapel papel={papelAberto} aoFechar={() => setPapelAberto(null)} />
      <NovoConvite aberto={conviteAberto} aoFechar={() => setConviteAberto(false)} papeis={papeis} />
    </div>
  );
}
