import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Contato, Etapa, Interacao, Origem, Usuario } from "@/lib/types";
import { msgErro } from "@/lib/utils";

export function useEtapas() {
  return useQuery({
    queryKey: ["etapas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etapas")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data as Etapa[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useOrigens() {
  return useQuery({
    queryKey: ["origens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("origens")
        .select("*")
        .eq("ativa", true)
        .order("nome");
      if (error) throw error;
      return data as Origem[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useUsuarios() {
  return useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*, papel:papeis(*)")
        .order("nome");
      if (error) throw error;
      return data as Usuario[];
    },
    staleTime: 60_000,
  });
}

export function useContatos() {
  return useQuery({
    queryKey: ["contatos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contatos")
        .select("*")
        .eq("arquivado", false)
        .order("ordem")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data as Contato[];
    },
  });
}

export function useInteracoes(contatoId?: string) {
  return useQuery({
    queryKey: ["interacoes", contatoId],
    enabled: !!contatoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interacoes")
        .select("*")
        .eq("contato_id", contatoId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return data as Interacao[];
    },
  });
}

/**
 * Todas as interações da org, para o painel.
 *
 * Query separada da `useInteracoes` (que é por contato) porque o painel precisa
 * cruzar o histórico inteiro. O limite alto é proposital: com o volume da M&A
 * cabe tudo numa ida só, e paginar aqui atrapalharia a conta de conversão.
 */
export function useTodasInteracoes() {
  return useQuery({
    queryKey: ["interacoes-todas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interacoes")
        .select("*")
        .order("data", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data as Interacao[];
    },
    staleTime: 60_000,
  });
}

export function useSalvarContato() {
  const qc = useQueryClient();
  const { usuario } = useAuth();

  return useMutation({
    mutationFn: async (c: Partial<Contato> & { id?: string }) => {
      if (c.id) {
        const { id, ...resto } = c;
        const { error } = await supabase.from("contatos").update(resto).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("contatos")
        .insert({
          ...c,
          org_id: usuario!.org_id,
          criado_por: usuario!.id,
          responsavel_id: c.responsavel_id ?? usuario!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["contatos"] });
      toast.success(v.id ? "Contato atualizado." : "Contato criado.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

export function useMoverEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, etapaId }: { id: string; etapaId: string }) => {
      const { error } = await supabase
        .from("contatos")
        .update({ etapa_id: etapaId })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, etapaId }) => {
      await qc.cancelQueries({ queryKey: ["contatos"] });
      const antes = qc.getQueryData<Contato[]>(["contatos"]);
      qc.setQueryData<Contato[]>(["contatos"], (old) =>
        old?.map((c) => (c.id === id ? { ...c, etapa_id: etapaId } : c)),
      );
      return { antes };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(["contatos"], ctx.antes);
      toast.error(msgErro(e));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["contatos"] });
      // O trigger do banco grava a movimentação; o painel precisa relê-la.
      void qc.invalidateQueries({ queryKey: ["interacoes-todas"] });
    },
  });
}

/** Agenda (ou conclui, mandando null) a próxima atividade do contato. */
export function useAgendarAtividade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      id: string;
      proxima_acao: string | null;
      proxima_acao_em: string | null;
      proxima_acao_tipo: Contato["proxima_acao_tipo"];
    }) => {
      const { id, ...campos } = a;
      const { error } = await supabase.from("contatos").update(campos).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...campos }) => {
      await qc.cancelQueries({ queryKey: ["contatos"] });
      const antes = qc.getQueryData<Contato[]>(["contatos"]);
      qc.setQueryData<Contato[]>(["contatos"], (old) =>
        old?.map((c) => (c.id === id ? { ...c, ...campos } : c)),
      );
      return { antes };
    },
    onSuccess: (_d, v) => {
      toast.success(v.proxima_acao_em || v.proxima_acao ? "Atividade agendada." : "Atividade concluída.");
    },
    onError: (e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(["contatos"], ctx.antes);
      toast.error(msgErro(e));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["contatos"] }),
  });
}

export function useExcluirContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contatos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["contatos"] });
      toast.success("Contato excluído.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

export function useRegistrarInteracao() {
  const qc = useQueryClient();
  const { usuario } = useAuth();

  return useMutation({
    mutationFn: async (i: {
      contato_id: string;
      tipo: Interacao["tipo"];
      resumo: string;
      proxima_acao?: string | null;
      proxima_acao_em?: string | null;
    }) => {
      const { proxima_acao, proxima_acao_em, ...interacao } = i;
      const { error } = await supabase.from("interacoes").insert({
        ...interacao,
        org_id: usuario!.org_id,
        usuario_id: usuario!.id,
      });
      if (error) throw error;

      if (proxima_acao !== undefined || proxima_acao_em !== undefined) {
        const { error: e2 } = await supabase
          .from("contatos")
          .update({ proxima_acao, proxima_acao_em })
          .eq("id", i.contato_id);
        if (e2) throw e2;
      }
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["interacoes", v.contato_id] });
      void qc.invalidateQueries({ queryKey: ["interacoes-todas"] });
      void qc.invalidateQueries({ queryKey: ["contatos"] });
      toast.success("Interação registrada.");
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}

/**
 * Importação em lote de contatos da planilha. Um insert só: ou entra a planilha
 * inteira, ou não entra nada — meia importação é pior que nenhuma, porque aí não
 * se sabe mais de onde continuar.
 */
export function useImportarContatos() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (contatos: Partial<Contato>[]) => {
      const { error } = await supabase.from("contatos").insert(
        contatos.map((c) => ({
          ...c,
          org_id: usuario!.org_id,
          criado_por: usuario!.id,
          responsavel_id: c.responsavel_id ?? usuario!.id,
        })),
      );
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["contatos"] });
      toast.success(`${v.length} contato(s) importado(s).`);
    },
    onError: (e) => toast.error(msgErro(e)),
  });
}
