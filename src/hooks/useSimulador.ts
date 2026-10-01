import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Cota, Simulacao, TabelaConsorcio } from "@/lib/types";
import { msgErro } from "@/lib/utils";

/* ------------------------- Tabelas das administradoras -------------------- */

export function useTabelas() {
  return useQuery({
    queryKey: ["tabelas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_consorcio")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data as TabelaConsorcio[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useSalvarTabela() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (t: Partial<TabelaConsorcio> & { id?: string }) => {
      if (t.id) {
        const { id, ...resto } = t;
        const { error } = await supabase.from("tabelas_consorcio").update(resto).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("tabelas_consorcio")
        .insert({ ...t, org_id: usuario!.org_id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tabelas"] });
      toast.success("Tabela salva.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

export function useExcluirTabela() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tabelas_consorcio").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tabelas"] });
      toast.success("Tabela excluída.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

/* -------------------------------- Simulações ------------------------------ */

export function useSimulacoes(contatoId?: string) {
  return useQuery({
    queryKey: ["simulacoes", contatoId ?? "todas"],
    queryFn: async () => {
      let q = supabase.from("simulacoes").select("*").order("criado_em", { ascending: false });
      if (contatoId) q = q.eq("contato_id", contatoId);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data as Simulacao[];
    },
  });
}

export function useSalvarSimulacao() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (s: Partial<Simulacao>) => {
      const { data, error } = await supabase
        .from("simulacoes")
        .insert({ ...s, org_id: usuario!.org_id, usuario_id: usuario!.id })
        .select("*")
        .single();
      if (error) throw error;
      return data as Simulacao;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["simulacoes"] });
      toast.success("Simulação salva no histórico.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

export function useExcluirSimulacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("simulacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["simulacoes"] });
      toast.success("Simulação removida.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

/* --------------------------------- Carteira ------------------------------- */

export function useCotas() {
  return useQuery({
    queryKey: ["cotas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotas")
        .select("*")
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return data as Cota[];
    },
  });
}

export function useSalvarCota() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (c: Partial<Cota> & { id?: string }) => {
      if (c.id) {
        const { id, ...resto } = c;
        const { error } = await supabase.from("cotas").update(resto).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("cotas").insert({
        ...c,
        org_id: usuario!.org_id,
        criado_por: usuario!.id,
        vendedor_id: c.vendedor_id ?? usuario!.id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["cotas"] });
      toast.success(v.id ? "Cota atualizada." : "Cota lançada na carteira.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

/** Importação em lote da planilha. Um insert só: ou entra tudo, ou não entra nada. */
export function useImportarCotas() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (cotas: Partial<Cota>[]) => {
      const { error } = await supabase.from("cotas").insert(
        cotas.map((c) => ({
          ...c,
          org_id: usuario!.org_id,
          criado_por: usuario!.id,
          vendedor_id: c.vendedor_id ?? usuario!.id,
        })),
      );
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["cotas"] });
      toast.success(`${v.length} cota(s) importada(s).`);
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

/**
 * Edição em massa. Um update só com `in (ids)` em vez de um por cota: o banco
 * resolve de uma vez e não existe o estado meio-salvo de metade da seleção.
 */
export function useEditarCotasEmMassa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<Cota> }) => {
      const { error } = await supabase.from("cotas").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["cotas"] });
      toast.success(`${v.ids.length} cota(s) atualizada(s).`);
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

export function useExcluirCota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cotas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cotas"] });
      toast.success("Cota excluída.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}
