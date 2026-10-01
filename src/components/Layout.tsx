import * as React from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  Calculator,
  ChartNoAxesColumn,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Carregando } from "@/components/ui";
import { cn, iniciais } from "@/lib/utils";

interface ItemMenu {
  para: string;
  rotulo: string;
  icone: React.ComponentType<{ className?: string }>;
  permissao?: string;
  emBreve?: boolean;
}

const MENU: ItemMenu[] = [
  { para: "/painel", rotulo: "Painel", icone: ChartNoAxesColumn, permissao: "crm.ver" },
  { para: "/crm", rotulo: "CRM", icone: LayoutGrid, permissao: "crm.ver" },
  { para: "/hoje", rotulo: "Meu dia", icone: ListChecks, permissao: "crm.ver" },
  { para: "/simulador", rotulo: "Simulador", icone: Calculator, permissao: "simulador.usar" },
  { para: "/carteira", rotulo: "Carteira", icone: Wallet, permissao: "carteira.ver" },
  { para: "/usuarios", rotulo: "Usuários e papéis", icone: Users, permissao: "admin.usuarios" },
  { para: "/config", rotulo: "Configurações", icone: Settings, permissao: "admin.config" },
];

function useTema() {
  const [escuro, setEscuro] = React.useState(
    () => localStorage.getItem("ma-tema") === "escuro",
  );
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", escuro);
    localStorage.setItem("ma-tema", escuro ? "escuro" : "claro");
  }, [escuro]);
  return { escuro, alternar: () => setEscuro((v) => !v) };
}

/** Menu recolhido. Só vale no desktop — no celular o menu é sempre completo. */
function useRecolhido() {
  const [guardado, setGuardado] = React.useState(
    () => localStorage.getItem("ma-menu") === "recolhido",
  );
  const [desktop, setDesktop] = React.useState(
    () => window.matchMedia("(min-width: 1024px)").matches,
  );

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    localStorage.setItem("ma-menu", guardado ? "recolhido" : "aberto");
  }, [guardado]);

  return { recolhido: guardado && desktop, alternar: () => setGuardado((v) => !v) };
}

/** Botão do rodapé do menu. Vira só ícone quando o menu está recolhido. */
function BotaoRodape({
  icone: Icone,
  rotulo,
  recolhido,
  onClick,
}: {
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  recolhido: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={rotulo}
      className={cn(
        "flex h-8 items-center justify-center gap-1.5 rounded-md text-[11px] text-ma-branco/55 transition-colors hover:bg-white/[0.07] hover:text-ma-branco",
        recolhido ? "w-8" : "flex-1",
      )}
    >
      <Icone className="h-3.5 w-3.5 shrink-0" />
      {!recolhido && rotulo}
    </button>
  );
}

