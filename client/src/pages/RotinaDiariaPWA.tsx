/**
 * RotinaDiariaPWA.tsx — Interface tátil para registrar rotina do criadouro
 * Rota: /rotina
 *
 * Design:
 *  • Ícones SVG desenhados (ovo, ovo quebrado, filhote, ninho) — sem emojis
 *  • Tap/toque em ícones incrementa contadores visuais
 *  • Feedback háptico (vibration API) em cada toque
 *  • Zero digitação obrigatória — tudo por cliques
 *  • Safe area insets para iPhone/Android com notch
 */
import { useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Info, Feather } from "lucide-react";
import { Link } from "wouter";

// ─── Haptic feedback ──────────────────────────────────────────────────────────

function haptic(pattern: number | number[] = 30) {
  try { navigator.vibrate?.(pattern); } catch {}
}

// ─── SVG Icons desenhados ─────────────────────────────────────────────────────

function EggIcon({ broken = false, size = 44 }: { broken?: boolean; size?: number }) {
  if (broken) {
    return (
      <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Metade inferior */}
        <path d="M8 28 Q8 42 22 42 Q36 42 36 28" stroke="#ef4444" strokeWidth="2.5" fill="#fee2e2" />
        {/* Racha em ziguezague */}
        <path d="M16 28 L20 22 L24 26 L28 20" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Metade superior esquerda */}
        <path d="M8 28 Q8 12 22 8" stroke="#ef4444" strokeWidth="2.5" fill="none" />
        {/* Metade superior direita */}
        <path d="M36 28 Q36 12 22 8" stroke="#ef4444" strokeWidth="2.5" fill="none" />
        {/* Gota amarela (gema) */}
        <circle cx="22" cy="33" r="4.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 6 C10 6 8 18 8 26 C8 36 14 42 22 42 C30 42 36 36 36 26 C36 18 34 6 22 6Z"
        fill="#fef9c3" stroke="#d97706" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Brilho */}
      <ellipse cx="17" cy="18" rx="3" ry="5" fill="white" opacity="0.35" transform="rotate(-20 17 18)" />
    </svg>
  );
}

function ChickIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Corpo */}
      <ellipse cx="22" cy="28" rx="13" ry="10" fill="#fde68a" stroke="#d97706" strokeWidth="2" />
      {/* Cabeça */}
      <circle cx="22" cy="16" r="8" fill="#fde68a" stroke="#d97706" strokeWidth="2" />
      {/* Olho */}
      <circle cx="24.5" cy="14.5" r="1.8" fill="#1e293b" />
      <circle cx="25.2" cy="13.8" r="0.6" fill="white" />
      {/* Bico */}
      <path d="M27 16.5 L31 17 L27 17.8Z" fill="#f97316" stroke="#ea580c" strokeWidth="0.8" />
      {/* Asa esquerda */}
      <path d="M10 27 Q7 24 10 21 Q13 25 10 27Z" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
      {/* Asa direita */}
      <path d="M34 27 Q37 24 34 21 Q31 25 34 27Z" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
      {/* Peninha de topete */}
      <path d="M22 8 Q20 4 22 2 Q24 4 22 8Z" fill="#f97316" stroke="#ea580c" strokeWidth="1" />
      {/* Pé esquerdo */}
      <path d="M17 38 L15 42 M17 38 L17 42 M17 38 L19 42" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
      {/* Pé direito */}
      <path d="M27 38 L25 42 M27 38 L27 42 M27 38 L29 42" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function NestIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ninho — ramos entrelaçados */}
      <path d="M4 32 Q8 22 22 20 Q36 22 40 32" stroke="#92400e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M6 36 Q10 26 22 24 Q34 26 38 36" stroke="#a16207" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M8 38 Q12 30 22 28 Q32 30 36 38" stroke="#78350f" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Base arredondada */}
      <path d="M8 38 Q8 42 22 42 Q36 42 36 38" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
      {/* Palha */}
      <path d="M10 33 L13 29" stroke="#a16207" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M30 33 L27 29" stroke="#a16207" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M18 30 L19 26" stroke="#a16207" strokeWidth="1" strokeLinecap="round" />
      <path d="M25 30 L26 26" stroke="#a16207" strokeWidth="1" strokeLinecap="round" />
      {/* Ovinho dentro */}
      <ellipse cx="22" cy="36" rx="5" ry="4" fill="#fef9c3" stroke="#d97706" strokeWidth="1.5" />
    </svg>
  );
}

function FeedingOkIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Tigela */}
      <path d="M8 24 Q8 38 22 38 Q36 38 36 24Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
      {/* Borda */}
      <path d="M6 24 L38 24" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
      {/* Sementes */}
      <circle cx="16" cy="30" r="2.5" fill="#d97706" />
      <circle cx="22" cy="32" r="2.5" fill="#65a30d" />
      <circle cx="28" cy="30" r="2.5" fill="#d97706" />
      <circle cx="19" cy="26" r="2" fill="#a16207" />
      <circle cx="25" cy="26" r="2" fill="#65a30d" />
      {/* Check verde */}
      <circle cx="34" cy="12" r="8" fill="#22c55e" />
      <path d="M30 12 L33 15 L38 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MedicationIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cápsula */}
      <rect x="8" y="18" width="28" height="14" rx="7" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2.5" />
      <path d="M8 25 L36 25" stroke="#6366f1" strokeWidth="2" />
      {/* Metade colorida */}
      <path d="M22 18 L36 18 Q43 18 43 25 L22 25Z" fill="#6366f1" opacity="0.4" />
      {/* Cruz */}
      <path d="M20 10 L24 10 M22 8 L22 12" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="12" width="36" height="26" rx="5" fill="#f0fdf4" stroke="#22c55e" strokeWidth="2.5" />
      <circle cx="22" cy="25" r="8" fill="none" stroke="#22c55e" strokeWidth="2.5" />
      <circle cx="22" cy="25" r="4" fill="#bbf7d0" />
      <path d="M14 12 L17 6 L27 6 L30 12" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="34" cy="18" r="2.5" fill="#22c55e" />
    </svg>
  );
}

function EggClearIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ovo claro (infértil) */}
      <path d="M22 6 C10 6 8 18 8 26 C8 36 14 42 22 42 C30 42 36 36 36 26 C36 18 34 6 22 6Z"
        fill="#f8fafc" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="4 2" />
      {/* X dentro */}
      <path d="M17 21 L27 31 M27 21 L17 31" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Configuração dos botões de evento ───────────────────────────────────────

