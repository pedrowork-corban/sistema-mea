import * as React from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Botao, Campo, Cartao, Input } from "@/components/ui";
import { msgErro } from "@/lib/utils";

export default function Login() {
  const { session, carregando } = useAuth();
  const [modo, setModo] = React.useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [organizacao, setOrganizacao] = React.useState("Martinelle & Avelar");
  const [enviando, setEnviando] = React.useState(false);

  if (carregando) return null;
  if (session) return <Navigate to="/crm" replace />;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome, organizacao } },
        });
        if (error) throw error;
        toast.success("Conta criada. Bem-vindo!");
      }
    } catch (err) {
      toast.error(msgErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ma-azul p-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="font-display text-2xl font-semibold text-ma-branco">
            Martinelle <span className="text-ma-amarelo">&</span> Avelar
          </h1>
          <p className="mt-1 text-xs text-ma-branco/50">Sistema de gestão comercial</p>
        </div>

        <Cartao className="p-6">
          <form onSubmit={enviar} className="flex flex-col gap-4">
            {modo === "criar" && (
              <>
                <Campo label="Seu nome">
                  <Input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Pedro Vieira"
                    required
                    autoComplete="name"
                  />
                </Campo>
                <Campo label="Nome da empresa" hint="Você será o dono desta conta.">
                  <Input
                    value={organizacao}
                    onChange={(e) => setOrganizacao(e.target.value)}
                    required
                  />
                </Campo>
              </>
            )}

            <Campo label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
                required
                autoComplete="email"
              />
            </Campo>

            <Campo label="Senha" hint={modo === "criar" ? "Mínimo de 6 caracteres." : undefined}>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={6}
                autoComplete={modo === "criar" ? "new-password" : "current-password"}
              />
            </Campo>

            <Botao type="submit" carregando={enviando} className="mt-1 w-full">
              {modo === "entrar" ? "Entrar" : "Criar conta"}
            </Botao>
          </form>

          <button
            type="button"
            onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
            className="mt-4 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {modo === "entrar"
              ? "Não tem conta? Criar uma agora"
              : "Já tem conta? Entrar"}
          </button>
        </Cartao>
      </div>
    </div>
  );
}
