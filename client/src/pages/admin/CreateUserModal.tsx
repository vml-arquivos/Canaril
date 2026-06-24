/**
 * CreateUserModal.tsx — Modal para criação de novos usuários
 *
 * Este componente implementa o formulário para criação de um usuário no módulo
 * administrativo. Ele segue as regras de RBAC definidas pela plataforma:
 *   - Somente administradores da plataforma (PLATFORM_ADMIN) podem criar
 *     novos usuários.
 *   - Usuários comuns (CANARIL_MANAGER, CANARIL_MEMBER, VIEWER) nunca veem
 *     esta modal ou o botão de criação.
 *   - Quando o papel selecionado não for PLATFORM_ADMIN, o campo de Canaril
 *     (tenant) torna-se obrigatório.
 *   - É possível definir se o usuário estará ativo, se precisa trocar a
 *     senha no primeiro acesso, uma expiração opcional e uma observação
 *     interna. Estas opções são opcionais para simplificar a experiência.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export type CreateUserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CreateUserModal({ open, onOpenChange }: CreateUserModalProps) {
  const { user } = useAuth();
  const isPlatformAdmin = (user as any)?.role === "PLATFORM_ADMIN";

  // Carrega a lista de canarils/tenants para o select
  const { data: tenants } = trpc.admin.getTenants.useQuery(undefined, {
    enabled: isPlatformAdmin,
  });

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: (data) => {
      toast.success("Usuário criado com sucesso.");
      // Fecha a modal após sucesso
      onOpenChange(false);
    },
    onError: (e) => {
      toast.error(e.message || "Erro ao criar usuário.");
    },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<string>("CANARIL_MANAGER");
  const [tenantId, setTenantId] = useState<string | undefined>(undefined);
  const [isActive, setIsActive] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | undefined>(undefined);
  const [internalNote, setInternalNote] = useState<string | undefined>(undefined);

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRole("CANARIL_MANAGER");
    setTenantId(undefined);
    setIsActive(true);
    setMustChangePassword(true);
    setExpiresAt(undefined);
    setInternalNote(undefined);
  }

  const handleSubmit = () => {
    // Validações básicas
    if (!name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    if (!email.trim()) {
      toast.error("E-mail é obrigatório.");
      return;
    }
    if (!password) {
      toast.error("Senha temporária é obrigatória.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Confirmação de senha não confere.");
      return;
    }
    if (role !== "PLATFORM_ADMIN" && !tenantId) {
      toast.error("Selecione um canaril.");
      return;
    }
    // Constrói input para a mutation
    createUser.mutate({
      name,
      email,
      password,
      role: role as any,
      tenantId: role === "PLATFORM_ADMIN" ? undefined : tenantId ? Number(tenantId) : undefined,
      isActive,
      mustChangePassword,
      accessExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      internalNote: internalNote || undefined,
    } as any);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (!v) resetForm();
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar novo usuário</DialogTitle>
          <DialogDescription>Preencha os campos para cadastrar um novo usuário.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="password">Senha temporária</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="role">Papel</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {/* Não exibe PLATFORM_ADMIN para usuários não admin (defesa adicional) */}
                {isPlatformAdmin && (
                  <SelectItem value="PLATFORM_ADMIN">Administrador da Plataforma</SelectItem>
                )}
                <SelectItem value="CANARIL_MANAGER">Gestor do Canaril</SelectItem>
                <SelectItem value="CANARIL_MEMBER">Membro do Canaril</SelectItem>
                <SelectItem value="VIEWER">Somente Leitura</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role !== "PLATFORM_ADMIN" && (
            <div className="grid gap-1">
              <Label htmlFor="tenant">Canaril</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {tenants?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <Checkbox id="active" checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} />
            <Label htmlFor="active">Usuário ativo</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="mustChange" checked={mustChangePassword} onCheckedChange={(v) => setMustChangePassword(Boolean(v))} />
            <Label htmlFor="mustChange">Exigir troca de senha no primeiro acesso</Label>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="expiresAt">Expira em (opcional)</Label>
            <Input
              id="expiresAt"
              type="date"
              value={expiresAt ?? ""}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="internalNote">Observação interna (opcional)</Label>
            <Input
              id="internalNote"
              value={internalNote ?? ""}
              onChange={(e) => setInternalNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createUser.isPending}>Criar Usuário</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}