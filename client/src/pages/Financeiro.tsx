/**
 * Financeiro.tsx — Painel financeiro completo
 * Rota: /financeiro
 *
 * Painéis:
 *  • Receitas (vendas de pássaros)
 *  • Despesas (insumos: ração, sementes, suplementos, medicamentos...)
 *  • Resultado líquido por período
 *  • Registro rápido de insumo
 *  • Histórico de compras de insumo
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Trash2 } from "lucide-react";

const CATEGORIES = [
  { value: "racao",          label: "Ração",             icon: "🌾" },
  { value: "semente",        label: "Sementes",           icon: "🫘" },
  { value: "folhagem",       label: "Folhagem",           icon: "🥬" },
  { value: "fruta",          label: "Frutas",             icon: "🍎" },
  { value: "suplemento",     label: "Suplemento",         icon: "💊" },
  { value: "medicamento",    label: "Medicamento",        icon: "💉" },
  { value: "material_ninho", label: "Material p/ Ninho",  icon: "🪹" },
  { value: "equipamento",    label: "Equipamentos",       icon: "🔧" },
  { value: "outro",          label: "Outros",             icon: "📦" },
] as const;

const UNITS = ["kg", "g", "L", "ml", "un", "sc", "cx"] as const;

function currencyBR(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Financeiro() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`);
  const [dateTo,   setDateTo]   = useState(`${now.getFullYear()}-12-31`);
  const [openForm, setOpenForm] = useState(false);
  const [filterCat, setFilterCat] = useState("all");

  const period = { dateFrom, dateTo };
  const { data: salesSummary, refetch: refetchSales } = trpc.movements.financialSummary.useQuery(period);
  const { data: supSummary,   refetch: refetchSup }   = trpc.supplies.summary.useQuery(period);
  const { data: supList,      refetch: refetchList }  = trpc.supplies.list.useQuery({ category: filterCat as any, ...period, limit: 200 });

  const createSupply = trpc.supplies.create.useMutation({
    onSuccess: () => { toast.success("Insumo registrado."); refetchSup(); refetchList(); setOpenForm(false); setForm(emptyForm); },
    onError:   (e) => toast.error(e.message),
  });
  const deleteSupply = trpc.supplies.delete.useMutation({
    onSuccess: () => { toast.success("Removido."); refetchSup(); refetchList(); },
    onError:   (e) => toast.error(e.message),
  });

  const emptyForm = { category: "racao", name: "", quantity: "", unit: "kg", unitCost: "", totalCost: "", supplier: "", date: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const totalReceitas  = salesSummary?.totalSales ?? 0;
  const totalDespesas  = supSummary?.total ?? 0;
  const resultado      = totalReceitas - totalDespesas;

  const handleCreate = () => {
    if (!form.name || !form.quantity) { toast.error("Informe nome e quantidade."); return; }
    createSupply.mutate({
      category:  form.category as any,
      name:      form.name,
      quantity:  Number(form.quantity),
      unit:      form.unit as any,
      unitCost:  form.unitCost ? Number(form.unitCost) : undefined,
      totalCost: form.totalCost ? Number(form.totalCost) : undefined,
      supplier:  form.supplier || undefined,
      date:      form.date || undefined,
      notes:     form.notes || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
            <p className="text-sm text-gray-500">Receitas de vendas · Despesas com insumos · Resultado</p>
          </div>
          <Dialog open={openForm} onOpenChange={setOpenForm}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700 gap-1"><Plus className="w-4 h-4"/>Registrar insumo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrar Compra de Insumo</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Categoria</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}/>
                  </div>
                </div>
                <div>
                  <Label>Nome do produto *</Label>
                  <Input placeholder="Ex: Ração Versele-Laga Tropical" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label>Quantidade *</Label>
                    <Input type="number" min="0" step="0.001" placeholder="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}/>
                  </div>
                  <div>
                    <Label>Unidade</Label>
                    <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Custo unit. (R$)</Label><Input type="number" min="0" step="0.01" placeholder="0,00" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })}/></div>
                  <div><Label>Total (R$)</Label><Input type="number" min="0" step="0.01" placeholder="0,00" value={form.totalCost} onChange={(e) => setForm({ ...form, totalCost: e.target.value })}/></div>
                </div>
                <div><Label>Fornecedor</Label><Input placeholder="Nome da loja ou fornecedor" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}/></div>
                <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></div>
                <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={handleCreate} disabled={createSupply.isPending}>
                  Registrar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtro de período */}
        <div className="flex gap-3 items-end flex-wrap bg-gray-50 rounded-xl p-3 border border-gray-200">
          <div><Label className="text-xs">De</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36"/></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36"/></div>
          <Button variant="outline" size="sm" onClick={() => { const y = new Date().getFullYear(); setDateFrom(`${y}-01-01`); setDateTo(`${y}-12-31`); }}>
            Ano atual
          </Button>
          <Button variant="outline" size="sm" onClick={() => { const n = new Date(); const m = String(n.getMonth()+1).padStart(2,"0"); setDateFrom(`${n.getFullYear()}-${m}-01`); setDateTo(`${n.getFullYear()}-${m}-31`); }}>
            Mês atual
          </Button>
        </div>

        {/* Cards financeiros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-green-600"/>
                <span className="text-sm font-medium text-green-700">Receitas</span>
              </div>
              <p className="text-3xl font-bold text-green-800">{currencyBR(totalReceitas)}</p>
              <p className="text-xs text-green-600 mt-1">{salesSummary?.salesCount ?? 0} venda{(salesSummary?.salesCount ?? 0) !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-5 h-5 text-red-600"/>
                <span className="text-sm font-medium text-red-700">Despesas</span>
              </div>
              <p className="text-3xl font-bold text-red-800">{currencyBR(totalDespesas)}</p>
              <p className="text-xs text-red-600 mt-1">{(supList ?? []).length} registro{(supList ?? []).length !== 1 ? "s" : ""} de insumo</p>
            </CardContent>
          </Card>

          <Card className={`border-2 ${resultado >= 0 ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className={`w-5 h-5 ${resultado >= 0 ? "text-emerald-600" : "text-red-600"}`}/>
                <span className={`text-sm font-medium ${resultado >= 0 ? "text-emerald-700" : "text-red-700"}`}>Resultado</span>
              </div>
              <p className={`text-3xl font-bold ${resultado >= 0 ? "text-emerald-800" : "text-red-800"}`}>{currencyBR(resultado)}</p>
              <p className={`text-xs mt-1 ${resultado >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {resultado >= 0 ? "✓ Superávit" : "⚠️ Déficit"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Despesas por categoria */}
        {(supSummary?.byCategory ?? []).length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Despesas por categoria</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(supSummary?.byCategory ?? []).map((cat: any) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-lg shrink-0">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-gray-700">{cat.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{currencyBR(cat.total)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${cat.pct}%` }}/>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 w-8 text-right">{cat.pct}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Lista de insumos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 text-sm">Histórico de insumos</h2>
            <div className="flex gap-1.5 flex-wrap">
              {[{ v: "all", l: "Todos" }, ...CATEGORIES.map((c) => ({ v: c.value, l: c.icon }))].map(({ v, l }) => (
                <button key={v}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterCat === v ? "bg-amber-600 text-white border-amber-600" : "border-gray-200 text-gray-600"}`}
                  onClick={() => setFilterCat(v)}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {(supList ?? []).length === 0 && (
              <div className="py-10 text-center text-gray-400">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30"/>
                <p className="text-sm">Nenhum insumo registrado.</p>
              </div>
            )}
            {(supList as any[])?.map((s: any) => {
              const cat = CATEGORIES.find((c) => c.value === s.category);
              return (
                <Card key={s.id} className="border border-gray-100">
                  <CardContent className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-xl shrink-0">{cat?.icon ?? "📦"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                      <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                        <span>{Number(s.quantity)} {s.unit}</span>
                        {s.supplier && <span>· {s.supplier}</span>}
                        <span>· {new Date(s.date).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {s.totalCost && <p className="text-sm font-bold text-red-700">{currencyBR(Number(s.totalCost))}</p>}
                      {s.unitCost && !s.totalCost && <p className="text-xs text-gray-400">{currencyBR(Number(s.unitCost))}/{s.unit}</p>}
                    </div>
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                      onClick={() => { if (confirm("Remover este registro?")) deleteSupply.mutate(s.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
