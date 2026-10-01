/**
 * Gráficos do painel.
 *
 * Feitos à mão com div e SVG em vez de uma biblioteca: são quatro formatos
 * simples, e qualquer lib de gráfico traria 100 kB+ e um tema próprio para
 * brigar com o nosso. Aqui a cor e o espaçamento saem do mesmo design do resto
 * do sistema.
 */

import { cn } from "@/lib/utils";

/* ------------------------------ Barras deitadas --------------------------- */

export function BarrasHorizontais({
  itens,
  formatar,
  vazio = "Sem dados no período.",
}: {
  itens: { rotulo: string; valor: number; cor?: string; nota?: string }[];
  formatar: (v: number) => string;
  vazio?: string;
}) {
  const max = Math.max(...itens.map((i) => i.valor), 0);
  if (!itens.length || max === 0)
    return <p className="py-6 text-center text-xs text-muted-foreground">{vazio}</p>;

  return (
    <div className="flex flex-col gap-2.5">
      {itens.map((i) => (
        <div key={i.rotulo}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-xs text-foreground">{i.rotulo}</span>
            <span className="shrink-0 font-num text-xs text-muted-foreground">
              {formatar(i.valor)}
              {i.nota && <span className="ml-1.5 text-muted-foreground/70">{i.nota}</span>}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${(i.valor / max) * 100}%`,
                backgroundColor: i.cor ?? "hsl(var(--primary))",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- Funil ---------------------------------- */

/**
 * Funil em degraus. A largura segue o maior volume, não a ordem das etapas:
 * se "Negociando" tem mais gente que "Novo lead", o desenho mostra isso em vez
 * de forçar o formato de funil e mentir sobre a base.
 */
export function Funil({
  etapas,
  formatar,
}: {
  etapas: { rotulo: string; valor: number; cor: string; valorSecundario?: number }[];
  formatar: (v: number) => string;
}) {
  const max = Math.max(...etapas.map((e) => e.valor), 1);
  const total = etapas.reduce((s, e) => s + e.valor, 0);

  if (total === 0)
    return <p className="py-6 text-center text-xs text-muted-foreground">Funil vazio.</p>;

  return (
    <div className="flex flex-col gap-1.5">
      {etapas.map((e) => (
        <div key={e.rotulo} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{e.rotulo}</span>
          <div className="flex h-7 min-w-0 flex-1 items-center">
            <div
              className="flex h-full min-w-[34px] items-center justify-end rounded px-2 transition-[width] duration-500"
              style={{
                width: `${Math.max((e.valor / max) * 100, 4)}%`,
                backgroundColor: `${e.cor}26`,
                borderLeft: `3px solid ${e.cor}`,
              }}
            >
              {/* Número em cor de texto, não na cor da etapa: "Fechar" é
                  #000F30 e sumiria contra o fundo do tema escuro. A cor da
                  etapa fica na borda, onde continua legível nos dois temas. */}
              <span className="font-num text-xs font-semibold text-foreground">{e.valor}</span>
            </div>
          </div>
          <span className="w-24 shrink-0 text-right font-num text-[11px] text-muted-foreground">
            {e.valorSecundario ? formatar(e.valorSecundario) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Série temporal ---------------------------- */

/** Barras verticais. Usada na atividade diária e na evolução mensal. */
export function Colunas({
  itens,
  formatar,
  altura = 120,
}: {
  itens: { rotulo: string; valor: number; detalhe?: string }[];
  formatar: (v: number) => string;
  altura?: number;
}) {
  const max = Math.max(...itens.map((i) => i.valor), 0);
  if (!itens.length)
    return <p className="py-6 text-center text-xs text-muted-foreground">Sem dados.</p>;

  // Com muitas colunas o rótulo vira borrão: mostra um a cada N.
  const passo = Math.ceil(itens.length / 12);

  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height: altura }}>
        {itens.map((i, idx) => (
          <div
            key={`${i.rotulo}-${idx}`}
            className="group relative flex h-full flex-1 items-end"
            title={`${i.rotulo}: ${formatar(i.valor)}${i.detalhe ? ` · ${i.detalhe}` : ""}`}
          >
            <div
              className={cn(
                "w-full rounded-sm transition-colors",
                i.valor > 0 ? "bg-primary/70 group-hover:bg-primary" : "bg-muted",
              )}
              style={{
                height: max > 0 ? `${Math.max((i.valor / max) * 100, i.valor > 0 ? 3 : 1.5)}%` : "1.5%",
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {itens.map((i, idx) => (
          <span
            key={`r-${i.rotulo}-${idx}`}
            className="flex-1 overflow-hidden text-center text-[9px] leading-tight text-muted-foreground"
          >
            {idx % passo === 0 ? i.rotulo : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- Rosca ---------------------------------- */

/** Anel de composição. Bom para 2 a 5 fatias; acima disso vira confete. */
export function Rosca({
  fatias,
  centro,
  rotuloCentro,
  tamanho = 128,
}: {
  fatias: { rotulo: string; valor: number; cor: string }[];
  centro: string;
  rotuloCentro: string;
  tamanho?: number;
}) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const raio = 54;
  const circunferencia = 2 * Math.PI * raio;

  let acumulado = 0;
  const arcos = fatias
    .filter((f) => f.valor > 0)
    .map((f) => {
      const fracao = total ? f.valor / total : 0;
      const arco = {
        ...f,
        dash: `${fracao * circunferencia} ${circunferencia}`,
        offset: -acumulado * circunferencia,
      };
      acumulado += fracao;
      return arco;
    });

  return (
    <div className="flex items-center gap-4">
      <svg width={tamanho} height={tamanho} viewBox="0 0 128 128" className="shrink-0 -rotate-90">
        <circle cx="64" cy="64" r={raio} fill="none" strokeWidth="14" className="stroke-muted" />
        {arcos.map((a) => (
          <circle
            key={a.rotulo}
            cx="64"
            cy="64"
            r={raio}
            fill="none"
            strokeWidth="14"
            stroke={a.cor}
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
          />
        ))}
        <text
          x="64"
          y="60"
          textAnchor="middle"
          className="rotate-90 fill-foreground font-num text-[20px] font-semibold"
          style={{ transformOrigin: "64px 64px" }}
        >
          {centro}
        </text>
        <text
          x="64"
          y="78"
          textAnchor="middle"
          className="rotate-90 fill-muted-foreground text-[10px]"
          style={{ transformOrigin: "64px 64px" }}
        >
          {rotuloCentro}
        </text>
      </svg>

      <ul className="flex min-w-0 flex-col gap-1.5">
        {fatias.map((f) => (
          <li key={f.rotulo} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: f.cor }} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{f.rotulo}</span>
            <span className="shrink-0 font-num font-medium text-foreground">{f.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
