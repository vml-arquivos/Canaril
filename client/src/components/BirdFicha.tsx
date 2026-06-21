import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { SPECIALTIES, COLORS, SEXES } from "@shared/constants";
import { Bird as BirdIcon, GitBranch, Edit2, Calendar, MapPin, Ruler, Scale, Loader2, Sparkles, Dna, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, HelpCircle, Info } from "lucide-react";
import { Link } from "wouter";

type BirdRecord = {
  id: number;
  ring: string;
  displayTitle?: string | null;
  nickname?: string | null;
  speciesName?: string | null;
  modality?: string | null;
  breedName?: string | null;
  officialClassId?: number | null;
  specialty_code: string;
  color_code: string;
  sex: string;
  birthDate: string | Date | null;
  procedence: string | null;
  status: string;
  fatherId: number | null;
  motherId: number | null;
  notes: string | null;
};

function calculateAge(birthDate: string | Date | null): string {
  if (!birthDate) return "—";
  const birth = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months--;
  if (months < 1) return "menos de 1 mês";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths === 0 ? `${years} ${years === 1 ? "ano" : "anos"}` : `${years}a ${remMonths}m`;
}

const riskConfig = {
  low: { label: "Risco baixo", className: "bg-green-100 text-green-800" },
  moderate: { label: "Risco moderado", className: "bg-yellow-100 text-yellow-800" },
  high: { label: "Risco alto", className: "bg-red-100 text-red-800" },
};