export default function Layout() {
  const { session, usuario, papel, org, carregando, pode, sair } = useAuth();
  const { escuro, alternar } = useTema();
  const { recolhido, alternar: alternarMenu } = useRecolhido();
  const [abertoMobile, setAbertoMobile] = React.useState(false);
  const local = useLocation();

  React.useEffect(() => setAbertoMobile(false), [local.pathname]);

  if (carregando) return <Carregando texto="Entrando..." />;
  if (!session) return <Navigate to="/login" replace />;
  if (!usuario)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a nenhuma empresa.
        </p>
        <button onClick={sair} className="text-sm font-medium underline">
          Sair
        </button>
      </div>
    );

  const itens = MENU.filter((i) => !i.permissao || pode(i.permissao));

  return (
    <div className="min-h-screen bg-background">
      {/* overlay mobile */}
      {abertoMobile && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setAbertoMobile(false)}
        />
      )}

      {/* menu flutuante, sobreposto ao fundo */}
      <aside
        className={cn(
          "fixed z-40 flex flex-col bg-ma-grafite text-ma-branco",
          "inset-y-0 left-0 w-[248px] transition-transform duration-200",
          abertoMobile ? "translate-x-0" : "-translate-x-full",
          // desktop: descola das bordas e flutua
          "lg:inset-y-3 lg:left-3 lg:translate-x-0 lg:rounded-xl lg:shadow-pop lg:ring-1 lg:ring-white/[0.06]",
          "lg:transition-[width] lg:duration-200",
          recolhido ? "lg:w-[64px]" : "lg:w-[248px]",
        )}
      >
        <div
          className={cn(
            "flex gap-2 px-3 py-4",
            recolhido ? "lg:flex-col lg:items-center lg:gap-3 lg:px-2" : "items-center",
          )}
        >
          {recolhido ? (
            <span className="font-display text-lg font-semibold leading-none text-ma-amarelo">
              M<span className="text-ma-branco">A</span>
            </span>
          ) : (
            <div className="min-w-0 flex-1 pl-2">
              <p className="font-display text-base font-semibold leading-tight text-ma-branco">
                Martinelle <span className="text-ma-amarelo">&</span> Avelar
              </p>
              <p className="mt-0.5 truncate text-[11px] text-ma-branco/40">{org?.nome}</p>
            </div>
          )}

          {/* recolher — só no desktop */}
          <button
            onClick={alternarMenu}
            title={recolhido ? "Expandir menu" : "Recolher menu"}
            aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-ma-branco/50 transition-colors hover:bg-white/[0.07] hover:text-ma-branco lg:flex"
          >
            {recolhido ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>

          {/* fechar — só no mobile */}
          <button
            onClick={() => setAbertoMobile(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ma-branco/60 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className={cn("flex-1 space-y-0.5 overflow-y-auto px-3 py-2", recolhido && "lg:px-2")}>
          {itens.map((i) => (
            <NavLink
              key={i.para}
              to={i.para}
              title={recolhido ? i.rotulo : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  recolhido && "lg:justify-center lg:px-0",
                  isActive
                    ? "bg-ma-amarelo font-medium text-ma-grafite"
                    : "text-ma-branco/65 hover:bg-white/[0.07] hover:text-ma-branco",
                )
              }
            >
              <i.icone className="h-4 w-4 shrink-0" />
              {!recolhido && (
                <>
                  <span className="flex-1 truncate">{i.rotulo}</span>
                  {i.emBreve && (
                    <span className="rounded bg-white/10 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-ma-branco/50">
                      breve
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={cn("border-t border-white/[0.07] p-3", recolhido && "lg:px-2")}>
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-2",
              recolhido && "lg:justify-center lg:px-0",
            )}
            title={recolhido ? `${usuario.nome} — ${papel?.nome ?? "Sem papel"}` : undefined}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ma-amarelo text-[11px] font-semibold text-ma-grafite">
              {iniciais(usuario.nome)}
            </div>
            {!recolhido && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ma-branco">{usuario.nome}</p>
                <p className="truncate text-[11px] text-ma-branco/40">{papel?.nome ?? "Sem papel"}</p>
              </div>
            )}
          </div>
          <div className={cn("mt-1 flex gap-1", recolhido && "lg:flex-col lg:items-center")}>
            <BotaoRodape
              icone={escuro ? Sun : Moon}
              rotulo={escuro ? "Claro" : "Escuro"}
              recolhido={recolhido}
              onClick={alternar}
            />
            <BotaoRodape icone={LogOut} rotulo="Sair" recolhido={recolhido} onClick={sair} />
          </div>
        </div>
      </aside>

      {/* conteúdo — abre espaço para o menu flutuante */}
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-200",
          recolhido ? "lg:pl-[88px]" : "lg:pl-[272px]",
        )}
      >
        <button
          onClick={() => setAbertoMobile(true)}
          className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm lg:hidden"
        >
          <Menu className="h-5 w-5" />
          Menu
        </button>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Bloqueia a rota se faltar a permissão. */
export function Protegido({
  permissao,
  children,
}: {
  permissao: string;
  children: React.ReactNode;
}) {
  const { pode, carregando } = useAuth();
  if (carregando) return <Carregando />;
  if (!pode(permissao))
    return (
      <div className="p-8">
        <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm font-medium">Você não tem acesso a esta área.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Peça a um administrador para liberar a permissão necessária no seu papel.
          </p>
        </div>
      </div>
    );
  return <>{children}</>;
}
