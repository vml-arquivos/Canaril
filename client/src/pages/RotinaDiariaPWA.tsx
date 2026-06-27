/**
 * RotinaDiariaPWA.tsx — Interface tátil para registrar rotina do criadouro
 *
 * Correções v2:
 *  - Cada evento tem ícone SVG único e inconfundível
 *  - NEST_PHOTO abre câmera nativa via input[type=file capture=environment]
 *  - Ovo infértil ≠ Ovo perdido (ícones distintos)
 *  - Filhote nasceu ≠ Anilhado ≠ Filhote morreu (ícones distintos)
 *  - Ninho limpo com ícone real de ninho + vassoura
 */
import { useState, useCallback, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, RefreshCw, Info } from "lucide-react";
import { Link } from "wouter";

function haptic(ms = 30) { try { navigator.vibrate?.(ms); } catch {} }

// ─── SVG Icons — cada um único e semanticamente claro ────────────────────────

/** Ovo intacto — amarelo, brilho */
function SvgOvoAdicionado({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <path d="M22 5C10 5 8 18 8 26C8 36.5 14 42 22 42C30 42 36 36.5 36 26C36 18 34 5 22 5Z"
        fill="#fef9c3" stroke="#d97706" strokeWidth="2.5"/>
      <ellipse cx="16" cy="17" rx="3" ry="5" fill="white" opacity="0.4" transform="rotate(-20 16 17)"/>
      <text x="30" y="16" fontSize="12" textAnchor="middle">+</text>
    </svg>
  );
}

/** Ovo quebrado — rachado com gema visível */
function SvgOvoQuebrado({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Metade inferior */}
      <path d="M8 27Q8 42 22 42Q36 42 36 27" fill="#fee2e2" stroke="#ef4444" strokeWidth="2"/>
      {/* Racha ziguezague */}
      <path d="M15 27L19 21L23 25L27 19" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Casca esquerda */}
      <path d="M8 27Q8 12 22 7" stroke="#ef4444" strokeWidth="2" fill="none"/>
      {/* Casca direita */}
      <path d="M36 27Q36 12 22 7" stroke="#ef4444" strokeWidth="2" fill="none"/>
      {/* Gema */}
      <circle cx="22" cy="35" r="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
    </svg>
  );
}

/** Ovo infértil — ovo cinza com lupa/ponto de interrogação */
function SvgOvoInfertil({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <path d="M22 6C10 6 8 18 8 26C8 36 14 42 22 42C30 42 36 36 36 26C36 18 34 6 22 6Z"
        fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2.5"/>
      {/* Ponto de interrogação dentro */}
      <text x="22" y="28" fontSize="16" textAnchor="middle" fill="#64748b" fontWeight="bold">?</text>
      {/* Pequena lupa no canto superior direito */}
      <circle cx="33" cy="12" r="5.5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5"/>
      <line x1="37" y1="16" x2="40" y2="19" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

/** Ovo perdido — ovo saindo do ninho com seta indicando queda */
function SvgOvoPerdido({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Ovo inclinado */}
      <path d="M18 4C8 4 6 15 6 22C6 31 11 36 18 36C25 36 30 31 30 22C30 15 28 4 18 4Z"
        fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" transform="rotate(-20 18 20)"/>
      {/* Seta de queda */}
      <path d="M32 22L36 30L40 22" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <line x1="36" y1="16" x2="36" y2="30" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Filhote nasceu — pintinho saindo do ovo */
function SvgFilhoteNasceu({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Casca inferior do ovo */}
      <path d="M8 32Q8 42 22 42Q36 42 36 32Z" fill="#fef9c3" stroke="#d97706" strokeWidth="2"/>
      {/* Racha */}
      <path d="M14 32L18 26L22 30L26 24L30 28" stroke="#d97706" strokeWidth="2" strokeLinecap="round"/>
      {/* Cabeça do pintinho emergindo */}
      <circle cx="22" cy="20" r="9" fill="#fde68a" stroke="#d97706" strokeWidth="2"/>
      {/* Olho */}
      <circle cx="25" cy="18" r="2" fill="#1e293b"/>
      <circle cx="25.7" cy="17.3" r="0.7" fill="white"/>
      {/* Bico aberto */}
      <path d="M27 20L31 19.5M27 20L31 21" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Peninha */}
      <path d="M22 11Q20 7 22 4Q24 7 22 11Z" fill="#f97316"/>
    </svg>
  );
}

/** Anilhado — pintinho com anilha metálica visível na pata */
function SvgAnilhado({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Corpo */}
      <ellipse cx="22" cy="29" rx="13" ry="10" fill="#fde68a" stroke="#d97706" strokeWidth="2"/>
      {/* Cabeça */}
      <circle cx="22" cy="17" r="8" fill="#fde68a" stroke="#d97706" strokeWidth="2"/>
      {/* Olho */}
      <circle cx="24.5" cy="15.5" r="1.8" fill="#1e293b"/>
      {/* Bico */}
      <path d="M27 17L30.5 17.5L27 18Z" fill="#f97316" stroke="#ea580c" strokeWidth="0.8"/>
      {/* Asas */}
      <path d="M10 28Q7 25 10 22Q13 26 10 28Z" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5"/>
      <path d="M34 28Q37 25 34 22Q31 26 34 28Z" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5"/>
      {/* Pata esquerda com ANILHA */}
      <line x1="17" y1="39" x2="15" y2="43" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Anilha metálica — anel azul brilhante */}
      <rect x="13.5" y="37" width="7" height="4" rx="2" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1.5"/>
      <text x="17" y="40.5" fontSize="4" textAnchor="middle" fill="white" fontWeight="bold">ID</text>
      {/* Pata direita */}
      <line x1="27" y1="39" x2="29" y2="43" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Filhote morreu — pintinho com X vermelho, escurecido */
function SvgFilhoteMorreu({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Corpo apagado */}
      <ellipse cx="22" cy="29" rx="13" ry="10" fill="#f8d7da" stroke="#ef4444" strokeWidth="2"/>
      <circle cx="22" cy="17" r="8" fill="#f8d7da" stroke="#ef4444" strokeWidth="2"/>
      {/* X vermelho grande */}
      <line x1="15" y1="10" x2="29" y2="38" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
      <line x1="29" y1="10" x2="15" y2="38" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
      {/* Contorno do pintinho */}
      <ellipse cx="22" cy="29" rx="13" ry="10" fill="none" stroke="#ef4444" strokeWidth="2"/>
      <circle cx="22" cy="17" r="8" fill="none" stroke="#ef4444" strokeWidth="2"/>
    </svg>
  );
}

