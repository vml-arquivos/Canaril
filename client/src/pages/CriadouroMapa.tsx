/**
 * CriadouroMapa.tsx — Mapa Visual do Criadouro
 *
 * Grid visual de gaiolas por setor. Cada gaiola mostra status visual
 * (livre/ocupada/reprodução/manutenção), casal vinculado e alertas.
 * Clique na gaiola abre painel de detalhes.
 */
import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Heart, Search, Bird, AlertTriangle, Wrench, CheckCircle2, X } from "lucide-react";
import { Link } from "wouter";

// ─── Tipos ─────────────────────────────────────────────────────────────────

type CageStatus = "free" | "occupied" | "maintenance" | "breeding";

interface CageCard {
  id: number;
  code: string;
  section: string | null;
  capacity: number;
  status: CageStatus;
  notes: string | null;
  couple?: {
    id: number;
    maleRing: string;
    femaleRing: string;
    hasActiveClutch: boolean;
  } | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CageStatus, { label: string; bg: string; border: string; text: string; dot: string }> = {
  free: { label: "Livre", bg: "bg-green-50", border: "border-green-300", text: "text-green-800", dot: "bg-green-400" },
  occupied: { label: "Ocupada", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-800", dot: "bg-blue-500" },
  breeding: { label: "Reprodução", bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-800", dot: "bg-rose-500" },
  maintenance: { label: "Manutenção", bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", dot: "bg-amber-400" },
};

function CageCardTile({ cage, onClick, selected }: { cage: CageCard; onClick: () => void; selected: boolean }) {
  const cfg = STATUS_CONFIG[cage.status];
  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-xl border-2 p-3 text-left cursor-pointer transition-all
        ${cfg.bg} ${cfg.border}
        ${selected ? "ring-2 ring-offset-1 ring-amber-500 shadow-md scale-[1.02]" : "hover:shadow-sm hover:scale-[1.01]"}
      `}
    >
      {/* Status dot */}
      <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
      {/* Código */}
      <p className="font-mono font-bold text-gray-900 text-sm truncate pr-4">{cage.code}</p>
      {/* Setor */}
      {cage.section && <p className="text-xs text-gray-400 truncate">{cage.section}</p>}
      {/* Status badge */}
      <Badge className={`text-xs mt-1.5 ${cfg.bg} ${cfg.text} border-0`}>{cfg.label}</Badge>
      {/* Casal */}
      {cage.couple && (
        <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
          <Heart className="w-3 h-3 text-rose-400 shrink-0" />
          <span className="truncate">{cage.couple.maleRing} × {cage.couple.femaleRing}</span>
        </div>
      )}
      {/* Postura ativa */}
      {cage.couple?.hasActiveClutch && (
        <p className="text-xs text-rose-600 mt-0.5 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
          Postura ativa
        </p>
      )}
    </button>
  );
}

function CageDetailPanel({ cage, onClose }: { cage: CageCard; onClose: () => void }) {
  const cfg = STATUS_CONFIG[cage.status];
  return (
    <Card className={`border-2 ${cfg.border} sticky top-4`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-mono">{cage.code}</CardTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <CardDescription>{cage.section ?? "Sem setor definido"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
          <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
        </div>
        <div className="text-gray-500">Capacidade: <span className="text-gray-900 font-medium">{cage.capacity}</span></div>
        {cage.notes && <p className="text-gray-500 text-xs italic">"{cage.notes}"</p>}
        {cage.couple ? (
          <div className="bg-rose-50 rounded-lg p-3 border border-rose-100 space-y-1">
            <p className="font-semibold text-rose-800 text-xs uppercase tracking-wide">Casal vinculado</p>
            <div className="flex items-center gap-1.5 text-rose-700">
              <Heart className="w-4 h-4" />
              <span className="font-mono text-sm">{cage.couple.maleRing}</span>
              <span>×</span>
              <span className="font-mono text-sm">{cage.couple.femaleRing}</span>
            </div>
            {cage.couple.hasActiveClutch && (
              <Badge className="bg-rose-100 text-rose-800 text-xs">Postura ativa</Badge>
            )}
          </div>
        ) : cage.status === "free" ? (
          <div className="bg-green-50 rounded-lg p-3 border border-green-100 text-green-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Gaiola disponível para novo casal
          </div>
        ) : null}
        <div className="flex gap-2 pt-2">
          <Link href="/cages">
            <Button variant="outline" size="sm" className="text-xs">
              <Wrench className="w-3.5 h-3.5 mr-1" />
              Editar
            </Button>
          </Link>
          {cage.couple && (
            <Link href="/couples">
              <Button variant="outline" size="sm" className="text-xs">
                <Heart className="w-3.5 h-3.5 mr-1" />
                Ver casal
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────

export default function CriadouroMapa() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: cagesRaw } = trpc.cages.list.useQuery();
  // couples loaded via temporada/casaisReproducao
  // Fallback: load couples via birds router-context
  // stats for dashboard (unused in this component, skip query)
  const { data: couplesList } = trpc.reports.casaisReproducao.useQuery();
  const { data: clutches } = trpc.reports.temporada.useQuery();

  // Build enriched cage cards
  const cages: CageCard[] = useMemo(() => {
    if (!cagesRaw) return [];

    // Map casal by cageNumber
    const couplesByCage = new Map<string, any>();
    if (couplesList?.rows) {
      for (const c of couplesList.rows) {
        if (c.status === "active") {
          couplesByCage.set(String(c.coupleId), c as any);
        }
      }
    }

    // Casais ativos e gaiola
    const activeCouplesResumo = clutches?.casaisResumo ?? [];
    const couplesByCageNumber = new Map<string, (typeof activeCouplesResumo)[0]>();
    for (const c of activeCouplesResumo) {
      if (c.cageNumber) couplesByCageNumber.set(c.cageNumber, c);
    }

    return cagesRaw.map((cage) => {
      const couple = couplesByCageNumber.get(cage.code);
      let status: CageStatus = cage.status as CageStatus;
      if (couple) {
        status = couple.clutchesCount > 0 ? "breeding" : "occupied";
      }

      return {
        id: cage.id,
        code: cage.code,
        section: cage.section,
        capacity: cage.capacity,
        status,
        notes: cage.notes,
        couple: couple ? {
          id: couple.coupleId,
          maleRing: couple.maleRing,
          femaleRing: couple.femaleRing,
          hasActiveClutch: couple.clutchesCount > 0,
        } : null,
      };
    });
  }, [cagesRaw, couplesList, clutches]);

  const sectors = useMemo(() => {
    const s = new Set(cages.map((c) => c.section ?? "Sem setor"));
    return Array.from(s).sort();
  }, [cages]);

  const filtered = useMemo(() => {
    return cages.filter((c) => {
      if (search && !c.code.toLowerCase().includes(search.toLowerCase()) &&
          !(c.couple?.maleRing ?? "").toLowerCase().includes(search.toLowerCase()) &&
          !(c.couple?.femaleRing ?? "").toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (sectorFilter !== "all" && (c.section ?? "Sem setor") !== sectorFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [cages, search, sectorFilter, statusFilter]);

  const selectedCage = cages.find((c) => c.id === selectedId) ?? null;

  const statusCounts = useMemo(() => ({
    free: cages.filter((c) => c.status === "free").length,
    occupied: cages.filter((c) => c.status === "occupied" || c.status === "breeding").length,
    maintenance: cages.filter((c) => c.status === "maintenance").length,
  }), [cages]);

  // Group by sector
  const bySector = useMemo(() => {
    const map = new Map<string, CageCard[]>();
    for (const cage of filtered) {
      const s = cage.section ?? "Sem setor";
      const list = map.get(s) ?? [];
      list.push(cage);
      map.set(s, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mapa do Criadouro</h1>
            <p className="text-gray-500 mt-1">Visualização das gaiolas por setor</p>
          </div>
          <div className="flex gap-3 text-xs text-gray-500 items-center">
            {[
              { label: "Livres", count: statusCounts.free, dot: "bg-green-400" },
              { label: "Ocupadas", count: statusCounts.occupied, dot: "bg-blue-500" },
              { label: "Manutenção", count: statusCounts.maintenance, dot: "bg-amber-400" },
            ].map(({ label, count, dot }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                {count} {label}
              </div>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
            <Input placeholder="Buscar gaiola ou anilha..." className="pl-8 w-52" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="free">Livres</SelectItem>
              <SelectItem value="occupied">Ocupadas</SelectItem>
              <SelectItem value="breeding">Em reprodução</SelectItem>
              <SelectItem value="maintenance">Manutenção</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/cages">
            <Button variant="outline" size="sm">Gerenciar gaiolas</Button>
          </Link>
        </div>

        {cages.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Bird className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma gaiola cadastrada.</p>
            <Link href="/cages"><Button variant="outline" size="sm" className="mt-3">Cadastrar gaiolas</Button></Link>
          </div>
        )}

        <div className={selectedCage ? "grid lg:grid-cols-[1fr_280px] gap-6" : ""}>
          {/* Grid de gaiolas por setor */}
          <div className="space-y-6">
            {bySector.map(([sector, sectorCages]) => (
              <div key={sector}>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{sector}</p>
                  <span className="text-xs text-gray-400">({sectorCages.length} gaiola{sectorCages.length !== 1 ? "s" : ""})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {sectorCages.map((cage) => (
                    <CageCardTile
                      key={cage.id}
                      cage={cage}
                      onClick={() => setSelectedId(selectedId === cage.id ? null : cage.id)}
                      selected={selectedId === cage.id}
                    />
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && cages.length > 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">Nenhuma gaiola com os filtros aplicados.</p>
            )}
          </div>

          {/* Painel de detalhes */}
          {selectedCage && (
            <div>
              <CageDetailPanel cage={selectedCage} onClose={() => setSelectedId(null)} />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
