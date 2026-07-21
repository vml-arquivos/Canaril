/**
 * Equipe.tsx — Gestão de equipe do próprio canaril (self-service)
 * Só visível/funcional para o responsável (CANARIL_MANAGER). Permite
 * convidar novos usuários (membro/visualizador) sem depender de um
 * administrador da plataforma para cada conta.
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABEL: Record<string, string> = {
  CANARIL_MANAGER: "Responsável",
  CANARIL_MEMBER: "Membro (acesso operacional)",
  VIEWER: "Visualizador (somente leitura)",
};

const emptyInvite = { name: "", email: "", password: "", role: "CANARIL_MEMBER" as "CANARIL_MEMBER" | "VIEWER" };

export default function Equipe() {
  const { data: team, isLoading, refetch, error } = trpc.team.myTeam.useQuery();
  const [invite, setInvite] = useState(emptyInvite);
  const [showInvite, setShowInvite] = useState(false);

  const inviteMutation = trpc.team.inviteMember.useMutation({
    onSuccess: () => { toast.success("Membro convidado! Repasse o e-mail e a senha combinados."); refetch(); setInvite(emptyInvite); setShowInvite(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.team.updateMember.useMutation({
    onSuccess: () => { toast.success("Atualizado."); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const removeMutation = trpc.team.removeMember.useMutation({
    onSuccess: () => { toast.success("Membro removido."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Minha Equipe</h1>
            <p className="text-sm text-gray-500">Convide pessoas para ajudar a gerenciar o canaril, com acesso limitado ao seu próprio criadouro.</p>
          </div>
        </div>

        {error && (
          <Card><CardContent className="pt-6 text-gray-600 text-sm">{error.message}</CardContent></Card>
        )}

        {!error && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Membros</CardTitle>
              <CardDescription>Apenas o responsável do canaril pode convidar ou remover membros.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <p className="text-sm text-gray-400">Carregando...</p>}
              {(team ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 border rounded-md p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{m.name} <span className="text-xs text-gray-400">— {m.email}</span></p>
                    <p className="text-xs text-gray-500">{ROLE_LABEL[m.role] ?? m.role}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Switch checked={m.isActive} onCheckedChange={(v) => updateMutation.mutate({ id: m.id, isActive: v })} />
                      <span className="text-xs text-gray-500">{m.isActive ? "Ativo" : "Suspenso"}</span>
                    </div>
                    <Button type="button" size="icon" variant="ghost" onClick={() => { if (confirm(`Remover ${m.name}?`)) removeMutation.mutate({ id: m.id }); }}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
              {(team ?? []).length === 0 && !isLoading && <p className="text-sm text-gray-400">Você ainda não tem outros membros na equipe.</p>}

              {showInvite ? (
                <div className="space-y-3 border-t pt-4">
                  <Input placeholder="Nome" value={invite.name} onChange={(e) => setInvite((f) => ({ ...f, name: e.target.value }))} />
                  <Input type="email" placeholder="E-mail" value={invite.email} onChange={(e) => setInvite((f) => ({ ...f, email: e.target.value }))} />
                  <Input type="password" placeholder="Senha inicial (mín. 6 caracteres)" value={invite.password} onChange={(e) => setInvite((f) => ({ ...f, password: e.target.value }))} />
                  <div>
                    <Label>Nível de acesso</Label>
                    <Select value={invite.role} onValueChange={(v: any) => setInvite((f) => ({ ...f, role: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CANARIL_MEMBER">Membro (acesso operacional)</SelectItem>
                        <SelectItem value="VIEWER">Visualizador (somente leitura)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => inviteMutation.mutate(invite)}
                      disabled={!invite.name || !invite.email || invite.password.length < 6 || inviteMutation.isPending}
                    >
                      {inviteMutation.isPending ? "Convidando..." : "Convidar"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => { setInvite(emptyInvite); setShowInvite(false); }}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" onClick={() => setShowInvite(true)}>
                  <UserPlus className="w-4 h-4 mr-2" /> Convidar novo membro
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