/** Ninho limpo — ninho de palha com estrela de limpeza */
function SvgNinhoLimpo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Ninho palha */}
      <path d="M5 30Q5 44 22 44Q39 44 39 30" fill="#fef3c7" stroke="#a16207" strokeWidth="2"/>
      <path d="M5 30Q9 20 22 18Q35 20 39 30" stroke="#a16207" strokeWidth="2" fill="none"/>
      <path d="M7 34Q11 26 22 24Q33 26 37 34" stroke="#d97706" strokeWidth="1.5" fill="none"/>
      {/* Palha */}
      <line x1="11" y1="29" x2="13" y2="24" stroke="#92400e" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="29" y1="29" x2="27" y2="24" stroke="#92400e" strokeWidth="1.2" strokeLinecap="round"/>
      {/* Estrela de limpeza / brilho no canto */}
      <g transform="translate(31,8)">
        <path d="M0,-7 L1.5,-1.5 L7,0 L1.5,1.5 L0,7 L-1.5,1.5 L-7,0 L-1.5,-1.5Z"
          fill="#fbbf24" stroke="#f59e0b" strokeWidth="1"/>
      </g>
      {/* Vassoura pequena */}
      <line x1="34" y1="20" x2="28" y2="30" stroke="#92400e" strokeWidth="2" strokeLinecap="round"/>
      <path d="M25 32L28 30L31 33Z" fill="#92400e"/>
    </svg>
  );
}

/** Alimentação OK — tigela cheia com check */
function SvgAlimentacaoOk({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Tigela */}
      <path d="M7 22Q7 38 22 38Q37 38 37 22Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2.5"/>
      <line x1="5" y1="22" x2="39" y2="22" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Sementes variadas */}
      <ellipse cx="14" cy="29" rx="3" ry="2" fill="#d97706" transform="rotate(-15 14 29)"/>
      <ellipse cx="22" cy="31" rx="3" ry="2" fill="#65a30d" transform="rotate(10 22 31)"/>
      <ellipse cx="30" cy="29" rx="3" ry="2" fill="#d97706" transform="rotate(-10 30 29)"/>
      <circle cx="18" cy="26" r="2" fill="#a16207"/>
      <circle cx="26" cy="26" r="2" fill="#65a30d"/>
      {/* Check verde no canto */}
      <circle cx="35" cy="10" r="7" fill="#22c55e"/>
      <path d="M31 10L34 13L39 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Medicação — seringa específica */
