import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout, { Protegido } from "@/components/Layout";
import Login from "@/pages/Login";
import Crm from "@/pages/Crm";
import Hoje from "@/pages/Hoje";
import Usuarios from "@/pages/Usuarios";
import Config from "@/pages/Config";
import Simulador from "@/pages/Simulador";
import Carteira from "@/pages/Carteira";

const qc = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/crm" replace />} />
              <Route
                path="/crm"
                element={
                  <Protegido permissao="crm.ver">
                    <Crm />
                  </Protegido>
                }
              />
              <Route
                path="/hoje"
                element={
                  <Protegido permissao="crm.ver">
                    <Hoje />
                  </Protegido>
                }
              />
              <Route
                path="/simulador"
                element={
                  <Protegido permissao="simulador.usar">
                    <Simulador />
                  </Protegido>
                }
              />
              <Route
                path="/carteira"
                element={
                  <Protegido permissao="carteira.ver">
                    <Carteira />
                  </Protegido>
                }
              />
              <Route
                path="/usuarios"
                element={
                  <Protegido permissao="admin.usuarios">
                    <Usuarios />
                  </Protegido>
                }
              />
              <Route
                path="/config"
                element={
                  <Protegido permissao="admin.config">
                    <Config />
                  </Protegido>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/crm" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