export function BirdFicha({
  bird,
  onClose,
  onEdit,
}: {
  bird: BirdRecord | null;
  onClose: () => void;
  onEdit: (bird: BirdRecord) => void;
}) {
  const { data: photos } = trpc.photos.listByEntity.useQuery(
    { entityType: "bird", entityId: bird?.id ?? 0 },
    { enabled: !!bird }
  );
  const { data: coiData } = trpc.genetics.coi.useQuery(bird?.id ?? 0, { enabled: !!bird });
  const { data: allBirds } = trpc.birds.list.useQuery({}, { enabled: !!bird });

  if (!bird) return null;

  const photo = photos?.find((p) => p.isPrimary) ?? photos?.[0];
  const specialty = SPECIALTIES.find((s) => s.id === bird.specialty_code);
  const color = COLORS.find((c) => c.id === bird.color_code);
  const sex = SEXES.find((s) => s.id === bird.sex);
  const father = allBirds?.find((b) => b.id === bird.fatherId);
  const mother = allBirds?.find((b) => b.id === bird.motherId);
  const risk = coiData ? riskConfig[coiData.risk as keyof typeof riskConfig] : null;

  return (
    <Dialog open={!!bird} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bird.displayTitle || bird.ring}</DialogTitle>
        </DialogHeader>

        {/* Foto + identificação */}
        <div className="flex gap-4">
          <div className="w-28 h-28 rounded-xl overflow-hidden bg-gray-100 shrink-0 border">
            {photo ? (
              <img src={photo.url} alt={bird.ring} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <BirdIcon className="w-10 h-10" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {bird.nickname && <p className="text-sm font-semibold text-blue-600">{bird.nickname}</p>}
            <p className="text-lg font-bold text-gray-900">{bird.breedName || specialty?.name || bird.specialty_code}</p>
            <p className="text-sm text-gray-500">{color?.name ?? bird.color_code} · {sex?.name ?? bird.sex}</p>
            <p className="text-xs text-gray-400">{bird.speciesName || "Canário"}{bird.modality ? ` · ${bird.modality}` : ""}</p>
            <span className="inline-block mt-2 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
              {bird.status}
            </span>
            {risk && (
              <span className={`inline-block mt-2 ml-1 px-2 py-0.5 rounded text-xs font-medium ${risk.className}`}>
                COI {(coiData!.coi * 100).toFixed(1)}% — {risk.label}
              </span>
            )}
          </div>
        </div>

        {/* Dados */}
        <div className="grid grid-cols-2 gap-3 text-sm border-t pt-4">
          <InfoItem icon={Calendar} label="Nascimento" value={bird.birthDate ? new Date(bird.birthDate).toLocaleDateString("pt-BR") : "—"} />
          <InfoItem icon={Calendar} label="Idade" value={calculateAge(bird.birthDate)} />
          <InfoItem icon={Ruler} label="Porte" value={specialty?.size ?? "—"} />
          <InfoItem icon={Scale} label="Peso de referência" value={specialty?.weight ?? "—"} />
          <InfoItem icon={MapPin} label="Procedência" value={bird.procedence || "Plantel próprio"} />
          <InfoItem icon={Info} label="Espécie" value={bird.speciesName || "Canário"} />
          <InfoItem icon={Info} label="Modalidade" value={bird.modality || "—"} />
        </div>

        {/* Pais */}
        {(father || mother) && (
          <div className="border-t pt-4">
            <p className="text-xs text-gray-400 uppercase mb-2">Pais</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border p-2">
                <p className="text-gray-400 text-xs">Pai</p>
                <p className="font-mono font-medium">{father?.ring ?? "—"}</p>
              </div>
              <div className="rounded border p-2">
                <p className="text-gray-400 text-xs">Mãe</p>
                <p className="font-mono font-medium">{mother?.ring ?? "—"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Ficha Genética Completa */}
        <GeneticProfileSection birdId={bird.id} sex={bird.sex} />

        {bird.notes && (
          <div className="border-t pt-4">
            <p className="text-xs text-gray-400 uppercase mb-1">Observações</p>
            <p className="text-sm text-gray-600">{bird.notes}</p>
          </div>
        )}

        {(bird.sex === "macho" || bird.sex === "fêmea") && (
          <div className="border-t pt-4">
            <PairingSuggestions birdId={bird.id} />
          </div>
        )}

        <div className="flex gap-2 justify-end border-t pt-4">
          <Link href={`/pedigree/${bird.id}`}>
            <Button variant="outline" size="sm">
              <GitBranch className="w-4 h-4 mr-1" />
              Pedigree completo
            </Button>
          </Link>
          <Button size="sm" onClick={() => onEdit(bird)}>
            <Edit2 className="w-4 h-4 mr-1" />
            Editar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Ficha Genética Completa
// ============================================================================

const CONFIDENCE_CONFIG = {
  CONFIRMADO:  { label: "Confirmado",   icon: CheckCircle,  className: "text-green-700 bg-green-50 border-green-200" },
  INFERIDO:    { label: "Inferido",     icon: Info,         className: "text-blue-700 bg-blue-50 border-blue-200" },
  POSSÍVEL:    { label: "Possível",     icon: HelpCircle,   className: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  DESCONHECIDO:{ label: "Desconhecido", icon: HelpCircle,   className: "text-gray-600 bg-gray-50 border-gray-200" },
  DESCARTADO:  { label: "Descartado",   icon: AlertTriangle,className: "text-red-600 bg-red-50 border-red-200" },
};

function ConfidenceBadge({ level }: { level: string }) {
  const cfg = CONFIDENCE_CONFIG[level as keyof typeof CONFIDENCE_CONFIG] ?? CONFIDENCE_CONFIG.DESCONHECIDO;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function GeneticTraitRow({ label, value, confidence }: { label: string; value: string; confidence?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 w-40 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span className="text-xs font-medium text-gray-800">{value}</span>
        {confidence && <ConfidenceBadge level={confidence} />}
      </div>
    </div>
  );
}

function GeneticProfileSection({ birdId, sex }: { birdId: number; sex: string }) {
  const [open, setOpen] = useState(false);
  const { data: genotype } = trpc.mendelian.getGenotype.useQuery(birdId);
  const { data: coiData } = trpc.genetics.coi.useQuery(birdId);
  const { data: geneProfile } = trpc.geneticProfile.getByBird.useQuery(
    { birdId },
    { enabled: open }
  );

  const hasGenotype = genotype && (
    genotype.backgroundColor ||
    genotype.featherType ||
    genotype.hasCrest ||
    (Array.isArray(genotype.mutations) && genotype.mutations.length > 0)
  );

  const mutations = (genotype?.mutations ?? []) as Array<{
    mutation: string;
    inheritance: string;
    zygosity: string;
  }>;

  const ZYGOSITY_PT: Record<string, string> = {
    homozygous_mutant:    "Visual (dose dupla)",
    heterozygous_carrier: "Portador (não manifesta)",
    homozygous_normal:    "Normal (sem mutação)",
  };

  const INHERITANCE_PT: Record<string, string> = {
    sex_linked_recessive: "Ligada ao sexo",
    autosomal_recessive:  "Autossômica recessiva",
    autosomal_dominant:   "Autossômica dominante",
  };

  // Inferir nível de confiança com base na zigosidade
  function inferConfidence(zygosity: string, inheritance: string, birdSex: string): string {
    if (zygosity === "homozygous_mutant") return "CONFIRMADO";
    if (zygosity === "homozygous_normal") return "CONFIRMADO";
    if (zygosity === "heterozygous_carrier") {
      if (inheritance === "sex_linked_recessive" && birdSex === "fêmea") return "DESCARTADO";
      return "INFERIDO";
    }
    return "DESCONHECIDO";
  }

  return (
    <div className="border-t pt-4">
      <button
        type="button"
        className="flex items-center justify-between w-full text-left mb-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Dna className="w-4 h-4 text-amber-600" />
          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Ficha Genética</p>
          {!hasGenotype && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
              Incompleta
            </Badge>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />
        }
      </button>

      {open && (
        <div className="space-y-4">
          {/* Classe oficial cadastrada via geneticProfile router */}
          {geneProfile && (geneProfile.officialCode || geneProfile.officialName) && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
              <p className="text-xs font-semibold text-amber-700 uppercase mb-2">Classe Oficial Cadastrada</p>
              <div className="space-y-1">
                {geneProfile.officialCode && (
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-amber-100 px-1.5 py-0.5 rounded text-amber-800">{geneProfile.officialCode}</code>
                    {geneProfile.modality && <Badge variant="outline" className="text-xs">{geneProfile.modality}</Badge>}
                    {geneProfile.manualOverride && <Badge className="bg-green-100 text-green-800 text-xs">✓ Verificado</Badge>}
                  </div>
                )}
                {geneProfile.officialName && (
                  <p className="text-xs text-gray-700 font-medium">{geneProfile.officialName}</p>
                )}
                {geneProfile.lipochromeBase && (
                  <GeneticTraitRow label="Lipocromo" value={geneProfile.lipochromeBase} confidence={geneProfile.manualOverride ? "CONFIRMADO" : "INFERIDO"} />
                )}
                {geneProfile.melaninSeries && (
                  <GeneticTraitRow label="Melanina" value={geneProfile.melaninSeries} confidence={geneProfile.manualOverride ? "CONFIRMADO" : "INFERIDO"} />
                )}
                {geneProfile.featherCategory && (
                  <GeneticTraitRow label="Categoria" value={geneProfile.featherCategory} confidence={geneProfile.manualOverride ? "CONFIRMADO" : "INFERIDO"} />
                )}
                {geneProfile.confidenceScore != null && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">Confiança:</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-24">
                      <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.round((geneProfile.confidenceScore ?? 0) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-600">{Math.round((geneProfile.confidenceScore ?? 0) * 100)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!hasGenotype ? (
            <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-4 text-center">
              <Dna className="w-8 h-8 text-amber-300 mx-auto mb-2" />
              <p className="text-sm text-amber-700 font-medium">Genética não preenchida</p>
              <p className="text-xs text-amber-600/70 mt-1">
                Edite o pássaro e preencha a seção Genótipo para ver a ficha genética completa.
              </p>
            </div>
          ) : (
            <>
              {/* Lipocromo e plumagem */}
              <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Fenótipo Base</p>
                {genotype.backgroundColor && (
                  <GeneticTraitRow
                    label="Lipocromo (cor de fundo)"
                    value={genotype.backgroundColor}
                    confidence="CONFIRMADO"
                  />
                )}
                {genotype.featherType && (
                  <GeneticTraitRow
                    label="Categoria de pena"
                    value={genotype.featherType === "intenso" ? "Intenso" : "Nevado"}
                    confidence="CONFIRMADO"
                  />
                )}
                <GeneticTraitRow
                  label="Crista / Topete"
                  value={genotype.hasCrest ? "Sim (gene dominante)" : "Não"}
                  confidence="CONFIRMADO"
                />
              </div>

              {/* Mutações */}
              {mutations.length > 0 && (
                <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Mutações Registradas</p>
                  {mutations.map((m, i) => (
                    <GeneticTraitRow
                      key={i}
                      label={`${m.mutation} (${INHERITANCE_PT[m.inheritance] ?? m.inheritance})`}
                      value={ZYGOSITY_PT[m.zygosity] ?? m.zygosity}
                      confidence={inferConfidence(m.zygosity, m.inheritance, sex)}
                    />
                  ))}
                </div>
              )}

              {/* Alertas genéticos */}
              {genotype.hasCrest && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    <strong>Alerta:</strong> Ave com crista — evite cruzar com outro topetado.
                    Crista × crista gera 25% de filhotes não viáveis (gene letal em dose dupla).
                  </p>
                </div>
              )}
              {mutations.some((m) => m.mutation === "branco_dominante") && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">
                    <strong>Alerta:</strong> Branco dominante — evite cruzar com outro branco dominante.
                    25% dos filhotes recebem dose dupla (letal).
                  </p>
                </div>
              )}

              {/* COI */}
              {coiData && (
                <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Consanguinidade (COI)</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          coiData.risk === "low" ? "bg-green-500" :
                          coiData.risk === "moderate" ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(coiData.coi * 100 * 4, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      {(coiData.coi * 100).toFixed(1)}%
                    </span>
                    <ConfidenceBadge level={
                      coiData.risk === "low" ? "CONFIRMADO" :
                      coiData.risk === "moderate" ? "POSSÍVEL" : "DESCARTADO"
                    } />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {coiData.risk === "low" && "Consanguinidade baixa — cruzamento seguro."}
                    {coiData.risk === "moderate" && "Consanguinidade moderada — use com critério."}
                    {coiData.risk === "high" && "Consanguinidade alta — evite este cruzamento."}
                  </p>
                </div>
              )}

              {/* Legenda */}
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Legenda de certeza</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(CONFIDENCE_CONFIG).map(([key, cfg]) => (
                    <div key={key} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${cfg.className}`}>
                      <cfg.icon className="w-3 h-3 shrink-0" />
                      <span>{cfg.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PairingSuggestions({ birdId }: { birdId: number }) {
  const recommend = trpc.genetics.recommendPairing.useMutation();

  return (
    <div>
      {!recommend.data && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={recommend.isPending}
          onClick={() => recommend.mutate({ birdId })}
        >
          {recommend.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {recommend.isPending ? "Buscando melhores pares..." : "Sugerir melhor par (IA)"}
        </Button>
      )}

      {recommend.data && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 uppercase">Melhores pares sugeridos</p>
          {recommend.data.candidates.length > 0 ? (
            <div className="space-y-1.5">
              {recommend.data.candidates.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between text-sm rounded-lg border p-2">
                  <div>
                    <span className="font-mono font-semibold">{i === 0 ? "🏆 " : ""}{c.ring}</span>
                    <span className="text-gray-400 ml-2">COI {(c.coi * 100).toFixed(1)}%</span>
                  </div>
                  {c.bestScore != null && <span className="text-xs text-gray-500">nota {c.bestScore}</span>}
                </div>
              ))}
            </div>
          ) : null}
          <p className="text-sm text-gray-600 italic">{recommend.data.summary}</p>
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-gray-400 text-xs">{label}</p>
        <p className="font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}