function SvgMedicacao({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Seringa corpo */}
      <rect x="8" y="19" width="24" height="9" rx="3" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2"/>
      {/* Êmbolo */}
      <rect x="9" y="21" width="10" height="5" rx="1" fill="#a5b4fc"/>
      <line x1="14" y1="19" x2="14" y2="28" stroke="#6366f1" strokeWidth="1.5"/>
      {/* Ponta/agulha */}
      <path d="M32 22L40 23.5L32 25Z" fill="#6366f1"/>
      {/* Cabo */}
      <rect x="4" y="21" width="5" height="5" rx="1" fill="#6366f1"/>
      {/* Cruz vermelha */}
      <circle cx="36" cy="10" r="7" fill="#ef4444"/>
      <line x1="36" y1="6.5" x2="36" y2="13.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="32.5" y1="10" x2="39.5" y2="10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Foto — câmera real com obturador visível */
function SvgFotoNinho({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Corpo câmera */}
      <rect x="4" y="13" width="36" height="25" rx="5" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
      {/* Lente */}
      <circle cx="22" cy="25" r="9" fill="#0f172a" stroke="#64748b" strokeWidth="2"/>
      <circle cx="22" cy="25" r="6.5" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5"/>
      <circle cx="22" cy="25" r="3.5" fill="#3b82f6" opacity="0.6"/>
      <circle cx="20" cy="23" r="1.2" fill="white" opacity="0.5"/>
      {/* Flash */}
      <rect x="30" y="16" width="6" height="4" rx="1" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1"/>
      {/* Botão obturador */}
      <circle cx="8" cy="13" r="3" fill="#475569" stroke="#64748b" strokeWidth="1"/>
      {/* Visor */}
      <rect x="27" y="8" width="10" height="6" rx="2" fill="#334155" stroke="#64748b" strokeWidth="1"/>
    </svg>
  );
}

// ─── Configuração dos botões ──────────────────────────────────────────────────

