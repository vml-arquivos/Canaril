/**
 * Plantel.tsx — Controle de movimentação: entradas e saídas de pássaros
 * Rota: /plantel
 *
 * Funcionalidades:
 *  • Registrar compra, nascimento/promoção, doação, transferência (entrada)
 *  • Registrar venda (com preço), óbito, fuga, doação, transferência (saída)
 *  • Histórico completo com filtro por tipo e período
 *  • Status visual dos pássaros (ativo/vendido/morto/fugiu)
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, Bird as BirdIcon, DollarSign, AlertTriangle, Filter } from "lucide-react";
import { Link } from "wouter";

const ENTRY_TYPES = [
  { value: "bought",         label: "Compra",                  icon: "🛒" },
  { value: "bred",           label: "Nascimento/Plantel",      icon: "🐣" },
  { value: "donated_in",     label: "Doação (recebida)",       icon: "🎁" },
  { value: "transferred_in", label: "Transferência (entrada)", icon: "📥" },
];

const EXIT_TYPES = [
  { value: "sold",            label: "Venda",                   icon: "💰" },
  { value: "died",            label: "Óbito",                   icon: "💀" },
  { value: "escaped",         label: "Fuga",                    icon: "🕊️" },
  { value: "donated_out",     label: "Doação (enviada)",        icon: "🤝" },
  { value: "transferred_out", label: "Transferência (saída)",   icon: "📤" },
  { value: "culled",          label: "Descarte",                icon: "⬇️" },
];

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  bought:          { label: "Compra",            icon: "🛒", color: "bg-blue-100 text-blue-800" },
  bred:            { label: "Nascimento",         icon: "🐣", color: "bg-green-100 text-green-800" },
  donated_in:      { label: "Doação entrada",    icon: "🎁", color: "bg-purple-100 text-purple-800" },
  transferred_in:  { label: "Transfer. entrada", icon: "📥", color: "bg-indigo-100 text-indigo-800" },
  sold:            { label: "Venda",             icon: "💰", color: "bg-emerald-100 text-emerald-800" },
  died:            { label: "Óbito",             icon: "💀", color: "bg-gray-200 text-gray-700" },
  escaped:         { label: "Fuga",              icon: "🕊️", color: "bg-orange-100 text-orange-800" },
  donated_out:     { label: "Doação saída",      icon: "🤝", color: "bg-pink-100 text-pink-800" },
  transferred_out: { label: "Transfer. saída",   icon: "📤", color: "bg-amber-100 text-amber-800" },
  culled:          { label: "Descarte",          icon: "⬇️", color: "bg-red-100 text-red-800" },
};

const STATUS_BADGE: Record<string, string> = {
  active:      "bg-green-100 text-green-800",
  sold:        "bg-emerald-100 text-emerald-800",
  dead:        "bg-gray-200 text-gray-700",
  escaped:     "bg-orange-100 text-orange-800",
  donated:     "bg-purple-100 text-purple-800",
  transferred: "bg-blue-100 text-blue-800",
  inactive:    "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  active:      "Ativo",
  sold:        "Vendido",
  dead:        "Óbito",
  escaped:     "Fugiu",
  donated:     "Doado",
  transferred: "Transferido",
  inactive:    "Inativo",
};

export default function Plantel() {
  const [filterType, setFilterType] = useState("all");
  const [openEntry, setOpenEntry] = useState(false);
  const [openExit, setOpenExit]   = useState(false);

  const { data: movements, refetch } = trpc.movements.list.useQuery({ type: filterType as any, limit: 150 });
  const { data: allBirds }           = trpc.birds.list.useQuery({});

  const activeBirds = (allBirds ?? []).filter((b) => (b as any).status === "active");
  const soldBirds   = (allBirds ?? []).filter((b) => (b as any).status === "sold");
  const deadBirds   = (allBirds ?? []).filter((b) => (b as any).status === "dead");

  const registerEntry = trpc.movements.registerEntry.useMutation({
    onSuccess: () => { toast.success("Entrada registrada."); refetch(); setOpenEntry(false); },
    onError: (e) => toast.error(e.message),
  });
  const registerExit = trpc.movements.registerExit.useMutation({
    onSuccess: () => { toast.success("Saída registrada."); refetch(); setOpenExit(false); },
    onError: (e) => toast.error(e.message),
  });

  const [entryForm, setEntryForm] = useState({ birdId: "", type: "bought", date: "", price: "", counterpart: "", notes: "" });
  const [exitForm,  setExitForm]  = useState({ birdId: "", type: "sold",   date: "", price: "", counterpart: "", notes: "" });

  const handleEntry = () => {
    if (!entryForm.birdId || !entryForm.type) { toast.error("Selecione o pássaro e o tipo."); return; }
    registerEntry.mutate({
      birdId:      Number(entryForm.birdId),
      type:        entryForm.type as any,
      date:        entryForm.date || undefined,
      price:       entryForm.price ? Number(entryForm.price) : undefined,
      counterpart: entryForm.counterpart || undefined,
      notes:       entryForm.notes || undefined,
    });
  };

  const handleExit = () => {
    if (!exitForm.birdId || !exitForm.type) { toast.error("Selecione o pássaro e o tipo."); return; }
    registerExit.mutate({
      birdId:      Number(exitForm.birdId),
      type:        exitForm.type as any,
      date:        exitForm.date || undefined,
      price:       exitForm.price ? Number(exitForm.price) : undefined,
      counterpart: exitForm.counterpart || undefined,
      notes:       exitForm.notes || undefined,
    });
  };

  const totalVendas  = (movements ?? []).filter((m: any) => m.type === "sold").reduce((s: number, m: any) => s + Number(m.price ?? 0), 0);
  const totalCompras = (movements ?? []).filter((m: any) => m.type === "bought").reduce((s: number, m: any) => s + Number(m.price ?? 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plantel — Entradas & Saídas</h1>
            <p className="text-sm text-gray-500">Controle completo de movimentação de pássaros</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={openEntry} onOpenChange={setOpenEntry}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 gap-1">
                  <TrendingDown className="w-4 h-4 rotate-180"/>Entrada
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Registrar Entrada</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div>
                    <Label>Pássaro</Label>
                    <Select value={entryForm.birdId} onValueChange={(v) => setEntryForm({ ...entryForm, birdId: v })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent className="max-h-56">
                        {(allBirds ?? []).map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            <span className="font-mono">{b.ring}</span>
                            {b.displayTitle && <span className="text-gray-400 text-xs ml-2">· {b.displayTitle}</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo de entrada</Label>
                    <Select value={entryForm.type} onValueChange={(v) => setEntryForm({ ...entryForm, type: v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ENTRY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Data</Label><Input type="date" value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}/></div>
                    <div><Label>Valor (R$)</Label><Input type="number" min="0" step="0.01" placeholder="0,00" value={entryForm.price} onChange={(e) => setEntryForm({ ...entryForm, price: e.target.value })}/></div>
                  </div>
                  <div><Label>Fornecedor / Origem</Label><Input placeholder="Nome do criador ou loja" value={entryForm.counterpart} onChange={(e) => setEntryForm({ ...entryForm, counterpart: e.target.value })}/></div>
                  <div><Label>Observações</Label><Textarea rows={2} value={entryForm.notes} onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}/></div>
                  <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleEntry} disabled={registerEntry.isPending}>
                    Registrar Entrada
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={openExit} onOpenChange={setOpenExit}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700 gap-1">
                  <TrendingDown className="w-4 h-4"/>Saída
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Registrar Saída</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div>
                    <Label>Pássaro</Label>
                    <Select value={exitForm.birdId} onValueChange={(v) => setExitForm({ ...exitForm, birdId: v })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent className="max-h-56">
                        {activeBirds.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            <span className="font-mono">{b.ring}</span>
                            {b.displayTitle && <span className="text-gray-400 text-xs ml-2">· {b.displayTitle}</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Motivo da saída</Label>
                    <Select value={exitForm.type} onValueChange={(v) => setExitForm({ ...exitForm, type: v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXIT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Data</Label><Input type="date" value={exitForm.date} onChange={(e) => setExitForm({ ...exitForm, date: e.target.value })}/></div>
                    {exitForm.type === "sold" && (
                      <div><Label>Valor de venda (R$)</Label><Input type="number" min="0" step="0.01" placeholder="0,00" value={exitForm.price} onChange={(e) => setExitForm({ ...exitForm, price: e.target.value })}/></div>
                    )}
                  </div>
                  {(exitForm.type === "sold" || exitForm.type === "donated_out" || exitForm.type === "transferred_out") && (
                    <div><Label>Comprador / Destino</Label><Input placeholder="Nome do comprador ou criadouro" value={exitForm.counterpart} onChange={(e) => setExitForm({ ...exitForm, counterpart: e.target.value })}/></div>
                  )}
                  <div><Label>Observações</Label><Textarea rows={2} value={exitForm.notes} onChange={(e) => setExitForm({ ...exitForm, notes: e.target.value })}/></div>
                  <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={handleExit} disabled={registerExit.isPending}>
                    Registrar Saída
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Ativos",  value: activeBirds.length, icon: "🐦", color: "border-green-200 bg-green-50" },
            { label: "Vendidos",value: soldBirds.length,   icon: "💰", color: "border-emerald-200 bg-emerald-50" },
            { label: "Óbitos",  value: deadBirds.length,   icon: "💀", color: "border-gray-200 bg-gray-50" },
            { label: "Total movim.", value: (movements ?? []).length, icon: "📋", color: "border-blue-200 bg-blue-50" },
          ].map(({ label, value, icon, color }) => (
            <Card key={label} className={`border ${color}`}>
              <CardContent className="p-3 flex items-center gap-2">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtro de tipo */}
        <div className="flex gap-2 flex-wrap items-center">
          <Filter className="w-4 h-4 text-gray-400"/>
          {[{ v: "all", l: "Todos" }, { v: "sold", l: "Vendas" }, { v: "bought", l: "Compras" }, { v: "died", l: "Óbitos" }, { v: "escaped", l: "Fugas" }].map(({ v, l }) => (
            <button key={v}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterType === v ? "bg-amber-600 text-white border-amber-600" : "border-gray-200 text-gray-600 hover:border-amber-300"}`}
              onClick={() => setFilterType(v)}>
              {l}
            </button>
          ))}
        </div>

        {/* Lista de movimentações */}
        <div className="space-y-2">
          {(movements ?? []).length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <BirdIcon className="w-10 h-10 mx-auto mb-2 opacity-30"/>
              <p className="text-sm">Nenhuma movimentação registrada.</p>
            </div>
          )}
          {(movements as any[])?.map((m: any) => {
            const cfg = TYPE_LABELS[m.type];
            const isExit = EXIT_TYPES.some((t) => t.value === m.type);
            return (
              <Card key={m.id} className="border border-gray-100 hover:border-gray-200 transition-colors">
                <CardContent className="px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl shrink-0">{cfg?.icon ?? "•"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/birds/${m.birdId}/ficha`}>
                        <span className="font-mono font-bold text-amber-700 hover:underline text-sm">{m.ring}</span>
                      </Link>
                      <Badge className={`text-xs ${cfg?.color ?? ""}`}>{cfg?.label ?? m.type}</Badge>
                      {m.price && m.type === "sold" && (
                        <span className="text-xs font-bold text-emerald-700">R$ {Number(m.price).toFixed(2)}</span>
                      )}
                      {m.price && m.type === "bought" && (
                        <span className="text-xs font-bold text-blue-700">R$ {Number(m.price).toFixed(2)}</span>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                      <span>{new Date(m.date).toLocaleDateString("pt-BR")}</span>
                      {m.counterpart && <span>· {m.counterpart}</span>}
                      {m.notes && <span>· {m.notes}</span>}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isExit
                      ? <TrendingDown className="w-4 h-4 text-red-400"/>
                      : <TrendingUp className="w-4 h-4 text-green-500"/>
                    }
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
