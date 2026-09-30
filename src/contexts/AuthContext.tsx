import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Organizacao, Papel, Usuario } from "@/lib/types";

interface AuthCtx {
  session: Session | null;
  usuario: Usuario | null;
  papel: Papel | null;
  org: Organizacao | null;
  carregando: boolean;
  /** Dono da conta (admin.org) passa em qualquer verificação. */
  pode: (chave: string) => boolean;
  recarregarPerfil: () => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = React.createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [usuario, setUsuario] = React.useState<Usuario | null>(null);
  const [papel, setPapel] = React.useState<Papel | null>(null);
  const [org, setOrg] = React.useState<Organizacao | null>(null);
  const [carregando, setCarregando] = React.useState(true);

  const carregarPerfil = React.useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*, papel:papeis(*), org:organizacoes(*)")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      setUsuario(null);
      setPapel(null);
      setOrg(null);
      return;
    }
    const { papel: p, org: o, ...u } = data as Usuario & {
      papel: Papel | null;
      org: Organizacao | null;
    };
    setUsuario(u as Usuario);
    setPapel(p ?? null);
    setOrg(o ?? null);
  }, []);

  React.useEffect(() => {
    let vivo = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return;
      setSession(data.session);
      if (data.session?.user) await carregarPerfil(data.session.user.id);
      if (vivo) setCarregando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s);
      if (!s?.user) {
        setUsuario(null);
        setPapel(null);
        setOrg(null);
        return;
      }
      // Evita deadlock: o callback do Supabase não deve aguardar chamadas ao banco.
      setTimeout(() => {
        void carregarPerfil(s.user.id);
      }, 0);
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [carregarPerfil]);

  const pode = React.useCallback(
    (chave: string) => {
      const p = papel?.permissoes;
      if (!p) return false;
      return p["admin.org"] === true || p[chave] === true;
    },
    [papel],
  );

  const recarregarPerfil = React.useCallback(async () => {
    if (session?.user) await carregarPerfil(session.user.id);
  }, [session, carregarPerfil]);

  const sair = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const valor = React.useMemo(
    () => ({ session, usuario, papel, org, carregando, pode, recarregarPerfil, sair }),
    [session, usuario, papel, org, carregando, pode, recarregarPerfil, sair],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return c;
}
