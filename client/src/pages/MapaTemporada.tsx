/**
 * MapaTemporada.tsx — Mapa visual da temporada de reprodução
 * Rota: /temporada  (substituindo a página de texto)
 *
 * Uma linha por casal, uma coluna por dia (últimos 30 dias + próximos 14).
 * Cada evento aparece como ícone SVG no cruzamento dia × casal.
 * Toque em qualquer célula abre o detalhe do dia.
 *
 * Design: horizontal scroll, mobile-first, sem tabelas HTML complexas.
 */
import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Egg, Baby, Heart, AlertTriangle, ChevronRight } from "lucide-react";
import { Link } from "wouter";

// ─── Tipos de evento → cor e ícone ───────────────────────────────────────────

const EVT_CONFIG: Record<string, { bg: string; dot: string; emoji: string }> = {
  EGG_ADDED:        { bg: "bg-amber-100",  dot: "bg-amber-500",  emoji: "🥚" },
  EGG_BROKEN:       { bg: "bg-red-100",    dot: "bg-red-500",    emoji: "💥" },
  EGG_INFERTILE:    { bg: "bg-gray-100",   dot: "bg-gray-400",   emoji: "○" },
  EGG_LOST:         { bg: "bg-orange-100", dot: "bg-orange-500", emoji: "✕" },
  EGG_FERTILE:      { bg: "bg-green-100",  dot: "bg-green-500",  emoji: "●" },
  EGG_CLEAR:        { bg: "bg-gray-50",    dot: "bg-gray-300",   emoji: "○" },
  CHICK_HATCHED:    { bg: "bg-emerald-100",dot: "bg-emerald-600",emoji: "🐥" },
  CHICK_DIED:       { bg: "bg-red-100",    dot: "bg-red-600",    emoji: "✕" },
  CHICK_RINGED:     { bg: "bg-blue-100",   dot: "bg-blue-600",   emoji: "💍" },
  FEEDING_OK:       { bg: "bg-sky-50",     dot: "bg-sky-500",    emoji: "✓" },
  FEEDING_PROBLEM:  { bg: "bg-red-50",     dot: "bg-red-400",    emoji: "!" },
  NEST_CLEANED:     { bg: "bg-lime-50",    dot: "bg-lime-600",   emoji: "♻" },
  NEST_PHOTO:       { bg: "bg-purple-50",  dot: "bg-purple-500", emoji: "📷" },
  MEDICATION_GIVEN: { bg: "bg-indigo-50",  dot: "bg-indigo-500", emoji: "💊" },
  SUPPLEMENT_GIVEN: { bg: "bg-teal-50",    dot: "bg-teal-500",   emoji: "+" },
  GENERAL_NOTE:     { bg: "bg-gray-50",    dot: "bg-gray-400",   emoji: "📝" },
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDayRange(pastDays = 28, futureDays = 7): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = -pastDays; i <= futureDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAYS = buildDayRange(28, 7);
const TODAY_KEY = dayKey(new Date());
const TODAY_IDX = DAYS.findIndex((d) => dayKey(d) === TODAY_KEY);

function formatDay(d: Date): { day: string; weekday: string; isToday: boolean; isWeekend: boolean } {
  const key = dayKey(d);
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3);
  const day = String(d.getDate()).padStart(2, "0");
  return { day, weekday, isToday: key === TODAY_KEY, isWeekend: d.getDay() === 0 || d.getDay() === 6 };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MapaTemporada() {
  const { data: couples, isLoading } = trpc.dailyCare.listActiveCouples.useQuery();
  const { data: reminders } = trpc.dailyCare.nextRingReminders.useQuery();
  const [selected, setSelected] = useState<{ coupleId: number; date: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Agrupar eventos por casal → dia
  type EventMap = Record<number, Record<string, string[]>>; // coupleId → date → eventTypes[]
  const eventMap: EventMap = {};
  if (couples) {
    for (const couple of couples as any[]) {
      eventMap[couple.coupleId] = {};
      for (const log of couple.recentLogs ?? []) {
        const dk = (log.date ?? "").slice(0, 10);
        if (!eventMap[couple.coupleId][dk]) eventMap[couple.coupleId][dk] = [];
        eventMap[couple.coupleId][dk].push(log.eventType);
      }
    }
  }

  const selectedCouple = selected
    ? (couples as any[])?.find((c: any) => c.coupleId === selected.coupleId)
    : null;
  const selectedEvents = selected
    ? eventMap[selected.coupleId]?.[selected.date] ?? []
    : [];

  const CELL_W = 40; // px por coluna de dia

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mapa da Temporada</h1>
            <p className="text-sm text-gray-500">Últimos 28 dias + próximos 7 — toque para detalhar</p>
          </div>
          <Link href="/rotina">
            <button className="flex items-center gap-1 text-sm text-amber-700 font-semibold active:opacity-70">
              Rotina <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </div>

        {/* Alertas de anilhamento próximo */}
        {(reminders ?? []).length > 0 && (
          <div className="space-y-1.5">
            {(reminders as any[]).map((r) => (
              <div key={r.id} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 border ${r.isUrgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                <span className="text-lg shrink-0">💍</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${r.isUrgent ? "text-red-700" : "text-amber-800"}`}>
                    Anilhar filhote — Gaiola {r.cageNumber}
                  </p>
                  <p className="text-xs text-gray-500">{r.isUrgent ? "⚡ HOJE!" : `Em ${r.daysLeft} dia${r.daysLeft !== 1 ? "s" : ""}`} — {new Date(r.expectedDate).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {/* Mapa horizontal */}
        {!isLoading && (couples as any[])?.length > 0 && (
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm">
            {/* Scroll container */}
            <div ref={scrollRef} className="overflow-x-auto overscroll-x-contain">
              <div style={{ minWidth: `${160 + CELL_W * DAYS.length}px` }}>

                {/* Header de datas */}
                <div className="flex sticky top-0 z-10 bg-white border-b border-gray-100">
                  <div className="w-40 shrink-0 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-100">
                    Casal
                  </div>
                  {DAYS.map((d, i) => {
                    const { day, weekday, isToday, isWeekend } = formatDay(d);
                    return (
                      <div
                        key={i}
                        style={{ width: CELL_W, minWidth: CELL_W }}
                        className={`flex flex-col items-center justify-center py-1.5 border-r border-gray-50 ${isToday ? "bg-amber-50" : isWeekend ? "bg-gray-50/60" : ""}`}
                      >
                        <span className={`text-xs font-bold ${isToday ? "text-amber-700" : "text-gray-600"}`}>{day}</span>
                        <span className={`text-xs ${isToday ? "text-amber-500" : "text-gray-400"}`}>{weekday}</span>
                        {isToday && <div className="w-1 h-1 rounded-full bg-amber-500 mt-0.5" />}
                      </div>
                    );
                  })}
                </div>

                {/* Linhas de casais */}
                {(couples as any[]).map((couple: any) => (
                  <div key={couple.coupleId} className="flex border-b border-gray-50 hover:bg-gray-50/40">
                    {/* Cabeçalho do casal */}
                    <div className="w-40 shrink-0 px-3 py-2.5 border-r border-gray-100 flex flex-col justify-center">
                      <p className="text-xs font-bold text-gray-800 truncate">Gaiola {couple.cageNumber ?? "—"}</p>
                      <p className="text-xs text-gray-400 truncate">♂{couple.maleRing} ♀{couple.femaleRing}</p>
                      {couple.alertLevel === "high" && (
                        <span className="text-xs text-red-600 font-medium">⚠️ Alerta</span>
                      )}
                    </div>

                    {/* Células por dia */}
                    {DAYS.map((d, i) => {
                      const dk = dayKey(d);
                      const events = eventMap[couple.coupleId]?.[dk] ?? [];
                      const isToday = dk === TODAY_KEY;
                      const isFuture = dk > TODAY_KEY;
                      const isSelected = selected?.coupleId === couple.coupleId && selected?.date === dk;

                      // Cor dominante do dia (prioridade: chick > broken > added > ok)
                      const dominant = events.find((e) => e.startsWith("CHICK"))
                        ?? events.find((e) => e === "EGG_BROKEN")
                        ?? events.find((e) => e === "EGG_ADDED")
                        ?? events.find((e) => e === "FEEDING_PROBLEM")
                        ?? events[0];

                      const cfg = dominant ? EVT_CONFIG[dominant] : null;

                      return (
                        <button
                          key={i}
                          style={{ width: CELL_W, minWidth: CELL_W }}
                          className={`relative flex items-center justify-center border-r border-gray-50 py-2 active:bg-amber-100 transition-colors ${
                            isSelected ? "ring-2 ring-amber-400 ring-inset z-10" : ""
                          } ${isToday ? "bg-amber-50/60" : ""} ${isFuture ? "opacity-40" : ""}`}
                          onClick={() => setSelected(events.length > 0 ? { coupleId: couple.coupleId, date: dk } : null)}
                        >
                          {events.length > 0 && cfg ? (
                            <div className={`w-6 h-6 rounded-full ${cfg.dot} flex items-center justify-center`}>
                              <span className="text-white" style={{ fontSize: "10px" }}>
                                {events.length > 1 ? events.length : cfg.emoji}
                              </span>
                            </div>
                          ) : isToday ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legenda */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-4 flex-wrap">
              {[
                { emoji: "🥚", label: "Ovo" },
                { emoji: "🐥", label: "Filhote" },
                { emoji: "💥", label: "Quebrado" },
                { emoji: "✓", label: "Alimentação" },
                { emoji: "💍", label: "Anilhado" },
              ].map(({ emoji, label }) => (
                <span key={label} className="text-xs text-gray-500 flex items-center gap-1">
                  <span>{emoji}</span>{label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Painel de detalhe do dia selecionado */}
        {selected && selectedCouple && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-bold text-amber-900 text-sm">
                Gaiola {selectedCouple.cageNumber} — {new Date(selected.date).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <button onClick={() => setSelected(null)} className="text-xs text-gray-400 active:text-gray-600">✕</button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {selectedEvents.map((ev: string, i: number) => {
                const cfg = EVT_CONFIG[ev];
                return (
                  <span key={i} className={`text-xs px-2.5 py-1 rounded-full border ${cfg?.bg ?? "bg-gray-50"} text-gray-700 border-gray-200`}>
                    {cfg?.emoji ?? "•"} {ev.replace(/_/g, " ").toLowerCase()}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {!isLoading && (couples as any[])?.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">Nenhum casal ativo. Crie casais para ver o mapa da temporada.</p>
            <Link href="/couples">
              <button className="mt-4 bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">Ir para Casais</button>
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
