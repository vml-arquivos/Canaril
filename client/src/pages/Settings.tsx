/**
 * Settings.tsx — Redireciona para /meu-site
 *
 * Esta página antiga lia/gravava em `breeder_settings`, uma tabela de UMA
 * linha só (id fixo = 1), sem coluna de tenant — ou seja, TODO usuário que
 * abrisse "Configurações", de qualquer canaril, via sempre os mesmos dados
 * (os do tenant "Canário Lima"). Isso era o vazamento reportado: um usuário
 * de outro canaril via nome/cidade/e-mail/telefone do Canário Lima aqui.
 *
 * A correção não foi "consertar" a tabela global — foi eliminar a
 * duplicidade: `/meu-site` (server/routers/publicSite.ts, `mySite` /
 * `updateMySite`) já é a versão correta, por-tenant, testada, construída
 * numa sessão anterior. Basta redirecionar para lá em vez de manter dois
 * sistemas de configuração divergentes.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader2 } from "lucide-react";

export default function Settings() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/meu-site", { replace: true });
  }, [navigate]);

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-gray-400 p-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Redirecionando para Meu Site...
      </div>
    </DashboardLayout>
  );
}
