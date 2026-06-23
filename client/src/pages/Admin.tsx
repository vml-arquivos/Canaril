/**
 * Admin.tsx — Administração Total (Missão 4)
 * Rota: /admin
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Shield, Users, Trash2, AlertTriangle, History, Building2, RotateCcw, X, ExternalLink } from "lucide-react";
import { Link } from "wouter";

// ─── Tab: Usuários ────────────────────────────────────────────────────────────

function TabUsuarios() {
  const { data: users, refetch } = trpc.admin.listUsers.useQuery();
  const disableUser = trpc.admin.disableUser.useMutation({ onSuccess: () => { toast.success("Usuário desativado."); refetch(); }, onError: (e) => toast.error(e.message) });
  const deleteUser = trpc.admin.deleteUser.useMutation({ onSuccess: () => { toast.success("Usuário removido."); refetch(); }, onError: (e) => toast.error(e.message) });
  const updateUser = trpc.admin.updateUser.useMutation({ onSuccess: () => { toast.success("Usuário atualizado."); refetch(); }, onError: (e) => toast.error(e.message) });

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: "bg-purple-100 text-purple-900",
    OWNER: "bg-amber-100 text-amber-900",
    ADMIN: "bg-blue-100 text-blue-800",
    MANAGER: "bg-green-100 text-green-800",
    MEMBER: "bg-gray-100 text-gray-700",
    VIEWER: "bg-gray-50 text-gray-500",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <Select
                        defaultValue={u.role ?? "MEMBER"}
                        onValueChange={(v) => updateUser.mutate({ id: u.id, role: v as any })}
                      >
                        <SelectTrigger className="w-32 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["SUPER_ADMIN","OWNER","ADMIN","MANAGER","MEMBER","VIEWER"].map((r) => (
                            <SelectItem key={r} value={r}><span className={`text-xs px-1.5 py-0.5 rounded ${roleColors[r]}`}>{r}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge className={(u as any).isActive !== false ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}>
                        {(u as any).isActive !== false ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-amber-600" onClick={() => { if (confirm("Desativar este usuário?")) disableUser.mutate({ id: u.id }); }}>Desativar</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-red-600" onClick={() => { if (confirm("Remover este usuário? Esta ação pode ser revertida na Lixeira.")) deleteUser.mutate({ id: u.id }); }}>Remover</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(users ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Nenhum usuário.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Tenants ─────────────────────────────────────────────────────────────

function TabTenants() {
  const { data: tenants, refetch } = trpc.admin.getTenants.useQuery();
  const [form, setForm] = useState({ name: "", slug: "", breederCode: "", city: "" });
  const createMutation = trpc.admin.createTenant.useMutation({
    onSuccess: () => { toast.success("Criadouro criado!"); refetch(); setForm({ name: "", slug: "", breederCode: "", city: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.admin.deleteTenant.useMutation({
    onSuccess: () => { toast.success("Criadouro removido."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Novo Criadouro</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="Nome do criadouro" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Slug (ex: canaril-lima)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
          <Input placeholder="Código do criador (ex: GF-003)" value={form.breederCode} onChange={(e) => setForm({ ...form, breederCode: e.target.value })} />
          <Input placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Button className="sm:col-span-2 bg-amber-600 hover:bg-amber-700" onClick={() => createMutation.mutate(form as any)} disabled={!form.name || !form.slug}>
            Criar Criadouro
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Slug</TableHead><TableHead>Código</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(tenants ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                  <TableCell>{t.breederCode ?? "—"}</TableCell>
                  <TableCell><Badge className={t.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}>{t.status}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-red-600 h-7" onClick={() => { if (confirm("Remover criadouro?")) deleteMutation.mutate({ id: t.id }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Lixeira ─────────────────────────────────────────────────────────────

function TabLixeira() {
  const [entityType, setEntityType] = useState<string>("bird");
  const { data: trash, refetch } = trpc.admin.listTrash.useQuery({ entityType: entityType as any });
  const restore = trpc.admin.restore.useMutation({ onSuccess: () => { toast.success("Restaurado!"); refetch(); }, onError: (e) => toast.error(e.message) });

  const items = (trash as any)?.[entityType] ?? [];
  const entityLabels: Record<string, string> = { bird: "Pássaros", ring: "Anilhas", ring_batch: "Lotes", couple: "Casais", clutch: "Posturas", chick: "Filhotes", cage: "Gaiolas", championship: "Campeonatos", user: "Usuários" };

  return (
    <div className="space-y-4">
      <Select value={entityType} onValueChange={setEntityType}>
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(entityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Dados</TableHead><TableHead>Excluído em</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-8">Nenhum item na lixeira para "{entityLabels[entityType]}".</TableCell></TableRow>}
              {items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs text-gray-400">#{item.id}</TableCell>
                  <TableCell className="text-sm">{item.ring ?? item.name ?? item.code ?? item.number ?? item.email ?? `#${item.id}`}</TableCell>
                  <TableCell className="text-xs text-gray-400">{item.deletedAt ? new Date(item.deletedAt).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 text-green-700" onClick={() => restore.mutate({ entityType: entityType as any, id: item.id })}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />Restaurar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Limpeza de Testes ───────────────────────────────────────────────────

function TabLimpeza() {
  const [prefix, setPrefix] = useState("TESTE");
  const [confirm, setConfirm] = useState("");
  const [hardDelete, setHardDelete] = useState(false);

  const { data: preview, refetch: refetchPreview } = trpc.admin.previewTestCleanup.useQuery({ prefix }, { enabled: prefix.length >= 2 });
  const execute = trpc.admin.executeTestCleanup.useMutation({
    onSuccess: (d) => { toast.success(`Limpeza concluída: ${d.deleted} itens ${d.hardDelete ? "excluídos definitivamente" : "arquivados"}.`); setConfirm(""); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-xl">
      <Card className="border-red-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />Zona de Segurança — Limpeza de Testes</CardTitle>
          <CardDescription>Remove dados criados durante testes. Esta ação é irreversível no modo definitivo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Prefixo do nome/anilha</p>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="TESTE" className="font-mono" />
          </div>

          {preview && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm space-y-1">
              <p className="font-semibold text-amber-800">Prévia: {preview.total} itens encontrados</p>
              {[["Pássaros", preview.birds], ["Casais", preview.couples], ["Anilhas", preview.rings], ["Gaiolas", preview.cages]].map(([l, v]) => (
                <p key={String(l)} className="text-amber-700">• {v} {l}</p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="hard" checked={hardDelete} onChange={(e) => setHardDelete(e.target.checked)} className="rounded" />
            <label htmlFor="hard" className="text-sm text-red-700 font-medium">Exclusão definitiva (sem lixeira)</label>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Digite <strong>LIMPAR TESTES</strong> para confirmar</p>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="LIMPAR TESTES" className="font-mono" />
          </div>

          <Button
            className="w-full bg-red-600 hover:bg-red-700"
            disabled={confirm !== "LIMPAR TESTES" || !preview || preview.total === 0 || execute.isPending}
            onClick={() => execute.mutate({ prefix, confirm: "LIMPAR TESTES", hardDelete })}>
            {execute.isPending ? "Executando..." : `Limpar ${preview?.total ?? 0} itens`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Auditoria ───────────────────────────────────────────────────────────

function TabAuditoria() {
  const { data: logs } = trpc.admin.listAuditLogs.useQuery({ limit: 100 });
  const actionColors: Record<string, string> = { create: "text-green-700", update: "text-blue-700", soft_delete: "text-amber-700", hard_delete: "text-red-700", restore: "text-emerald-700", bulk_delete: "text-red-900" };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Ação</TableHead><TableHead>Entidade</TableHead><TableHead>ID</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
            <TableBody>
              {(logs ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Nenhum log de auditoria.</TableCell></TableRow>}
              {(logs ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-gray-400 whitespace-nowrap">{new Date(l.createdAt).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className={`text-xs font-semibold ${actionColors[l.action] ?? "text-gray-600"}`}>{l.action}</TableCell>
                  <TableCell className="text-xs">{l.entityType}</TableCell>
                  <TableCell className="text-xs text-gray-400">{l.entityId ?? "—"}</TableCell>
                  <TableCell className="text-xs text-gray-500 truncate max-w-[200px]">{l.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function Admin() {
  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-amber-700" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Administração</h1>
            <p className="text-gray-500 mt-0.5 text-sm">Usuários, criadouros, lixeira, limpeza e auditoria</p>
          </div>
        </div>

        <Tabs defaultValue="usuarios">
          <TabsList className="flex-wrap">
            <TabsTrigger value="usuarios"><Users className="w-4 h-4 mr-1.5" />Usuários</TabsTrigger>
            <TabsTrigger value="tenants"><Building2 className="w-4 h-4 mr-1.5" />Criadouros</TabsTrigger>
            <TabsTrigger value="lixeira"><Trash2 className="w-4 h-4 mr-1.5" />Lixeira</TabsTrigger>
            <TabsTrigger value="limpeza"><AlertTriangle className="w-4 h-4 mr-1.5" />Limpeza</TabsTrigger>
            <TabsTrigger value="auditoria"><History className="w-4 h-4 mr-1.5" />Auditoria</TabsTrigger>
          </TabsList>
          <TabsContent value="usuarios" className="mt-5"><TabUsuarios /></TabsContent>
          <TabsContent value="tenants" className="mt-5"><TabTenants /></TabsContent>
          <TabsContent value="lixeira" className="mt-5"><TabLixeira /></TabsContent>
          <TabsContent value="limpeza" className="mt-5"><TabLimpeza /></TabsContent>
          <TabsContent value="auditoria" className="mt-5"><TabAuditoria /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
