import * as React from "react";
import {
  CalendarPlus,
  Check,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  StickyNote,
  Users,
} from "lucide-react";
import { useAgendarAtividade } from "@/hooks/useCrm";
import type { Contato, TipoInteracao } from "@/lib/types";
import { TIPOS_INTERACAO } from "@/lib/types";
import { Botao, Campo, Input, Modal, Select, Textarea } from "@/components/ui";
import { cn, diasAte, formatarData, hoje } from "@/lib/utils";

export const ICONE_ATIVIDADE: Record<TipoInteracao, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  ligacao: Phone,
  reuniao: Users,
  presencial: MapPin,
  email: Mail,
  nota: StickyNote,
};

/** Estado visual da atividade agendada, no padrão do funil: vermelho atrasado, âmbar hoje. */
export function estadoAtividade(contato: Contato) {
  const dias = diasAte(contato.proxima_acao_em);

  if (contato.proxima_acao_em === null && !contato.proxima_acao)
    return {
      tem: false,
      curto: "Sem atividade",
      quando: "Nada agendado",
      strip: "bg-muted/60 text-muted-foreground hover:bg-muted",
      ponto: "bg-muted-foreground/40",
    };

  if (dias === null)
    return {
      tem: true,
      curto: "Sem data",
      quando: "Sem data definida",
      strip:
        "bg-muted/60 text-muted-foreground hover:bg-muted",
      ponto: "bg-muted-foreground/60",
    };

  if (dias < 0)
    return {
      tem: true,
      curto: `${-dias}d atrasado`,
      quando: `Atrasado desde ${formatarData(contato.proxima_acao_em)}`,
      strip:
        "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900",
      ponto: "bg-red-500",
    };

  if (dias === 0)
    return {
      tem: true,
      curto: "Hoje",
      quando: `Hoje, ${formatarData(contato.proxima_acao_em)}`,
      strip:
        "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900",
      ponto: "bg-amber-500",
    };

  return {
    tem: true,
    curto: dias === 1 ? "Amanhã" : `Em ${dias}d`,
    quando: formatarData(contato.proxima_acao_em),
    strip:
      "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900",
    ponto: "bg-emerald-500",
  };
}

/**
 * Faixa da atividade no rodapé do card do funil.
 * Fechada mostra ícone + prazo. No hover abre o texto e o dia por cima do card.
 */
export function FaixaAtividade({
  contato,
  aoAgendar,
}: {
  contato: Contato;
  aoAgendar: () => void;
}) {
  const e = estadoAtividade(contato);
  const Icone = contato.proxima_acao_tipo
    ? ICONE_ATIVIDADE[contato.proxima_acao_tipo]
    : e.tem
      ? CalendarPlus
      : CalendarPlus;

  return (
    <div
      role="button"
      tabIndex={0}
      title={e.tem ? undefined : "Agendar atividade"}
      // impede que o dnd-kit inicie um arrasto e que o clique abra a ficha
      onPointerDown={(ev) => ev.stopPropagation()}
      onClick={(ev) => {
        ev.stopPropagation();
        aoAgendar();
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ev.stopPropagation();
          aoAgendar();
        }
      }}
      className={cn(
        "group/at absolute inset-x-0 bottom-0 z-10 cursor-pointer rounded-b-md px-2.5 py-1 transition-colors",
        e.strip,
      )}
    >
      {/* fechado */}
      <div className="flex items-center gap-1.5 group-hover/at:invisible">
        <Icone className="h-3 w-3 shrink-0" />
        <span className="flex-1 truncate text-[11px] font-medium leading-tight">{e.curto}</span>
        {!e.tem && <span className="text-[13px] leading-none">+</span>}
      </div>

      {/* aberto no hover, por cima do card */}
      <div
        className={cn(
          "invisible absolute inset-x-0 bottom-0 rounded-b-md px-2.5 py-1.5 shadow-pop group-hover/at:visible",
          e.strip,
        )}
      >
        <div className="flex items-start gap-1.5">
          <Icone className="mt-px h-3 w-3 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium leading-snug">
              {contato.proxima_acao ?? (e.tem ? "Atividade sem descrição" : "Agendar atividade")}
            </p>
            <p className="mt-px text-[10px] leading-tight opacity-75">{e.quando}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Modal enxuto para agendar ou concluir a próxima atividade do lead. */
export function AtividadeRapida({
  contato,
  aoFechar,
}: {
  contato: Contato | null;
  aoFechar: () => void;
}) {
  const agendar = useAgendarAtividade();

  const [tipo, setTipo] = React.useState<TipoInteracao>("whatsapp");
  const [oQue, setOQue] = React.useState("");
  const [quando, setQuando] = React.useState("");

  React.useEffect(() => {
    if (!contato) return;
    setTipo(contato.proxima_acao_tipo ?? "whatsapp");
    setOQue(contato.proxima_acao ?? "");
    setQuando(contato.proxima_acao_em ?? hoje());
  }, [contato]);

  if (!contato) return null;

  const jaTem = !!(contato.proxima_acao || contato.proxima_acao_em);

  function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    agendar.mutate(
      {
        id: contato!.id,
        proxima_acao: oQue.trim() || null,
        proxima_acao_em: quando || null,
        proxima_acao_tipo: tipo,
      },
      { onSuccess: aoFechar },
    );
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={jaTem ? "Atividade do lead" : "Nova atividade"}
      descricao={contato.nome}
    >
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Tipo">
            <Select value={tipo} onChange={(ev) => setTipo(ev.target.value as TipoInteracao)}>
              {TIPOS_INTERACAO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Quando">
            <Input type="date" value={quando} onChange={(ev) => setQuando(ev.target.value)} />
          </Campo>
        </div>

        <Campo label="O que fazer" hint="Aparece no card do funil e na fila do Meu dia.">
          <Textarea
            value={oQue}
            onChange={(ev) => setOQue(ev.target.value)}
            placeholder="Ex.: mandar simulação de carro 60x"
            autoFocus
          />
        </Campo>

        <div className="mt-1 flex flex-wrap justify-end gap-2">
          {jaTem && (
            <Botao
              type="button"
              variante="contorno"
              onClick={() =>
                agendar.mutate(
                  {
                    id: contato.id,
                    proxima_acao: null,
                    proxima_acao_em: null,
                    proxima_acao_tipo: null,
                  },
                  { onSuccess: aoFechar },
                )
              }
              className="mr-auto"
            >
              <Check className="h-4 w-4" /> Concluir
            </Botao>
          )}
          <Botao type="button" variante="contorno" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={agendar.isPending}>
            Salvar atividade
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
