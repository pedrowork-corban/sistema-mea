import * as React from "react";
import type { ResultadoSimulacao } from "@/lib/consorcio";
import type { Segmento } from "@/lib/types";
import { SEGMENTOS } from "@/lib/types";
import { moedaExata, pct } from "@/lib/utils";

export type Marca = "ma" | "bb" | "canopus";

interface Tema {
  rotulo: string;
  fundo: string;
  texto: string;
  detalhe: string;
  /** texto sobre o detalhe */
  detalheTexto: string;
  /** cor de destaque legível sobre o cartão branco */
  destaque: string;
  suave: string;
  representante: boolean;
}

export const TEMAS: Record<Marca, Tema> = {
  ma: {
    rotulo: "Martinelle & Avelar",
    fundo: "linear-gradient(165deg, #04102b 0%, #000f30 45%, #01060f 100%)",
    texto: "#F8F8F8",
    detalhe: "#F6E27F",
    detalheTexto: "#000f30",
    destaque: "#000f30",
    suave: "rgba(248,248,248,0.55)",
    representante: false,
  },
  bb: {
    rotulo: "BB Consórcios",
    fundo: "linear-gradient(165deg, #FFF45A 0%, #FFEF00 45%, #F2D900 100%)",
    texto: "#003399",
    detalhe: "#003399",
    detalheTexto: "#FFEF00",
    destaque: "#003399",
    suave: "rgba(0,51,153,0.62)",
    representante: true,
  },
  canopus: {
    rotulo: "Canopus",
    fundo: "linear-gradient(165deg, #123A5C 0%, #0B2540 50%, #061321 100%)",
    texto: "#F4F7FB",
    detalhe: "#F59E0B",
    detalheTexto: "#0B2540",
    destaque: "#B45309",
    suave: "rgba(244,247,251,0.55)",
    representante: true,
  },
};

export interface DadosProposta {
  marca: Marca;
  titulo: string;
  cliente: string;
  administradora: string;
  segmento: Segmento;
  credito: number;
  prazoMeses: number;
  taxaAdm: number;
  fundoReserva: number;
  lanceProprio: number;
  vendedorNome: string;
  vendedorCargo: string;
  vendedorTelefone: string;
  vendedorEmail: string;
  comparativo: { jurosMes: number; parcela: number; total: number } | null;
}

/* ----------------------------- peças do cartão ---------------------------- */

function Linha({
  rotulo,
  valor,
  tema,
  forte,
}: {
  rotulo: string;
  valor: string;
  tema: Tema;
  forte?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[5px]">
      <span className="text-[11px] leading-tight text-[#6B7280]">{rotulo}</span>
      <span
        className="font-num text-right text-[13px] font-semibold tabular-nums leading-tight"
        style={{ color: forte ? tema.destaque : "#0B1220" }}
      >
        {valor}
      </span>
    </div>
  );
}

function Secao({ titulo, tema, children }: { titulo: string; tema: Tema; children: React.ReactNode }) {
  return (
    <div className="mt-3.5">
      <p
        className="mb-1 inline-block border-b-[1.5px] pb-[3px] text-[10px] font-bold uppercase tracking-[0.09em]"
        style={{ color: "#0B1220", borderColor: tema.detalhe }}
      >
        {titulo}
      </p>
      <div className="border-t border-[#EDF0F4] pt-0.5">{children}</div>
    </div>
  );
}

/**
 * Cartão da proposta, formato story.
 * Estilo todo em hex/inline: é o que será rasterizado em PNG/PDF, então não pode
 * depender das variáveis CSS do tema do app.
 */
export const CartaoProposta = React.forwardRef<
  HTMLDivElement,
  { dados: DadosProposta; r: ResultadoSimulacao }
