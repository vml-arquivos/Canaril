import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Edit2, AlertCircle, RotateCcw, Shield, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { InlineAlert } from "@/components/ui-premium";

// ─── Smart Delete Modal ───────────────────────────────────────────────────────

function DeleteBatchModal({
  batchId,
  batchNumber,
  onClose,
  onDeleted,
}: {
  batchId: number;
  batchNumber: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [forceConfirm, setForceConfirm] = useState("");
  const [forceMode, setForceMode] = useState<"RECONCILE_AND_DELETE" | "DELETE_AVAILABLE_ONLY" | "FORCE_DELETE_ALL">("RECONCILE_AND_DELETE");

  const { data: preview, isLoading: previewLoading } = trpc.ringsV2.batches.previewDelete.useQuery(batchId);

  const deleteMutation = trpc.ringsV2.batches.delete.useMutation({
    onSuccess: () => { toast.success("Lote excluído com sucesso!"); onDeleted(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const reconcileMutation = trpc.ringsV2.batches.reconcileOrphans.useMutation({
    onSuccess: (d) => { toast.success(d.message); },
    onError: (e) => toast.error(e.message),
  });

  const forceMutation = trpc.ringsV2.batches.forceDelete.useMutation({
    onSuccess: () => { toast.success("Lote excluído (força administrativa)."); onDeleted(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md space-y-4 p-6">
        <h2 className="font-bold text-gray-900 text-lg">Excluir Lote <span className="font-mono text-amber-700">{batchNumber}</span></h2>

        {previewLoading && (
          <div className="flex items-center gap-2 text-gray-400 py-4"><Loader2 className="w-4 h-4 animate-spin" />Verificando dependências...</div>
        )}

        {preview && (
          <div className="space-y-3">
            {/* Status visual */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 rounded-lg py-3"><p className="text-xl font-bold text-gray-700">{preview.total}</p><p className="text-xs text-gray-400">Total</p></div>
              <div className="bg-green-50 rounded-lg py-3"><p className="text-xl font-bold text-green-700">{preview.available}</p><p className="text-xs text-gray-400">Disponíveis</p></div>
              <div className={`rounded-lg py-3 ${preview.activelyUsed > 0 ? "bg-red-50" : preview.orphans > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
                <p className={`text-xl font-bold ${preview.activelyUsed > 0 ? "text-red-700" : preview.orphans > 0 ? "text-amber-700" : "text-gray-300"}`}>{preview.inUse}</p>
                <p className="text-xs text-gray-400">Em uso</p>
              </div>
            </div>

            {/* Mensagem de status */}
            <InlineAlert variant={preview.activelyUsed > 0 ? "error" : preview.orphans > 0 ? "warning" : "success"}>
              {preview.message}
            </InlineAlert>

            {/* Orphan detail */}
            {preview.orphans > 0 && preview.orphanNumbers.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 text-xs">
                <p className="font-semibold text-amber-800 mb-1">Anilhas órfãs ({preview.orphans}):</p>
                <p className="text-amber-700 font-mono break-all">{preview.orphanNumbers.slice(0, 8).join(", ")}{preview.orphanNumbers.length > 8 ? ` + ${preview.orphanNumbers.length - 8} mais` : ""}</p>
              </div>
            )}

            {/* Active birds blocking */}
            {preview.activelyUsed > 0 && preview.activeNumbers.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 text-xs">
                <p className="font-semibold text-red-800 mb-1">Vinculadas a pássaros ativos ({preview.activelyUsed}):</p>
                <p className="text-red-700 font-mono break-all">{preview.activeNumbers.slice(0, 5).join(", ")}{preview.activeNumbers.length > 5 ? ` + ${preview.activeNumbers.length - 5} mais` : ""}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-1">
              {/* Simple delete if safe */}
              {preview.canSafeDelete && (
                <Button
                  className="w-full bg-red-600 hover:bg-red-700"
                  onClick={() => deleteMutation.mutate(batchId)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Excluir lote
                </Button>
              )}

              {/* Reconcile orphans then delete */}
              {preview.canReconcileAndDelete && (
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700"
                  onClick={async () => {
                    await reconcileMutation.mutateAsync(batchId);
                    deleteMutation.mutate(batchId);
                  }}
                  disabled={reconcileMutation.isPending || deleteMutation.isPending}
                >
                  {reconcileMutation.isPending || deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                  Corrigir órfãs e excluir
                </Button>
              )}

              {/* Force delete — always available with confirmation */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-red-600 flex items-center gap-1 hover:text-red-800">
                  <Shield className="w-3 h-3" />Exclusão administrativa (força total)
                </summary>
                <div className="mt-2 space-y-2 border border-red-200 rounded-lg p-3 bg-red-50">
                  <select
                    className="w-full text-xs border border-red-200 rounded p-1.5"
                    value={forceMode}
                    onChange={(e) => setForceMode(e.target.value as any)}
                  >
                    <option value="RECONCILE_AND_DELETE">Corrigir órfãs + excluir tudo</option>
                    <option value="DELETE_AVAILABLE_ONLY">Excluir só disponíveis</option>
                    <option value="FORCE_DELETE_ALL">Forçar exclusão total</option>
                  </select>
                  <Input
                    className="text-xs"
                    placeholder="Digite EXCLUIR LOTE"
                    value={forceConfirm}
                    onChange={(e) => setForceConfirm(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="w-full bg-red-700 hover:bg-red-800 text-white text-xs"
                    disabled={forceConfirm !== "EXCLUIR LOTE" || forceMutation.isPending}
                    onClick={() => forceMutation.mutate({ batchId, mode: forceMode, confirmationText: "EXCLUIR LOTE" })}
                  >
                    {forceMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Executar exclusão forçada
                  </Button>
                </div>
              </details>
            </div>
          </div>
        )}

        <Button variant="outline" className="w-full" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
}

export default function Rings() {
  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: number; batchNumber: string } | null>(null);
  const [formData, setFormData] = useState({
    batch_number: "",
    year: new Date().getFullYear().toString(),
    color: "",
    startNumber: "1",
    endNumber: "200",
  });

  const { data: rings, refetch } = trpc.management.rings.list.useQuery();

  const createRing = trpc.management.rings.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Lote cadastrado! ${data.generated} anilhas individuais geradas.`);
      refetch();
      setOpen(false);
      setFormData({
        batch_number: "",
        year: new Date().getFullYear().toString(),
        color: "",
        startNumber: "1",
        endNumber: "200",
      });
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar anilhas: " + error.message);
    },
  });

  const updateRingBatch = trpc.management.rings.update.useMutation({
    onSuccess: () => {
      toast.success("Lote atualizado com sucesso!");
      refetch();
    },
    onError: (error) => toast.error("Erro ao atualizar lote: " + error.message),
  });

  const reconcileAll = trpc.ringsV2.batches.reconcileAllOrphans.useMutation({
    onSuccess: (d) => { toast.success(d.message); refetch(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const handleEditColor = (id: number, currentColor: string) => {
    const newColor = window.prompt("Nova cor do lote:", currentColor);
    if (newColor && newColor.trim() && newColor !== currentColor) {
      updateRingBatch.mutate({ id, color: newColor.trim() });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batch_number || !formData.year || !formData.startNumber || !formData.endNumber) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (parseInt(formData.endNumber) < parseInt(formData.startNumber)) {
      toast.error("A numeração final deve ser maior ou igual à inicial");
      return;
    }

    createRing.mutate({
      batch_number: formData.batch_number,
      year: parseInt(formData.year),
      color: formData.color,
      startNumber: parseInt(formData.startNumber),
      endNumber: parseInt(formData.endNumber),
    });
  };

  const handleDelete = (id: number, batchNumber: string) => {
    setDeleteModal({ id, batchNumber });
  };

  const previewCount =
    formData.startNumber && formData.endNumber
      ? Math.max(0, parseInt(formData.endNumber) - parseInt(formData.startNumber) + 1)
      : 0;

  const totalRings = rings?.reduce((sum, r) => sum + r.quantity_total, 0) || 0;
  // Use the raw count from quantity_used (it's recalculated on reconcile)
  const usedRings = rings?.reduce((sum, r) => sum + r.quantity_used, 0) || 0;
  const availableRings = totalRings - usedRings;

  return (
    <DashboardLayout>
      {/* Smart delete modal */}
      {deleteModal && (
        <DeleteBatchModal
          batchId={deleteModal.id}
          batchNumber={deleteModal.batchNumber}
          onClose={() => setDeleteModal(null)}
          onDeleted={() => { refetch(); setDeleteModal(null); }}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Anilhas</h1>
            <p className="text-gray-600 mt-2">Controle de lotes e disponibilidade</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button
              variant="outline"
              className="border-amber-200 text-amber-700 hover:bg-amber-50"
              onClick={() => reconcileAll.mutate()}
              disabled={reconcileAll.isPending}
              title="Corrige anilhas 'em uso' cujo pássaro foi removido"
            >
              {reconcileAll.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Reconciliar órfãs
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Novo Lote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Lote de Anilhas</DialogTitle>
                <DialogDescription>Registre um novo lote de anilhas</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="batch_number">Número do Lote *</Label>
                    <Input
                      id="batch_number"
                      value={formData.batch_number}
                      onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                      placeholder="Ex: 001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Ano *</Label>
                    <Input
                      id="year"
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="color">Cor</Label>
                    <Input
                      id="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="Ex: Verde, Azul, Vermelho"
                    />
                  </div>
                  <div>
                    <Label htmlFor="startNumber">Numeração Inicial *</Label>
                    <Input
                      id="startNumber"
                      type="number"
                      min="1"
                      value={formData.startNumber}
                      onChange={(e) => setFormData({ ...formData, startNumber: e.target.value })}
                      placeholder="Ex: 1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endNumber">Numeração Final *</Label>
                    <Input
                      id="endNumber"
                      type="number"
                      min="1"
                      value={formData.endNumber}
                      onChange={(e) => setFormData({ ...formData, endNumber: e.target.value })}
                      placeholder="Ex: 200"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Serão geradas <strong>{previewCount}</strong> anilhas individuais, numeradas de{" "}
                  <strong>{formData.year}-{String(formData.startNumber || 0).padStart(3, "0")}</strong> até{" "}
                  <strong>{formData.year}-{String(formData.endNumber || 0).padStart(3, "0")}</strong>.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                    Cadastrar Lote
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div> {/* end flex gap-2 */}
        </div> {/* end header */}

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Anilhas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{totalRings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Anilhas em Uso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{usedRings}</div>
            </CardContent>
          </Card>
          <Card className={availableRings < 10 ? "border-red-200 bg-red-50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${availableRings < 10 ? "text-red-600" : "text-green-600"}`}>
                {availableRings}
              </div>
              {availableRings < 10 && (
                <div className="flex items-center gap-1 text-xs text-red-600 mt-2">
                  <AlertCircle className="w-3 h-3" />
                  Estoque baixo
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lotes de Anilhas</CardTitle>
            <CardDescription>Total: {rings?.length || 0} lotes cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            {rings && rings.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Ano</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Usadas</TableHead>
                      <TableHead>Disponíveis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rings.map((ring) => {
                      const available = ring.quantity_total - ring.quantity_used;
                      return (
                        <TableRow key={ring.id}>
                          <TableCell className="font-mono font-semibold">{ring.batch_number}</TableCell>
                          <TableCell>{ring.year}</TableCell>
                          <TableCell>{ring.color || "-"}</TableCell>
                          <TableCell>{ring.quantity_total}</TableCell>
                          <TableCell className="text-yellow-600">{ring.quantity_used}</TableCell>
                          <TableCell className={available < 5 ? "text-red-600 font-semibold" : "text-green-600"}>
                            {available}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              available === 0 ? "bg-red-100 text-red-800" :
                              available < 5 ? "bg-yellow-100 text-yellow-800" :
                              "bg-green-100 text-green-800"
                            }`}>
                              {ring.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditColor(ring.id, ring.color)}
                                title="Editar cor do lote"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600"
                                aria-label={`Excluir lote ${ring.batch_number}`}
                                onClick={() => handleDelete(ring.id, ring.batch_number)}
                                title="Verificar dependências e excluir lote"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhum lote de anilhas cadastrado ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
