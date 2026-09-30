import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Convite, Etapa, Origem, Papel, Permissoes } from "@/lib/types";
import { msgErro } from "@/lib/utils";

/* ---------------------------------- Papéis -------------------------------- */

export function usePapeis() {
  return useQuery({
    queryKey: ["papeis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("papeis").select("*").order("nome");
      if (error) throw error;
      return data as Papel[];
    },
    staleTime: 60_000,
  });
}

export function useSalvarPapel() {
  const qc = useQueryClient();
  const { usuario, recarregarPerfil } = useAuth();

  return useMutation({
    mutationFn: async (p: {
      id?: string;
      nome: string;
      descricao?: string | null;
      permissoes: Permissoes;
    }) => {
      if (p.id) {
        const { id, ...resto } = p;
        const { error } = await supabase.from("papeis").update(resto).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("papeis")
        .insert({ ...p, org_id: usuario!.org_id });
      if (error) throw error;
    },
    onSuccess: async (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["papeis"] });
      void qc.invalidateQueries({ queryKey: ["usuarios"] });
      await recarregarPerfil();
      toast.success(v.id ? "Papel atualizado." : "Papel criado.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

export function useExcluirPapel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("papeis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["papeis"] });
      toast.success("Papel excluído.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

/* --------------------------------- Usuários ------------------------------- */

export function useSalvarUsuario() {
  const qc = useQueryClient();
  const { recarregarPerfil } = useAuth();

  return useMutation({
    mutationFn: async (u: {
      id: string;
      nome?: string;
      telefone?: string | null;
      papel_id?: string | null;
      ativo?: boolean;
    }) => {
      const { id, ...resto } = u;
      const { error } = await supabase.from("usuarios").update(resto).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      void qc.invalidateQueries({ queryKey: ["usuarios"] });
      await recarregarPerfil();
      toast.success("Usuário atualizado.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

/* --------------------------------- Convites ------------------------------- */

export function useConvites() {
  return useQuery({
    queryKey: ["convites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convites")
        .select("*")
        .is("aceito_em", null)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data as Convite[];
    },
  });
}

export function useCriarConvite() {
  const qc = useQueryClient();
  const { usuario } = useAuth();

  return useMutation({
    mutationFn: async (c: { email: string; nome?: string | null; papel_id: string | null }) => {
      const { data, error } = await supabase
        .from("convites")
        .insert({
          ...c,
          email: c.email.trim().toLowerCase(),
          org_id: usuario!.org_id,
          criado_por: usuario!.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as Convite;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["convites"] });
      toast.success("Convite criado. Envie o link para a pessoa.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

export function useCancelarConvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("convites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["convites"] });
      toast.success("Convite cancelado.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

/* ------------------------------ Etapas / Origens -------------------------- */

export function useSalvarEtapa() {
  const qc = useQueryClient();
  const { usuario } = useAuth();

  return useMutation({
    mutationFn: async (e: Partial<Etapa> & { id?: string }) => {
      if (e.id) {
        const { id, ...resto } = e;
        const { error } = await supabase.from("etapas").update(resto).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("etapas").insert({ ...e, org_id: usuario!.org_id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["etapas"] });
      toast.success("Etapa salva.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

export function useExcluirEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("etapas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["etapas"] });
      void qc.invalidateQueries({ queryKey: ["contatos"] });
      toast.success("Etapa excluída.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

export function useTodasOrigens() {
  return useQuery({
    queryKey: ["origens", "todas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("origens").select("*").order("nome");
      if (error) throw error;
      return data as Origem[];
    },
  });
}

export function useSalvarOrigem() {
  const qc = useQueryClient();
  const { usuario } = useAuth();

  return useMutation({
    mutationFn: async (o: Partial<Origem> & { id?: string }) => {
      if (o.id) {
        const { id, ...resto } = o;
        const { error } = await supabase.from("origens").update(resto).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("origens").insert({ ...o, org_id: usuario!.org_id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["origens"] });
      toast.success("Origem salva.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

export function useExcluirOrigem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("origens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["origens"] });
      toast.success("Origem excluída.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}