>(function CartaoProposta({ dados: d, r }, ref) {
  const tema = TEMAS[d.marca];
  const segmento = SEGMENTOS.find((s) => s.valor === d.segmento);
  const geradoEm = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      ref={ref}
      className="flex w-[420px] flex-col px-6 pb-5 pt-7 font-sans"
      style={{ background: tema.fundo, color: tema.texto }}
    >
      {/* topo */}
      <div className="text-center">
        <p className="font-display text-[22px] font-bold leading-none tracking-tight">
          {d.marca === "ma" ? (
            <>
              Martinelle <span style={{ color: tema.detalhe }}>&</span> Avelar
            </>
          ) : (
            tema.rotulo
          )}
        </p>
        {tema.representante && (
          <p
            className="mt-1.5 text-[8.5px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: tema.suave }}
          >
            Representante autorizado
          </p>
        )}
        <p className="mt-3 text-[13px] font-semibold tracking-tight">{d.titulo}</p>
        {d.cliente && (
          <p className="mt-0.5 text-[10.5px]" style={{ color: tema.suave }}>
            Preparada para {d.cliente}
          </p>
        )}
      </div>

      {/* cartão branco */}
      <div className="mt-4 rounded-[14px] bg-white px-5 pb-4 pt-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.55)]">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#8A93A0]">
          Crédito contratado
        </p>
        <p className="font-num text-[34px] font-bold leading-none tracking-tight text-[#0B1220]">
          {moedaExata(d.credito)}
        </p>

        <div className="mt-3 border-t border-[#EDF0F4] pt-1">
          <Linha rotulo="Tipo do bem" valor={segmento?.bem ?? "—"} tema={tema} />
          <Linha rotulo="Administradora" valor={d.administradora} tema={tema} />
          <Linha rotulo="Prazo" valor={`${d.prazoMeses} meses`} tema={tema} />
          <Linha
            rotulo="Taxa adm. + fundo de reserva"
            valor={pct(d.taxaAdm + d.fundoReserva, 1)}
            tema={tema}
          />
        </div>

        {/* parcela em destaque */}
        <div
          className="mt-3 flex items-center justify-between rounded-[10px] px-3.5 py-2.5"
          style={{ background: tema.detalhe }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: tema.detalheTexto }}
          >
            Parcela
          </span>
          <span
            className="font-num text-[21px] font-bold leading-none tabular-nums"
            style={{ color: tema.detalheTexto }}
          >
            {moedaExata(r.parcela)}
          </span>
        </div>

        {r.temLance && (
          <Secao titulo="Lance" tema={tema}>
            {d.lanceProprio > 0 && (
              <Linha rotulo="Lance em dinheiro" valor={moedaExata(d.lanceProprio)} tema={tema} />
            )}
            {r.lanceEmbutido > 0 && (
              <>
                <Linha rotulo="Lance embutido" valor={moedaExata(r.lanceEmbutido)} tema={tema} />
                <Linha
                  rotulo="Crédito liberado após o embutido"
                  valor={moedaExata(r.creditoLiquido)}
                  tema={tema}
                  forte
                />
              </>
            )}
            <Linha
              rotulo={`Contemplação prevista`}
              valor={r.mesesAntes === 0 ? "no ato" : `${r.mesesAntes}ª parcela`}
              tema={tema}
            />
            <Linha
              rotulo="Depois do lance"
              valor={
                r.lanceQuita
                  ? "plano quitado"
                  : `${r.novoPrazo} x ${moedaExata(r.novaParcela)}`
              }
              tema={tema}
              forte
            />
          </Secao>
        )}

        <Secao titulo="Custo efetivo" tema={tema}>
          <Linha rotulo="Total desembolsado" valor={moedaExata(r.desembolso)} tema={tema} />
          <Linha rotulo="Custo total do crédito" valor={moedaExata(r.custoTotal)} tema={tema} />
          <Linha rotulo="Custo mensal aprox." valor={moedaExata(r.custoMensal)} tema={tema} />
          <Linha rotulo="Custo ao mês" valor={pct(r.custoMensalPct, 2)} tema={tema} forte />
        </Secao>

        {d.comparativo && (
          <Secao titulo="Se fosse financiamento" tema={tema}>
            <Linha
              rotulo={`Parcela a ${pct(d.comparativo.jurosMes, 2)} a.m.`}
              valor={moedaExata(d.comparativo.parcela)}
              tema={tema}
            />
            <Linha rotulo="Total pago" valor={moedaExata(d.comparativo.total)} tema={tema} />
            <Linha
              rotulo="Diferença a favor do consórcio"
              valor={moedaExata(Math.max(0, d.comparativo.total - r.desembolso))}
              tema={tema}
              forte
            />
          </Secao>
        )}

        <p className="mt-3.5 border-t border-[#EDF0F4] pt-2 text-[8px] leading-snug text-[#9AA2AE]">
          Simulação sem caráter de proposta comercial definitiva. Consórcio não tem juros; os valores
          acima consideram taxa de administração, fundo de reserva e seguro da tabela vigente e podem
          sofrer reajuste do bem conforme o contrato do grupo. Contemplação por sorteio ou lance, sem
          data garantida.
        </p>
      </div>

      {/* rodapé */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold leading-tight">{d.vendedorNome}</p>
          <p className="truncate text-[9.5px] leading-tight" style={{ color: tema.suave }}>
            {d.vendedorCargo}
          </p>
          <p className="mt-1 truncate font-num text-[10px] leading-tight">{d.vendedorTelefone}</p>
          <p className="truncate text-[9.5px] leading-tight" style={{ color: tema.suave }}>
            {d.vendedorEmail}
          </p>
        </div>
        <p className="shrink-0 text-right text-[8px] leading-tight" style={{ color: tema.suave }}>
          Gerada em
          <br />
          {geradoEm}
        </p>
      </div>
    </div>
  );
});

