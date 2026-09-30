import * as React from "react";
import { AlarmClock, CalendarCheck, CheckCircle2, MessageCircle, PhoneOff, Sparkles } from "lucide-react";
import { useContatos, useEtapas } from "@/hooks/useCrm";
import { useAuth } from "@/contexts/AuthContext";
import FichaContato from "@/components/FichaContato";
import { Carregando, Cartao, Selo, Vazio } from "@/components/ui";
import type { Contato, Etapa } from "@/lib/types";
import { cn, diasAte, diasDesde, linkWhatsapp, moeda } from "@/lib/utils";

const DIAS_ESQUECIDO = 30;

function Fila({
  icone: Icone,
  titulo,
  descricao,
  contatos,
  etapas,
  cor,
  aoAbrir,
}: {
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  descricao: string;
  contatos: Contato[];
  etapas: Etapa[];
  cor: string;
  aoAbrir: (c: Contato) => void;
}) {
  if (contatos.length === 0) return null;

  return (
    <Cartao className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", cor)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
            <span className="rounded bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">
              {contatos.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>

      <ul className="divide-y divide-border/60">
        {contatos.map((c) => {
          const etapa = etapas.find((e) => e.id === c.etapa_id);
          const wa = linkWhatsapp(c.telefone);
          const dias = diasDesde(c.ultimo_contato_em);
          const atraso = diasAte(c.proxima_acao_em);
          return (
            <li key={c.id}>
              <div
                onClick={() => aoAbrir(c)}
                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{c.nome}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {c.proxima_acao ??
                      c.interesse ??
                      (dias === null ? "nunca contatado" : `último contato há ${dias}d`)}
                  </p>
                </div>

                {c.valor_estimado ? (
                  <span className="hidden font-num text-xs text-muted-foreground sm:block">
                    {moeda(c.valor_estimado)}
                  </span>
                ) : null}

                {etapa && <Selo cor={etapa.cor} className="hidden sm:inline-flex">{etapa.nome}</Selo>}

                {atraso !== null && atraso < 0 && (
                  <span className="rounded bg-red-100 px-1.5 py-px text-[11px] font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
                    {-atraso}d
                  </span>
                )}

                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Abrir no WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                ) : (
                  <PhoneOff className="h-4 w-4 shrink-0 text-destructive" />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}

export default function Hoje() {
  const { usuario, pode } = useAuth();
  const { data: contatos = [], isLoading } = useContatos();
  const { data: etapas = [] } = useEtapas();
  const [abertoId, setAbertoId] = React.useState<string | null>(null);
  const [somenteMeus, setSomenteMeus] = React.useState(false);

  const abertas = React.useMemo(
    () => new Set(etapas.filter((e) => e.tipo === "aberta").map((e) => e.id)),
    [etapas],
  );

  const base = React.useMemo(() => {
    const ativos = contatos.filter((c) => !c.etapa_id || abertas.has(c.etapa_id));
    return somenteMeus ? ativos.filter((c) => c.responsavel_id === usuario?.id) : ativos;
  }, [contatos, abertas, somenteMeus, usuario]);

  const filas = React.useMemo(() => {
    const atrasados: Contato[] = [];
    const paraHoje: Contato[] = [];
    const semTelefone: Contato[] = [];
    const esquecidos: Contato[] = [];

    for (const c of base) {
      const atraso = diasAte(c.proxima_acao_em);
      if (atraso !== null && atraso < 0) {
        atrasados.push(c);
        continue;
      }
      if (atraso === 0) {
        paraHoje.push(c);
        continue;
      }
      if (!c.telefone) {
        semTelefone.push(c);
        continue;
      }
      if (atraso === null) {
        const dias = diasDesde(c.ultimo_contato_em);
        if (dias === null || dias >= DIAS_ESQUECIDO) esquecidos.push(c);
      }
    }

    const porAtraso = (a: Contato, b: Contato) =>
      (a.proxima_acao_em ?? "").localeCompare(b.proxima_acao_em ?? "");
    const porEsquecimento = (a: Contato, b: Contato) =>
      (a.ultimo_contato_em ?? "").localeCompare(b.ultimo_contato_em ?? "");

    return {
      atrasados: atrasados.sort(porAtraso),
      paraHoje: paraHoje.sort(porAtraso),
      semTelefone: semTelefone.sort((a, b) => a.nome.localeCompare(b.nome)),
      esquecidos: esquecidos.sort(porEsquecimento),
    };
  }, [base]);

  const total =
    filas.atrasados.length + filas.paraHoje.length + filas.semTelefone.length + filas.esquecidos.length;

  const aberto = contatos.find((c) => c.id === abertoId) ?? null;

  if (isLoading) return <Carregando texto="Montando seu dia..." />;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">Meu dia</h1>
          <p className="text-xs text-muted-foreground">
            {total === 0 ? "Nada na fila." : `${total} contato(s) pedindo atenção.`}
          </p>
        </div>
        {pode("crm.ver_todos") && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={somenteMeus}
              onChange={(e) => setSomenteMeus(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Só os meus
          </label>
        )}
      </div>

      {total === 0 ? (
        <Vazio
          icone={CheckCircle2}
          titulo="Fila zerada"
          descricao="Nenhuma ação atrasada, nada marcado para hoje e todo mundo com telefone e contato recente."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Fila
            icone={AlarmClock}
            titulo="Atrasados"
            descricao="A próxima ação já passou da data. Resolve isso primeiro."
            contatos={filas.atrasados}
            etapas={etapas}
            cor="text-destructive"
            aoAbrir={(c) => setAbertoId(c.id)}
          />
          <Fila
            icone={CalendarCheck}
            titulo="Para hoje"
            descricao="Marcado para hoje na ficha do contato."
            contatos={filas.paraHoje}
            etapas={etapas}
            cor="text-amber-600"
            aoAbrir={(c) => setAbertoId(c.id)}
          />
          <Fila
            icone={PhoneOff}
            titulo="Sem telefone"
            descricao="Não dá para trabalhar esses leads sem o número. Buscar o contato."
            contatos={filas.semTelefone}
            etapas={etapas}
            cor="text-destructive"
            aoAbrir={(c) => setAbertoId(c.id)}
          />
          <Fila
            icone={Sparkles}
            titulo="Esfriando"
            descricao={`Sem próxima ação marcada e mais de ${DIAS_ESQUECIDO} dias sem contato.`}
            contatos={filas.esquecidos}
            etapas={etapas}
            cor="text-sky-600"
            aoAbrir={(c) => setAbertoId(c.id)}
          />
        </div>
      )}

      {aberto && <FichaContato contato={aberto} aoFechar={() => setAbertoId(null)} />}
    </div>
  );
}
