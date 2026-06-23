/**
 * RotinaDiaria.tsx — Rotina Diária do Criador (Missão 3.1)
 * Rota: /rotina
 * Mobile-first. Botões grandes. Zero digitação obrigatória.
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Egg, Heart, AlertTriangle, CheckCircle2, Clock, Camera,
  Plus, Minus, X, ChevronDown, ChevronUp, Bird,
} from "lucide-react";
import { Link } from "wouter";

// ─── Constantes ───────────────────────────────────────────────────────────────

const NOTE_PRESETS = [
  "Tudo normal", "Fêmea chocando bem", "Macho alimentando",
  "Ovo quebrado", "Ovo fora do ninho", "Filhote fraco",
  "Ninho sujo", "Trocar ninho", "Verificar amanhã", "Atenção veterinária",
];

const EVENT_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  EGG_ADDED:        { label: "+1 Ovo",           emoji: "🥚", color: "bg-amber-100 text-amber-800 border-amber-300" },
  EGG_LOST:         { label: "Ovo perdido",       emoji: "💔", color: "bg-red-100 text-red-800 border-red-300" },
  EGG_BROKEN:       { label: "Ovo quebrado",      emoji: "🔴", color: "bg-red-100 text-red-800 border-red-300" },
  EGG_FERTILE:      { label: "Galado",            emoji: "✅", color: "bg-green-100 text-green-800 border-green-300" },
  EGG_INFERTILE:    { label: "Infértil",          emoji: "⭕", color: "bg-gray-100 text-gray-700 border-gray-300" },
  EGG_CLEAR:        { label: "Ovo claro",         emoji: "⬜", color: "bg-gray-100 text-gray-700 border-gray-300" },
  CHICK_HATCHED:    { label: "Nasceu",            emoji: "🐣", color: "bg-green-100 text-green-800 border-green-300" },
  CHICK_DIED:       { label: "Filhote morreu",    emoji: "🖤", color: "bg-red-200 text-red-900 border-red-400" },
  CHICK_RINGED:     { label: "Anilhado",          emoji: "🔖", color: "bg-blue-100 text-blue-800 border-blue-300" },
  FEEDING_OK:       { label: "Alimentando bem",   emoji: "🍃", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  FEEDING_PROBLEM:  { label: "Não alimenta",      emoji: "⚠️",  color: "bg-orange-100 text-orange-800 border-orange-300" },
  NEST_CLEANED:     { label: "Ninho limpo",       emoji: "🧹", color: "bg-blue-50 text-blue-700 border-blue-200" },
  SUPPLEMENT_GIVEN: { label: "Suplemento",        emoji: "💊", color: "bg-purple-100 text-purple-800 border-purple-300" },
  MEDICATION_GIVEN: { label: "Medicação",         emoji: "💉", color: "bg-purple-100 text-purple-800 border-purple-300" },
  NEST_PHOTO:       { label: "Foto do ninho",     emoji: "📷", color: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  GENERAL_NOTE:     { label: "Observação",        emoji: "📝", color: "bg-gray-100 text-gray-700 border-gray-300" },
};

const QUICK_EVENTS = ["EGG_ADDED","EGG_LOST","EGG_BROKEN","EGG_FERTILE","EGG_INFERTILE","CHICK_HATCHED","FEEDING_OK","FEEDING_PROBLEM","NEST_CLEANED","GENERAL_NOTE"] as const;
const NEEDS_QUANTITY = new Set(["EGG_ADDED","EGG_LOST","EGG_BROKEN","EGG_FERTILE","EGG_INFERTILE","EGG_CLEAR","CHICK_HATCHED","CHICK_DIED"]);

// ─── Bottom Sheet de Registro ─────────────────────────────────────────────────

function RegistroSheet({
  couple,
  onClose,
  onSaved,
}: {
  couple: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [noteText, setNoteText] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [showCreateClutch, setShowCreateClutch] = useState(false);

  const logMutation = trpc.dailyCare.logEvent.useMutation({
    onSuccess: () => {
      toast.success("Registro salvo. Postura atualizada.");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleEventClick = (eventType: string) => {
    setSelectedEvent(eventType);
    setQuantity(1);
    // If EGG_ADDED and no active clutch, show create clutch prompt
    if (eventType === "EGG_ADDED" && !couple.activeClutchId) {
      setShowCreateClutch(true);
    } else {
      setShowCreateClutch(false);
    }
  };

  const handleSave = () => {
    if (!selectedEvent) return;
    logMutation.mutate({
      coupleId: couple.coupleId,
      clutchId: couple.activeClutchId ?? undefined,
      cageId: couple.cageId ?? undefined,
      eventType: selectedEvent as any,
      quantity,
      notePreset: selectedPresets.length > 0 ? selectedPresets.join("; ") : undefined,
      noteText: noteText || undefined,
      autoCreateClutch: showCreateClutch,
    });
  };

  const togglePreset = (p: string) => {
    setSelectedPresets((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div className="relative bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2"><div className="w-12 h-1 rounded-full bg-gray-300" /></div>

        <div className="px-4 pb-8 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Gaiola {couple.cageNumber}</p>
              <p className="text-xs text-gray-500">{couple.maleRing} × {couple.femaleRing}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>

          {/* Evento selecionado */}
          {selectedEvent && (
            <div className={`rounded-xl border-2 p-3 ${EVENT_LABELS[selectedEvent]?.color ?? "bg-gray-50 border-gray-200"}`}>
              <p className="font-semibold text-sm">{EVENT_LABELS[selectedEvent]?.emoji} {EVENT_LABELS[selectedEvent]?.label}</p>
              {NEEDS_QUANTITY.has(selectedEvent) && (
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-sm text-gray-600">Quantidade:</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-9 h-9 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-lg font-bold"><Minus className="w-4 h-4" /></button>
                    <span className="text-2xl font-bold w-8 text-center">{quantity}</span>
                    <button onClick={() => setQuantity(Math.min(99, quantity + 1))} className="w-9 h-9 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-lg font-bold"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
              {showCreateClutch && (
                <div className="mt-2 bg-amber-50 rounded-lg p-2 text-xs text-amber-800 border border-amber-200">
                  ⚠️ Este casal não tem postura ativa. O sistema vai criar uma postura automaticamente ao salvar.
                </div>
              )}
            </div>
          )}

          {/* Botões de evento */}
          {!selectedEvent && (
            <div className="grid grid-cols-2 gap-2">
              {QUICK_EVENTS.map((evt) => {
                const cfg = EVENT_LABELS[evt];
                return (
                  <button key={evt} onClick={() => handleEventClick(evt)}
                    className={`rounded-xl border-2 p-4 text-left transition-all active:scale-95 ${cfg.color}`}>
                    <span className="text-2xl">{cfg.emoji}</span>
                    <p className="text-sm font-semibold mt-1">{cfg.label}</p>
                  </button>
                );
              })}
            </div>
          )}

          {selectedEvent && (
            <>
              {/* Presets */}
              <div>
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Observações rápidas</p>
                <div className="flex flex-wrap gap-2">
                  {NOTE_PRESETS.map((p) => (
                    <button key={p} onClick={() => togglePreset(p)}
                      className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${selectedPresets.includes(p) ? "bg-amber-600 text-white border-amber-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-300"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nota manual */}
              <div>
                <button onClick={() => setShowNote(!showNote)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  {showNote ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Adicionar observação manual
                </button>
                {showNote && (
                  <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2}
                    className="mt-2 w-full rounded-lg border border-gray-200 p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="Observação livre..." />
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedEvent(null)}>← Voltar</Button>
                <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-base py-6" onClick={handleSave} disabled={logMutation.isPending}>
                  {logMutation.isPending ? "Salvando..." : "Salvar Registro"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card do Casal ────────────────────────────────────────────────────────────

function CoupleCard({ couple, onRegister }: { couple: any; onRegister: (c: any) => void }) {
  const statusColors: Record<string, string> = {
    "com filhotes": "bg-green-100 text-green-800",
    "chocando":     "bg-amber-100 text-amber-800",
    "em postura":   "bg-blue-100 text-blue-800",
    "ativo":        "bg-gray-100 text-gray-600",
  };

  const hasAlerts = couple.alerts?.length > 0;
  const hasLogToday = couple.hasLogToday;

  return (
    <Card className={`border-2 transition-all ${hasAlerts ? "border-amber-300" : hasLogToday ? "border-green-200" : "border-gray-100"}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">Gaiola {couple.cageNumber}</span>
              <Badge className={`text-xs ${statusColors[couple.status] ?? "bg-gray-100 text-gray-600"}`}>{couple.status}</Badge>
              {hasLogToday && <Badge className="text-xs bg-green-50 text-green-700 border-green-200 border"><CheckCircle2 className="w-3 h-3 mr-1" />Registrado hoje</Badge>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              ♂ <span className="font-mono">{couple.maleRing}</span> × ♀ <span className="font-mono">{couple.femaleRing}</span>
            </p>
          </div>
          <Heart className="w-5 h-5 text-rose-400 shrink-0" />
        </div>

        {/* Totais */}
        {couple.totals && (
          <div className="grid grid-cols-4 gap-1 text-center">
            {[
              ["Ovos", couple.totals.totalEggs, "text-amber-700"],
              ["Galados", couple.totals.fertilizedEggs, "text-green-700"],
              ["Perdidos", couple.totals.lostEggs, "text-red-600"],
              ["Nascidos", couple.totals.hatchedChicks, "text-blue-700"],
            ].map(([l, v, c]) => (
              <div key={String(l)} className="bg-gray-50 rounded-lg py-2">
                <p className={`text-lg font-bold ${c}`}>{v}</p>
                <p className="text-xs text-gray-400">{l}</p>
              </div>
            ))}
          </div>
        )}

        {/* Incubação */}
        {couple.daysIncubating !== null && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Chocando há <strong>{couple.daysIncubating}</strong> dias</span>
            {couple.predictedHatchMin && (
              <span className="text-blue-600">· Eclosão: {new Date(couple.predictedHatchMin).toLocaleDateString("pt-BR")}–{new Date(couple.predictedHatchMax).toLocaleDateString("pt-BR")}</span>
            )}
          </div>
        )}

        {/* Alertas */}
        {hasAlerts && (
          <div className="space-y-1">
            {couple.alerts.slice(0, 2).map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{a.message}
              </div>
            ))}
          </div>
        )}

        {/* Ações */}
        <Button className="w-full bg-amber-600 hover:bg-amber-700 text-base py-5" onClick={() => onRegister(couple)}>
          <Plus className="w-5 h-5 mr-2" />Registrar evento
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function RotinaDiaria() {
  const [activeCouple, setActiveCouple] = useState<any>(null);
  const [filter, setFilter] = useState<"todos" | "sem-registro" | "atencao" | "com-ovos" | "com-filhotes">("todos");

  const { data: couples, refetch, isLoading } = trpc.dailyCare.listActiveCouples.useQuery();
  const { data: summary } = trpc.dailyCare.getDailySummary.useQuery();

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const filtered = (couples ?? []).filter((c) => {
    if (filter === "sem-registro") return !c.hasLogToday;
    if (filter === "atencao") return c.alerts?.length > 0;
    if (filter === "com-ovos") return c.totals && c.totals.totalEggs > 0;
    if (filter === "com-filhotes") return c.totals && c.totals.hatchedChicks > 0;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-2xl mx-auto pb-20">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rotina Diária</h1>
          <p className="text-sm text-gray-500 capitalize">{today}</p>
        </div>

        {/* Resumo do dia */}
        {summary && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
              <p className="text-2xl font-bold text-green-700">{summary.couplesWithLogs.length}</p>
              <p className="text-xs text-green-600">Registrados</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
              <p className="text-2xl font-bold text-amber-700">{summary.couplesWithoutLogs.length}</p>
              <p className="text-xs text-amber-600">Sem registro</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-gray-700">{summary.totalActive}</p>
              <p className="text-xs text-gray-500">Casais ativos</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { key: "todos", label: "Todos" },
            { key: "sem-registro", label: "Sem registro" },
            { key: "atencao", label: "Atenção" },
            { key: "com-ovos", label: "Com ovos" },
            { key: "com-filhotes", label: "Com filhotes" },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              className={`rounded-full px-3 py-1.5 text-sm whitespace-nowrap border transition-colors ${filter === f.key ? "bg-amber-600 text-white border-amber-600" : "bg-white text-gray-600 border-gray-200"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista de casais */}
        {isLoading && (
          <div className="text-center py-16 text-gray-400">
            <Egg className="w-10 h-10 mx-auto mb-3 animate-pulse" />
            <p>Carregando casais...</p>
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Bird className="w-10 h-10 mx-auto mb-3 opacity-30" />
            {filter === "todos"
              ? <><p className="font-medium">Nenhum casal ativo.</p><Link href="/couples"><Button variant="outline" size="sm" className="mt-3">Cadastrar casal</Button></Link></>
              : <p>Nenhum casal com esse filtro.</p>}
          </div>
        )}

        <div className="space-y-4">
          {filtered.map((c) => <CoupleCard key={c.coupleId} couple={c} onRegister={setActiveCouple} />)}
        </div>
      </div>

      {/* Bottom Sheet */}
      {activeCouple && (
        <RegistroSheet couple={activeCouple} onClose={() => setActiveCouple(null)} onSaved={() => refetch()} />
      )}
    </DashboardLayout>
  );
}