/** Versão em texto, para colar no WhatsApp. */
export function propostaEmTexto(d: DadosProposta, r: ResultadoSimulacao): string {
  const seg = SEGMENTOS.find((s) => s.valor === d.segmento)?.bem ?? "";
  const l: string[] = [];

  l.push(`*${d.titulo}*`);
  if (d.cliente) l.push(`Para: ${d.cliente}`);
  l.push("");
  l.push(`*Crédito:* ${moedaExata(d.credito)}`);
  l.push(`Bem: ${seg}  |  Administradora: ${d.administradora}`);
  l.push(`Prazo: ${d.prazoMeses} meses`);
  l.push(`Taxa adm. + fundo de reserva: ${pct(d.taxaAdm + d.fundoReserva, 1)}`);
  l.push("");
  l.push(`*Parcela: ${moedaExata(r.parcela)}*`);

  if (r.temLance) {
    l.push("");
    l.push("*Lance*");
    if (d.lanceProprio > 0) l.push(`• Lance em dinheiro: ${moedaExata(d.lanceProprio)}`);
    if (r.lanceEmbutido > 0) {
      l.push(`• Lance embutido: ${moedaExata(r.lanceEmbutido)}`);
      l.push(`• Crédito liberado: ${moedaExata(r.creditoLiquido)}`);
    }
    l.push(`• Contemplação prevista: ${r.mesesAntes === 0 ? "no ato" : `${r.mesesAntes}ª parcela`}`);
    l.push(
      `• Depois do lance: ${r.lanceQuita ? "plano quitado" : `${r.novoPrazo} x ${moedaExata(r.novaParcela)}`}`,
    );
  }

  l.push("");
  l.push("*Custo efetivo*");
  l.push(`• Total desembolsado: ${moedaExata(r.desembolso)}`);
  l.push(`• Custo do crédito: ${moedaExata(r.custoTotal)} (${pct(r.custoMensalPct, 2)} ao mês)`);

  if (d.comparativo) {
    l.push("");
    l.push(`*No financiamento a ${pct(d.comparativo.jurosMes, 2)} a.m.*`);
    l.push(`• Parcela: ${moedaExata(d.comparativo.parcela)}`);
    l.push(`• Total pago: ${moedaExata(d.comparativo.total)}`);
    l.push(
      `• Diferença a favor do consórcio: ${moedaExata(Math.max(0, d.comparativo.total - r.desembolso))}`,
    );
  }

  l.push("");
  l.push(`${d.vendedorNome} — ${d.vendedorCargo}`);
  if (d.vendedorTelefone) l.push(d.vendedorTelefone);
  if (d.vendedorEmail) l.push(d.vendedorEmail);
  l.push("");
  l.push(
    "Simulação sem caráter de proposta definitiva. Valores da tabela vigente, sujeitos a reajuste do bem. Contemplação por sorteio ou lance.",
  );

  return l.join("\n");
}