const EVENT_BUTTONS = [
  {
    group: "ovos",
    title: "Ovos",
    events: [
      { type: "EGG_ADDED",    label: "Ovo adicionado",  icon: EggIcon,      color: "from-amber-50 to-yellow-50", border: "border-amber-300", accent: "bg-amber-600" },
      { type: "EGG_BROKEN",   label: "Ovo quebrado",    icon: (p: any) => <EggIcon broken size={p.size} />, color: "from-red-50 to-rose-50", border: "border-red-300", accent: "bg-red-500" },
      { type: "EGG_INFERTILE",label: "Ovo infértil",    icon: EggClearIcon, color: "from-gray-50 to-slate-50", border: "border-gray-300", accent: "bg-gray-500" },
      { type: "EGG_LOST",     label: "Ovo perdido",     icon: EggClearIcon, color: "from-orange-50 to-red-50",  border: "border-orange-300", accent: "bg-orange-500" },
    ],
  },
  {
    group: "filhotes",
    title: "Filhotes",
    events: [
      { type: "CHICK_HATCHED",label: "Filhote nasceu",  icon: ChickIcon,    color: "from-green-50 to-emerald-50",  border: "border-green-300",  accent: "bg-green-600" },
      { type: "CHICK_RINGED", label: "Anilhado",        icon: ChickIcon,    color: "from-blue-50 to-sky-50",    border: "border-blue-300",   accent: "bg-blue-600" },
      { type: "CHICK_DIED",   label: "Filhote morreu",  icon: ChickIcon,    color: "from-red-50 to-rose-50",    border: "border-red-300",    accent: "bg-red-500" },
    ],
  },
  {
    group: "ninho",
    title: "Ninho e Manejo",
    events: [
      { type: "NEST_CLEANED", label: "Ninho limpo",     icon: NestIcon,     color: "from-lime-50 to-green-50",  border: "border-lime-300",   accent: "bg-lime-600" },
      { type: "FEEDING_OK",   label: "Alimentação OK",  icon: FeedingOkIcon,color: "from-blue-50 to-indigo-50", border: "border-blue-300",   accent: "bg-blue-600" },
      { type: "MEDICATION_GIVEN", label: "Medicação",   icon: MedicationIcon,color: "from-purple-50 to-indigo-50",border: "border-purple-300",accent: "bg-purple-600" },
      { type: "NEST_PHOTO",   label: "Foto do ninho",   icon: CameraIcon,   color: "from-green-50 to-teal-50",  border: "border-green-300",  accent: "bg-green-600" },
    ],
  },
] as const;

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RotinaDiariaPWA() {
  const { data: couples, isLoading, refetch } = trpc.dailyCare.listActiveCouples.useQuery();
  const { data: ringReminders } = trpc.dailyCare.nextRingReminders.useQuery();
  const logEvent = trpc.dailyCare.logEvent.useMutation({
    onSuccess: () => { refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [expanded, setExpanded] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<string, Record<string, number>>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const handleEvent = useCallback(
    (coupleId: number, clutchId: number | null, eventType: string) => {
      haptic(40);
      const key = `${coupleId}-${eventType}`;
      setCounts((prev) => ({
        ...prev,
        [coupleId]: {
          ...prev[coupleId],
          [eventType]: ((prev[coupleId]?.[eventType]) ?? 0) + 1,
        },
      }));
      setPending((prev) => ({ ...prev, [key]: true }));
      logEvent.mutate({
        coupleId,
        clutchId: clutchId ?? undefined,
        eventType: eventType as any,
        quantity: 1,
        autoCreateClutch: true,
      }, {
        onSettled: () => setPending((prev) => ({ ...prev, [key]: false })),
      });
    },
    [logEvent]
  );

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const totalCouples = couples?.length ?? 0;
  const doneToday = couples?.filter((c: any) => (c.todayEvents?.length ?? 0) > 0).length ?? 0;
  const progress = totalCouples > 0 ? Math.round((doneToday / totalCouples) * 100) : 0;

  return (
    <DashboardLayout>
      {/* Header fixo mobile */}
      <div className="sticky top-0 z-20 bg-amber-700 text-white shadow-lg -mx-4 px-4 pt-3 pb-3 mb-4 safe-top">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Rotina Diária</h1>
            <p className="text-amber-200 text-xs capitalize">{today}</p>
          </div>
          <button
            onClick={() => { haptic(); refetch(); }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-amber-600/60 active:bg-amber-500"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de progresso */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-amber-900/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-200 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-amber-200 shrink-0">{doneToday}/{totalCouples} casais</span>
        </div>
      </div>

      {/* Alertas urgentes de anilhamento */}
      {(ringReminders ?? []).length > 0 && (
        <div className="space-y-1.5 mb-2">
          {(ringReminders as any[]).filter((r) => r.daysLeft <= 2).map((r: any) => (
            <div key={r.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 border-2 ${r.isUrgent ? "bg-red-50 border-red-300 animate-pulse" : "bg-amber-50 border-amber-300"}`}>
              <span className="text-2xl shrink-0">💍</span>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${r.isUrgent ? "text-red-700" : "text-amber-800"}`}>
                  {r.isUrgent ? "⚡ ANILHAR HOJE!" : `Anilhar em ${r.daysLeft} dia${r.daysLeft !== 1 ? "s" : ""}`}
                </p>
                <p className="text-xs text-gray-500">Gaiola {r.cageNumber} — {new Date(r.expectedDate).toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && totalCouples === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <NestIcon size={72} />
          <p className="text-gray-500 text-center text-sm">Nenhum casal ativo encontrado.<br />Cadastre casais primeiro.</p>
          <Link href="/couples">
            <button className="bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold text-sm active:bg-amber-700">
              Ir para Casais →
            </button>
          </Link>
        </div>
      )}

      <div className="space-y-3 pb-24">
        {(couples as any[])?.map((couple: any) => {
          const isOpen = expanded === couple.coupleId;
          const todayEvents: string[] = couple.todayEvents ?? [];
          const done = todayEvents.length > 0;
          const localCounts = counts[couple.coupleId] ?? {};
          const activeClutch = couple.clutches?.find((c: any) => c.status === "active");

          return (
            <div
              key={couple.coupleId}
              className={`rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
                done ? "border-emerald-300 bg-emerald-50/40" : "border-gray-200 bg-white"
              }`}
            >
              {/* Header do casal — toque para expandir */}
              <button
                className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50 transition-colors"
                onClick={() => { haptic(20); setExpanded(isOpen ? null : couple.coupleId); }}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-100" : "bg-amber-50"}`}>
                  {done
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    : <NestIcon size={28} />
                  }
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">Gaiola {couple.cageNumber ?? "—"}</span>
                    {couple.alertLevel === "high" && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">⚠️ Alerta</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    ♂ {couple.maleRing} · ♀ {couple.femaleRing}
                  </p>
                  {/* Mini indicadores de hoje */}
                  {todayEvents.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {todayEvents.slice(0, 4).map((ev, i) => (
                        <span key={i} className="text-xs bg-amber-100 text-amber-700 px-1.5 rounded-full">
                          {ev === "EGG_ADDED" ? "🥚" : ev === "CHICK_HATCHED" ? "🐥" : ev === "EGG_BROKEN" ? "💥" : ev === "FEEDING_OK" ? "✅" : "•"}
                        </span>
                      ))}
                      {todayEvents.length > 4 && <span className="text-xs text-gray-400">+{todayEvents.length - 4}</span>}
                    </div>
                  )}
                </div>
                {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
              </button>

              {/* Painel de eventos — expande ao toque */}
              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50/60 px-3 pt-3 pb-4">

                  {/* Status da postura ativa */}
                  {activeClutch && (
                    <div className="flex items-center gap-3 mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(activeClutch.totalEggs ?? 0, 8) }).map((_, i) => (
                          <EggIcon key={i} size={20} />
                        ))}
                      </div>
                      <div className="text-xs text-amber-800">
                        <span className="font-bold">{activeClutch.totalEggs ?? 0} ovos</span>
                        {activeClutch.hatchedChicks > 0 && <span className="ml-2 font-bold text-green-700">{activeClutch.hatchedChicks} filhotes</span>}
                      </div>
                    </div>
                  )}

                  {/* Grupos de botões de evento */}
                  {EVENT_BUTTONS.map((group) => (
                    <div key={group.group} className="mb-3">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2 px-1">{group.title}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {group.events.map((ev) => {
                          const count = localCounts[ev.type] ?? 0;
                          const key = `${couple.coupleId}-${ev.type}`;
                          const isLoading = pending[key];
                          const IconComp = ev.icon as any;

                          return (
                            <button
                              key={ev.type}
                              className={`relative flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 bg-gradient-to-b ${ev.color} ${ev.border} active:scale-95 active:brightness-95 transition-all duration-100 touch-manipulation select-none`}
                              onClick={() => handleEvent(couple.coupleId, activeClutch?.id ?? null, ev.type)}
                              disabled={isLoading}
                            >
                              <div className={isLoading ? "opacity-50" : ""}>
                                <IconComp size={38} />
                              </div>
                              <span className="text-center text-gray-700 leading-tight" style={{ fontSize: "10px" }}>
                                {ev.label}
                              </span>
                              {count > 0 && (
                                <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 ${ev.accent} text-white text-xs font-bold rounded-full flex items-center justify-center shadow`}>
                                  {count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Alertas do casal */}
                  {couple.alerts?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {couple.alerts.map((a: any, i: number) => (
                        <div key={i} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${a.severity === "high" ? "bg-red-100 text-red-700" : a.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          {a.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom safe area para iPhone */}
      <div className="h-6 safe-bottom" />
    </DashboardLayout>
  );
}