const EVENT_BUTTONS = [
  {
    group: "ovos",
    title: "Ovos",
    events: [
      { type: "EGG_ADDED",     label: "Ovo adicionado", Icon: SvgOvoAdicionado, bg: "bg-amber-50",   border: "border-amber-300",  badge: "bg-amber-600" },
      { type: "EGG_BROKEN",    label: "Ovo quebrado",   Icon: SvgOvoQuebrado,   bg: "bg-red-50",    border: "border-red-300",    badge: "bg-red-600" },
      { type: "EGG_INFERTILE", label: "Ovo infértil",   Icon: SvgOvoInfertil,   bg: "bg-slate-50",  border: "border-slate-300",  badge: "bg-slate-500" },
      { type: "EGG_LOST",      label: "Ovo perdido",    Icon: SvgOvoPerdido,    bg: "bg-orange-50", border: "border-orange-300", badge: "bg-orange-600" },
    ],
  },
  {
    group: "filhotes",
    title: "Filhotes",
    events: [
      { type: "CHICK_HATCHED", label: "Filhote nasceu", Icon: SvgFilhoteNasceu, bg: "bg-green-50",  border: "border-green-400",  badge: "bg-green-600" },
      { type: "CHICK_RINGED",  label: "Anilhado",       Icon: SvgAnilhado,      bg: "bg-blue-50",   border: "border-blue-400",   badge: "bg-blue-700" },
      { type: "CHICK_DIED",    label: "Filhote morreu", Icon: SvgFilhoteMorreu, bg: "bg-red-50",    border: "border-red-400",    badge: "bg-red-700" },
    ],
  },
  {
    group: "manejo",
    title: "Ninho e Manejo",
    events: [
      { type: "NEST_CLEANED",     label: "Ninho limpo",    Icon: SvgNinhoLimpo,    bg: "bg-lime-50",   border: "border-lime-400",   badge: "bg-lime-700" },
      { type: "FEEDING_OK",       label: "Alimentação OK", Icon: SvgAlimentacaoOk, bg: "bg-sky-50",    border: "border-sky-400",    badge: "bg-sky-700" },
      { type: "MEDICATION_GIVEN", label: "Medicação",      Icon: SvgMedicacao,     bg: "bg-indigo-50", border: "border-indigo-400", badge: "bg-indigo-700" },
      { type: "NEST_PHOTO",       label: "Foto do ninho",  Icon: SvgFotoNinho,     bg: "bg-gray-50",   border: "border-gray-400",   badge: "bg-gray-700", isCamera: true },
    ],
  },
] as const;

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RotinaDiariaPWA() {
  const { data: couples, isLoading, refetch } = trpc.dailyCare.listActiveCouples.useQuery();
  const { data: ringReminders } = trpc.dailyCare.nextRingReminders.useQuery();
  const logEvent = trpc.dailyCare.logEvent.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  const [expanded, setExpanded] = useState<number | null>(null);
  const [counts, setCounts]   = useState<Record<string, Record<string, number>>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // Ref para o input de câmera — um por sessão, reutilizado
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cameraContext  = useRef<{ coupleId: number; clutchId: number | null } | null>(null);

  // ── Câmera nativa ────────────────────────────────────────────────────────────
  const openCamera = useCallback((coupleId: number, clutchId: number | null) => {
    haptic(40);
    cameraContext.current = { coupleId, clutchId };
    cameraInputRef.current?.click();
  }, []);

  const handlePhotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cameraContext.current) return;
    const { coupleId, clutchId } = cameraContext.current;

    // Converter para base64 para envio (ou usar URL.createObjectURL para preview)
    const url = URL.createObjectURL(file);

    const key = `${coupleId}-NEST_PHOTO`;
    setPending((p) => ({ ...p, [key]: true }));
    setCounts((p) => ({
      ...p,
      [coupleId]: { ...p[coupleId], NEST_PHOTO: (p[coupleId]?.NEST_PHOTO ?? 0) + 1 },
    }));

    logEvent.mutate({
      coupleId,
      clutchId: clutchId ?? undefined,
      eventType: "NEST_PHOTO",
      quantity: 1,
      photoUrl: url,
    }, {
      onSettled: () => setPending((p) => ({ ...p, [key]: false })),
      onSuccess: () => toast.success("Foto do ninho registrada!"),
    });

    // Limpar input para permitir nova foto
    e.target.value = "";
  }, [logEvent]);

  // ── Evento comum ─────────────────────────────────────────────────────────────
  const handleEvent = useCallback(
    (coupleId: number, clutchId: number | null, eventType: string) => {
      haptic(40);
      const key = `${coupleId}-${eventType}`;
      setCounts((p) => ({
        ...p,
        [coupleId]: { ...p[coupleId], [eventType]: (p[coupleId]?.[eventType] ?? 0) + 1 },
      }));
      setPending((p) => ({ ...p, [key]: true }));
      logEvent.mutate({
        coupleId,
        clutchId: clutchId ?? undefined,
        eventType: eventType as any,
        quantity: 1,
        autoCreateClutch: true,
      }, {
        onSettled: () => setPending((p) => ({ ...p, [key]: false })),
      });
    },
    [logEvent]
  );

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const total = couples?.length ?? 0;
  const done  = (couples as any[])?.filter((c: any) => (c.todayEvents?.length ?? 0) > 0).length ?? 0;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <DashboardLayout>
      {/* Input câmera oculto */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {/* Header fixo */}
      <div className="sticky top-0 z-20 bg-amber-700 text-white shadow-lg -mx-4 px-4 pt-3 pb-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold">Rotina Diária</h1>
            <p className="text-amber-200 text-xs capitalize">{today}</p>
          </div>
          <button onClick={() => { haptic(); refetch(); }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-amber-600/60 active:bg-amber-500">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-amber-900/40 rounded-full overflow-hidden">
            <div className="h-full bg-amber-200 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}/>
          </div>
          <span className="text-xs text-amber-200 shrink-0">{done}/{total} casais</span>
        </div>
      </div>

      {/* Alertas de anilhamento urgente */}
      {(ringReminders as any[])?.filter((r: any) => r.daysLeft <= 2).map((r: any) => (
        <div key={r.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 mb-3 border-2 ${r.isUrgent ? "bg-red-50 border-red-300 animate-pulse" : "bg-amber-50 border-amber-300"}`}>
          <SvgAnilhado size={36} />
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm ${r.isUrgent ? "text-red-700" : "text-amber-800"}`}>
              {r.isUrgent ? "⚡ Anilhar HOJE!" : `Anilhar em ${r.daysLeft} dia${r.daysLeft !== 1 ? "s" : ""}`}
            </p>
            <p className="text-xs text-gray-500">Gaiola {r.cageNumber} — {new Date(r.expectedDate).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse"/>)}
        </div>
      )}

      {!isLoading && total === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <SvgNinhoLimpo size={72}/>
          <p className="text-gray-500 text-center text-sm">Nenhum casal ativo.<br/>Cadastre casais primeiro.</p>
          <Link href="/couples">
            <button className="bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold text-sm active:bg-amber-700">
              Ir para Casais →
            </button>
          </Link>
        </div>
      )}

      <div className="space-y-3 pb-24">
        {(couples as any[])?.map((couple: any) => {
          const isOpen   = expanded === couple.coupleId;
          const todayEvt = couple.todayEvents ?? [];
          const done     = todayEvt.length > 0;
          const localCnt = counts[couple.coupleId] ?? {};
          const clutch   = couple.clutches?.find((c: any) => c.status === "active");

          return (
            <div key={couple.coupleId}
              className={`rounded-2xl border-2 overflow-hidden transition-all ${done ? "border-emerald-300 bg-emerald-50/40" : "border-gray-200 bg-white"}`}>

              {/* Header do casal */}
              <button className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50"
                onClick={() => { haptic(20); setExpanded(isOpen ? null : couple.coupleId); }}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-100" : "bg-amber-50"}`}>
                  {done
                    ? <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 10l5 5 7-8" stroke="#16a34a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <SvgNinhoLimpo size={28}/>
                  }
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">Gaiola {couple.cageNumber ?? "—"}</span>
                    {couple.alertLevel === "high" && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">⚠️</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">♂ {couple.maleRing} · ♀ {couple.femaleRing}</p>
                  {todayEvt.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {todayEvt.slice(0, 5).map((ev: string, i: number) => (
                        <span key={i} className="text-xs bg-amber-100 text-amber-700 px-1.5 rounded-full">
                          {ev === "EGG_ADDED" ? "🥚" : ev === "CHICK_HATCHED" ? "🐣" : ev === "CHICK_RINGED" ? "💍" : ev === "EGG_BROKEN" ? "💥" : ev === "NEST_PHOTO" ? "📷" : "•"}
                        </span>
                      ))}
                      {todayEvt.length > 5 && <span className="text-xs text-gray-400">+{todayEvt.length - 5}</span>}
                    </div>
                  )}
                </div>
                {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0"/> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0"/>}
              </button>

              {/* Painel expandido */}
              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50/40 px-3 pt-3 pb-4">

                  {/* Status da postura ativa */}
                  {clutch && (
                    <div className="flex items-center gap-2 mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <div className="flex gap-0.5 flex-wrap">
                        {Array.from({ length: Math.min(clutch.totalEggs ?? 0, 8) }).map((_, i) => (
                          <SvgOvoAdicionado key={i} size={18}/>
                        ))}
                      </div>
                      <div className="text-xs text-amber-800 ml-1">
                        <span className="font-bold">{clutch.totalEggs ?? 0} ovos</span>
                        {clutch.hatchedChicks > 0 && (
                          <span className="ml-2 font-bold text-green-700">{clutch.hatchedChicks} filhotes</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Botões por grupo */}
                  {EVENT_BUTTONS.map((group) => (
                    <div key={group.group} className="mb-4">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2 px-0.5">{group.title}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {group.events.map((ev) => {
                          const cnt   = localCnt[ev.type] ?? 0;
                          const key   = `${couple.coupleId}-${ev.type}`;
                          const busy  = pending[key];
                          const { Icon, isCamera } = ev as any;

                          return (
                            <button
                              key={ev.type}
                              disabled={busy}
                              className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 ${ev.bg} ${ev.border} active:scale-95 active:brightness-90 transition-all duration-100 touch-manipulation select-none ${busy ? "opacity-50" : ""}`}
                              onClick={() => {
                                if (isCamera) {
                                  openCamera(couple.coupleId, clutch?.id ?? null);
                                } else {
                                  handleEvent(couple.coupleId, clutch?.id ?? null, ev.type);
                                }
                              }}
                            >
                              <Icon size={38}/>
                              <span className="text-center text-gray-700 leading-tight" style={{ fontSize: "10px" }}>
                                {ev.label}
                              </span>
                              {cnt > 0 && (
                                <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 ${ev.badge} text-white text-xs font-bold rounded-full flex items-center justify-center shadow-sm`}>
                                  {cnt}
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
                    <div className="space-y-1 mt-1">
                      {couple.alerts.map((a: any, i: number) => (
                        <div key={i} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${a.severity === "high" ? "bg-red-100 text-red-700" : a.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                          <Info className="w-3.5 h-3.5 shrink-0"/>{a.message}
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

      <div className="h-6"/>
    </DashboardLayout>
  );
}
