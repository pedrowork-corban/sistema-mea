import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/* ---------------------------------- Botão --------------------------------- */
type BotaoVariante = "primario" | "secundario" | "fantasma" | "perigo" | "contorno";
type BotaoTamanho = "sm" | "md" | "lg" | "icone";

const VARIANTES: Record<BotaoVariante, string> = {
  primario: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  secundario: "bg-accent text-accent-foreground hover:bg-accent/80 shadow-sm",
  contorno: "border border-border bg-card hover:bg-muted text-foreground",
  fantasma: "hover:bg-muted text-foreground",
  perigo: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};
const TAMANHOS: Record<BotaoTamanho, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-sm gap-2",
  icone: "h-9 w-9",
};

export interface BotaoProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: BotaoVariante;
  tamanho?: BotaoTamanho;
  carregando?: boolean;
}

export const Botao = React.forwardRef<HTMLButtonElement, BotaoProps>(
  ({ className, variante = "primario", tamanho = "md", carregando, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || carregando}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className,
      )}
      {...props}
    >
      {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Botao.displayName = "Botao";

/* ---------------------------------- Campos -------------------------------- */
const baseCampo =
  "flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors " +
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseCampo, "h-9", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(baseCampo, "min-h-[76px] resize-y", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(baseCampo, "h-9 cursor-pointer pr-8", className)} {...props} />
));
Select.displayName = "Select";

export function Campo({
  label,
  hint,
  erro,
  children,
  className,
}: {
  label: string;
  hint?: string;
  erro?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
      {hint && !erro && <span className="text-xs text-muted-foreground">{hint}</span>}
      {erro && <span className="text-xs font-medium text-destructive">{erro}</span>}
    </label>
  );
}

/* ---------------------------------- Cartão -------------------------------- */
export function Cartao({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card shadow-card", className)}
      {...props}
    />
  );
}

/* ---------------------------------- Selo ---------------------------------- */
export function Selo({
  className,
  cor,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { cor?: string }) {
  return (
    <span
      style={cor ? { backgroundColor: `${cor}1A`, color: cor, borderColor: `${cor}40` } : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium leading-tight",
        !cor && "bg-muted text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/* --------------------------------- Switch --------------------------------- */
export function Switch({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

/* --------------------------------- Modal ---------------------------------- */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  largura = "max-w-lg",
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  largura?: string;
}) {
  React.useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="fixed inset-0" onClick={aoFechar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 my-8 w-full animate-fade-in rounded-lg border border-border bg-card shadow-pop",
          largura,
        )}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-foreground">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>}
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Estados -------------------------------- */
export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {texto}
    </div>
  );
}

export function Vazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
}: {
  icone?: React.ComponentType<{ className?: string }>;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center">
      {Icone && <Icone className="mb-3 h-8 w-8 text-muted-foreground/60" />}
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
