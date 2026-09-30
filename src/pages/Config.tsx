import * as React from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useContatos, useEtapas } from "@/hooks/useCrm";
import {
  useExcluirEtapa,
  useExcluirOrigem,
  useSalvarEtapa,
  useSalvarOrigem,
  useTodasOrigens,
} from "@/hooks/useAdmin";
import { useExcluirTabela, useSalvarTabela, useTabelas } from "@/hooks/useSimulador";
import { useAuth } from "@/contexts/AuthContext";
import { Botao, Carregando, Cartao, Input, Select, Switch } from "@/components/ui";
import type { Segmento, TabelaConsorcio, TipoEtapa } from "@/lib/types";
import { SEGMENTOS } from "@/lib/types";

const TIPOS: { valor: TipoEtapa; rotulo: string }[] = [
  { valor: "aberta", rotulo: "Em aberto" },
  { valor: "ganha", rotulo: "Ganhou" },
  { valor: "perdida", rotulo: "Perdeu" },
];

export default function Config() {
  const { pode } = useAuth();
  const { data: etapas = [], isLoading } = useEtapas();
  const { data: origens = [] } = useTodasOrigens();
  const { data: contatos = [] } = useContatos();
  const salvarEtapa = useSalvarEtapa();
  const excluirEtapa = useExcluirEtapa();
  const salvarOrigem = useSalvarOrigem();
  const excluirOrigem = useExcluirOrigem();

  const [novaEtapa, setNovaEtapa] = React.useState("");
  const [novaOrigem, setNovaOrigem] = React.useState("");

  if (isLoading) return <Carregando />;

  const usoEtapa = (id: string) => contatos.filter((c) => c.etapa_id === id).length;
  const usoOrigem = (id: string) => contatos.filter((c) => c.origem_id === id).length;

  return (
    <div className="mx-auto max-w-5xl px-5 py-6">
      <h1 className="font-display text-xl font-semibold text-foreground">Configurações</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        O funil e as origens são seus. Mude conforme a operação for mudando.
      </p>

      {/* -------------------------------- Etapas ------------------------------ */}
      <h2 className="mt-6 text-sm font-semibold text-foreground">Etapas do funil</h2>
      <p className="text-[11px] text-muted-foreground">
        A ordem define as colunas do kanban. Etapas do tipo "Ganhou" e "Perdeu" saem da fila do Meu dia.
      </p>

      <Cartao className="mt-2 divide-y divide-border/60">
        {etapas.map((e, i) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />

            <input
              type="color"
              value={e.cor}
              onChange={(ev) => salvarEtapa.mutate({ id: e.id, cor: ev.target.value })}
              className="h-7 w-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
              title="Cor da etapa"
            />

            <Input
              defaultValue={e.nome}
              onBlur={(ev) => {
                const v = ev.target.value.trim();
                if (v && v !== e.nome) salvarEtapa.mutate({ id: e.id, nome: v });
              }}
              className="h-8 min-w-[140px] flex-1 text-sm"
            />

            <Select
              value={e.tipo}
              onChange={(ev) => salvarEtapa.mutate({ id: e.id, tipo: ev.target.value as TipoEtapa })}
              className="h-8 w-auto text-xs"
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </Select>

            <div className="flex shrink-0 items-center gap-0.5">
              <Botao
                variante="fantasma"
                tamanho="sm"
                disabled={i === 0}
                onClick={() => {
                  const ant = etapas[i - 1];
                  salvarEtapa.mutate({ id: e.id, ordem: ant.ordem });
                  salvarEtapa.mutate({ id: ant.id, ordem: e.ordem });
                }}
                title="Subir"
              >
                ↑
              </Botao>
              <Botao
                variante="fantasma"
                tamanho="sm"
                disabled={i === etapas.length - 1}
                onClick={() => {
                  const prox = etapas[i + 1];
                  salvarEtapa.mutate({ id: e.id, ordem: prox.ordem });
                  salvarEtapa.mutate({ id: prox.id, ordem: e.ordem });
                }}
                title="Descer"
              >
                ↓
              </Botao>
              <button
                disabled={usoEtapa(e.id) > 0}
                onClick={() => excluirEtapa.mutate(e.id)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                title={usoEtapa(e.id) > 0 ? `${usoEtapa(e.id)} contato(s) aqui` : "Excluir etapa"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            const nome = novaEtapa.trim();
            if (!nome) return;
            salvarEtapa.mutate(
              { nome, ordem: (etapas[etapas.length - 1]?.ordem ?? 0) + 1, cor: "#7F7979", tipo: "aberta" },
              { onSuccess: () => setNovaEtapa("") },
            );
          }}
          className="flex gap-2 px-3 py-2.5"
        >
          <Input
            value={novaEtapa}
            onChange={(ev) => setNovaEtapa(ev.target.value)}
            placeholder="Nova etapa..."
            className="h-8 text-sm"
          />
          <Botao type="submit" tamanho="sm" variante="contorno">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Botao>
        </form>
      </Cartao>

      {/* ------------------------------- Origens ------------------------------ */}
      <h2 className="mt-8 text-sm font-semibold text-foreground">Origens de lead</h2>
      <p className="text-[11px] text-muted-foreground">
        De onde a pessoa veio. Desligue em vez de excluir para não perder o histórico.
      </p>

      <Cartao className="mt-2 divide-y divide-border/60">
        {origens.map((o) => (
          <div key={o.id} className="flex items-center gap-2 px-3 py-2">
            <Input
              defaultValue={o.nome}
              onBlur={(ev) => {
                const v = ev.target.value.trim();
                if (v && v !== o.nome) salvarOrigem.mutate({ id: o.id, nome: v });
              }}
              className="h-8 flex-1 text-sm"
            />
            <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
              <Switch checked={o.ativa} onChange={(v) => salvarOrigem.mutate({ id: o.id, ativa: v })} />
              {o.ativa ? "Ativa" : "Oculta"}
            </label>
            <button
              disabled={usoOrigem(o.id) > 0}
              onClick={() => excluirOrigem.mutate(o.id)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              title={usoOrigem(o.id) > 0 ? `${usoOrigem(o.id)} contato(s) com esta origem` : "Excluir origem"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            const nome = novaOrigem.trim();
            if (!nome) return;
            salvarOrigem.mutate({ nome, ativa: true }, { onSuccess: () => setNovaOrigem("") });
          }}
          className="flex gap-2 px-3 py-2.5"
        >
          <Input
            value={novaOrigem}
            onChange={(ev) => setNovaOrigem(ev.target.value)}
            placeholder="Nova origem..."
            className="h-8 text-sm"
          />
          <Botao type="submit" tamanho="sm" variante="contorno">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Botao>
        </form>
      </Cartao>

      {pode("simulador.tabelas") && <Tabelas />}
    </div>
  );
}

/* --------------------- Tabelas das administradoras ------------------------ */

const NOVA: Partial<TabelaConsorcio> = {
  administradora: "Banco do Brasil",
  nome: "",
  segmento: "auto",
  prazo_meses: 80,
  taxa_adm: 22,
  fundo_reserva: 2,
  seguro_mensal: 0,
  lance_embutido_max: 25,
  credito_min: null,
  credito_max: null,
  ativa: true,
};

function Tabelas() {
  const { data: tabelas = [] } = useTabelas();
  const salvar = useSalvarTabela();
  const excluir = useExcluirTabela();
  const [nova, setNova] = React.useState<Partial<TabelaConsorcio> | null>(null);

  /** Salva no blur, só quando o número mudou de verdade. */
  const campoNum = (t: TabelaConsorcio, chave: keyof TabelaConsorcio, passo = "0.1") => (
    <Input
      type="number"
      step={passo}
      min={0}
      defaultValue={String(t[chave] ?? 0)}
      onBlur={(ev) => {
        const v = Number(ev.target.value);
        if (!Number.isNaN(v) && v !== Number(t[chave])) salvar.mutate({ id: t.id, [chave]: v });
      }}
      className="h-8 w-[74px] px-2 text-center font-num text-xs"
    />
  );

  return (
    <>
      <h2 className="mt-8 text-sm font-semibold text-foreground">Tabelas das administradoras</h2>
      <p className="text-[11px] text-muted-foreground">
        É daqui que o simulador tira parcela e custo. Taxa de administração e fundo de reserva são o
        total do plano, em % do crédito. Seguro é % do crédito por mês.
      </p>

      <Cartao className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Plano</th>
              <th className="px-3 py-2.5 font-medium">Segmento</th>
              <th className="px-2 py-2.5 text-center font-medium">Prazo</th>
              <th className="px-2 py-2.5 text-center font-medium">Adm %</th>
              <th className="px-2 py-2.5 text-center font-medium">FR %</th>
              <th className="px-2 py-2.5 text-center font-medium">Seguro %/mês</th>
              <th className="px-2 py-2.5 text-center font-medium">Emb. máx %</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {tabelas.map((t) => (
              <tr
                key={t.id}
                className={cnAtiva(t.ativa)}
              >
                <td className="px-3 py-2">
                  <Input
                    defaultValue={t.nome}
                    onBlur={(ev) => {
                      const v = ev.target.value.trim();
                      if (v && v !== t.nome) salvar.mutate({ id: t.id, nome: v });
                    }}
                    className="h-8 min-w-[150px] text-xs"
                  />
                  <Input
                    defaultValue={t.administradora}
                    onBlur={(ev) => {
                      const v = ev.target.value.trim();
                      if (v && v !== t.administradora)
                        salvar.mutate({ id: t.id, administradora: v });
                    }}
                    className="mt-1 h-7 min-w-[150px] text-[11px] text-muted-foreground"
                  />
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={t.segmento}
                    onChange={(ev) =>
                      salvar.mutate({ id: t.id, segmento: ev.target.value as Segmento })
                    }
                    className="h-8 w-auto text-xs"
                  >
                    {SEGMENTOS.map((s) => (
                      <option key={s.valor} value={s.valor}>
                        {s.rotulo}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-2">{campoNum(t, "prazo_meses", "1")}</td>
                <td className="px-2 py-2">{campoNum(t, "taxa_adm")}</td>
                <td className="px-2 py-2">{campoNum(t, "fundo_reserva")}</td>
                <td className="px-2 py-2">{campoNum(t, "seguro_mensal", "0.001")}</td>
                <td className="px-2 py-2">{campoNum(t, "lance_embutido_max", "1")}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <Switch
                      checked={t.ativa}
                      onChange={(v) => salvar.mutate({ id: t.id, ativa: v })}
                    />
                    <button
                      onClick={() => {
                        if (confirm(`Excluir a tabela ${t.nome}?`)) excluir.mutate(t.id);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Excluir tabela"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-border px-3 py-2.5">
          {nova ? (
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                salvar.mutate(nova, { onSuccess: () => setNova(null) });
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <Input
                value={nova.administradora ?? ""}
                onChange={(ev) => setNova({ ...nova, administradora: ev.target.value })}
                placeholder="Administradora"
                className="h-8 w-[160px] text-xs"
                required
              />
              <Input
                value={nova.nome ?? ""}
                onChange={(ev) => setNova({ ...nova, nome: ev.target.value })}
                placeholder="Nome do plano"
                className="h-8 w-[160px] text-xs"
                required
              />
              <Select
                value={nova.segmento}
                onChange={(ev) => setNova({ ...nova, segmento: ev.target.value as Segmento })}
                className="h-8 w-auto text-xs"
              >
                {SEGMENTOS.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                value={nova.prazo_meses}
                onChange={(ev) => setNova({ ...nova, prazo_meses: Number(ev.target.value) })}
                className="h-8 w-[80px] font-num text-xs"
                title="Prazo em meses"
              />
              <Botao type="submit" tamanho="sm" carregando={salvar.isPending}>
                Criar
              </Botao>
              <Botao type="button" tamanho="sm" variante="contorno" onClick={() => setNova(null)}>
                Cancelar
              </Botao>
            </form>
          ) : (
            <Botao tamanho="sm" variante="contorno" onClick={() => setNova(NOVA)}>
              <Plus className="h-3.5 w-3.5" /> Nova tabela
            </Botao>
          )}
        </div>
      </Cartao>
    </>
  );
}

const cnAtiva = (ativa: boolean) =>
  `border-b border-border/60 last:border-0${ativa ? "" : " opacity-50"}`;
