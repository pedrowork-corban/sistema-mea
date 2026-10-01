import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------- documentos e endereço -------------------------- */

const digitos = (v: string) => v.replace(/\D/g, "");

/** Formata enquanto digita: 000.000.000-00. Corta o que passar de 11 dígitos. */
export function mascaraCpf(v: string): string {
  const d = digitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** Formata enquanto digita: 00.000.000/0000-00. */
export function mascaraCnpj(v: string): string {
  const d = digitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Formata enquanto digita: 00000-000. */
export function mascaraCep(v: string): string {
  const d = digitos(v).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

/**
 * Valida CPF pelos dois dígitos verificadores.
 * Pega erro de digitação antes de ir pra administradora, que recusa o cadastro.
 */
export function cpfValido(v: string): boolean {
  const d = digitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Valida CNPJ pelos dois dígitos verificadores. */
export function cnpjValido(v: string): boolean {
  const d = digitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (ate: number) => {
    let peso = ate - 7;
    let soma = 0;
    for (let i = 0; i < ate; i++) {
      soma += Number(d[i]) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

export function formatarData(iso?: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function formatarDataHora(iso?: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function diasDesde(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const h = new Date(`${hoje()}T00:00:00`);
  return Math.round((h.getTime() - d.getTime()) / 86_400_000);
}

/** negativo = atrasado, 0 = hoje, positivo = futuro */
export function diasAte(iso?: string | null): number | null {
  const d = diasDesde(iso);
  return d === null ? null : -d;
}

export function moeda(v?: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/** Moeda com centavos — usada na proposta, onde o valor exato importa. */
export function moedaExata(v?: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(v?: number | null, casas = 2): string {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Só dígitos, com DDI 55. Retorna null se o número for curto demais. */
export function linkWhatsapp(telefone?: string | null): string | null {
  if (!telefone) return null;
  const d = telefone.replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
}

export function iniciais(nome?: string | null): string {
  if (!nome) return "?";
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1][0] ?? "") : "")).toUpperCase();
}

/** Mensagem de erro legível a partir de um erro do Supabase. */
export function msgErro(e: unknown): string {
  if (!e) return "Erro desconhecido.";
  const m = (e as { message?: string }).message ?? String(e);
  if (m.includes("duplicate key")) return "Esse registro já existe.";
  if (m.includes("row-level security") || m.includes("violates row-level"))
    return "Você não tem permissão para fazer isso.";
  if (m.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("User already registered")) return "Esse e-mail já tem cadastro.";
  if (m.includes("is invalid") && m.includes("Email")) return "E-mail inválido. Use um endereço real.";
  if (m.includes("Email not confirmed")) return "Confirme o e-mail antes de entrar.";
  if (m.includes("Password should be")) return "A senha precisa ter pelo menos 6 caracteres.";
  return m;
}
