/**
 * BirdFichaPage.tsx — Ficha Premium do Pássaro
 *
 * Página dedicada com abas: Resumo, Genética, Pedigree, Reprodução.
 * Imprimível e com link de volta para a listagem.
 * Rota: /birds/:birdId/ficha
 */
import { useState } from "react";
import { useRoute, Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  CoiRiskBadge, GeneticStatusBadge, HelpTooltip, InlineAlert,
  EmptyState, MetricCard, PageHeader, SexBadge,
} from "@/components/ui-premium";
import { BACKGROUND_COLORS, FEATHER_TYPES } from "@shared/constants";
import {
  Bird, Dna, GitBranch, Egg, Printer, ArrowLeft,
  AlertTriangle, CheckCircle2, Calendar, Feather, Info, QrCode, Clock,
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────────

function ageString(birthDate: Date | string | null): string {
  if (!birthDate) return "Desconhecida";
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return "Desconhecida";
  const today = new Date();
  const months = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
  if (months < 1) return "Menos de 1 mês";
  if (months < 12) return `${months} mês${months !== 1 ? "es" : ""}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} ano${years !== 1 ? "s" : ""} e ${rem} mês${rem !== 1 ? "es" : ""}` : `${years} ano${years !== 1 ? "s" : ""}`;
}

function labelFor(list: readonly { id: string; name: string }[], id: string | null | undefined): string {
  return list.find((i) => i.id === id)?.name ?? id ?? "—";
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 flex-1">{value ?? "—"}</span>
    </div>
  );
}

const ZYGOSITY_PT: Record<string, string> = {
  homozygous_mutant: "Visual (dose dupla)",
  heterozygous_carrier: "Portador",
  homozygous_normal: "Normal",
};
const INHERITANCE_PT: Record<string, string> = {
  sex_linked_recessive: "Ligada ao sexo",
  autosomal_recessive: "Autossômica recessiva",
  autosomal_dominant: "Autossômica dominante",
};

// ─── Aba Resumo ─────────────────────────────────────────────────────────────

function AbaResumo({ birdId }: { birdId: number }) {
  const { data: report } = trpc.reports.birdIndividual.useQuery({ birdId });
  const { data: photos } = trpc.photos.listByEntity.useQuery({ entityType: "bird", entityId: birdId });
  const [qrData, setQrData] = useState<{ url: string; qrApiUrl: string } | null>(null);

  const generateQr = trpc.qrcode.generateForBird.useMutation({
    onSuccess: (data) => {
      setQrData(data);
      toast.success("QR Code gerado! Compartilhe o link ou imprima o código.");
    },
    onError: (err) => toast.error("Erro ao gerar QR Code: " + err.message),
  });

  if (!report) return <p className="text-gray-400 py-8 text-center">Carregando...</p>;

  const { bird } = report;
  const mainPhoto = photos?.find((p) => p.isPrimary) ?? photos?.[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-[200px_1fr] gap-6">
        {/* Foto */}
        <div>
          {mainPhoto ? (
            <img src={mainPhoto.url} alt={bird.ring} className="w-full h-48 object-cover rounded-xl border border-gray-100" />
          ) : (
            <div className="w-full h-48 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300">
              <Bird className="w-10 h-10" />
            </div>
          )}
          <p className="font-mono text-xs text-gray-400 text-center mt-2">{bird.ring}</p>
        </div>

        {/* Info principal */}
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <SexBadge sex={bird.sex} />
            {report.geneticComplete
              ? <Badge className="bg-green-100 text-green-800 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Genética completa</Badge>
              : <Badge className="bg-amber-100 text-amber-800 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Genética incompleta</Badge>}
            {report.coiRisk === "high" && <Badge className="bg-red-100 text-red-800 text-xs">COI alto</Badge>}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 leading-tight">{bird.displayTitle ?? bird.ring}</h2>
          {bird.nickname && <p className="text-gray-500 mb-3">"{bird.nickname}"</p>}
          <div className="space-y-0">
            <DataRow label="Anilha" value={<span className="font-mono">{bird.ring}</span>} />
            <DataRow label="Sexo" value={<SexBadge sex={bird.sex} />} />
            <DataRow label="Idade" value={ageString(bird.birthDate)} />
            <DataRow label="Espécie" value={bird.speciesName} />
            <DataRow label="Modalidade" value={bird.modality} />
            <DataRow label="Raça" value={bird.breedName} />
            <DataRow label="Classe oficial" value={report.profile?.officialCode ? `${report.profile.officialCode} — ${report.profile.officialName ?? ""}` : undefined} />
            <DataRow label="Status" value={bird.status} />
          </div>
        </div>
      </div>

      {/* COI */}
      {report.coi !== null && (
        <div className={`rounded-lg p-4 border text-sm ${report.coiRisk === "high" ? "bg-red-50 border-red-200" : report.coiRisk === "moderate" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
          <p className="font-semibold mb-1">Coeficiente de Consanguinidade (COI)</p>
          <p className="text-2xl font-bold">{(report.coi * 100).toFixed(2)}%</p>
          <p className="text-xs text-gray-500 mt-1">
            {report.coiRisk === "high" ? "Risco alto — evitar reprodução com parentes próximos." : report.coiRisk === "moderate" ? "Risco moderado — monitorar na próxima geração." : "Risco baixo — boa diversidade genética."}
          </p>
        </div>
      )}

      {/* QR Code */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><QrCode className="w-4 h-4 text-amber-600" />QR Code do Pássaro</p>
            <p className="text-xs text-gray-400 mt-0.5">Gera um link público para compartilhar a ficha resumida deste pássaro.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateQr.mutate({ birdId })}
            disabled={generateQr.isPending}
          >
            {generateQr.isPending ? "Gerando..." : qrData ? "Atualizar QR" : "Gerar QR Code"}
          </Button>
        </div>
        {qrData && (
          <div className="flex items-center gap-4">
            <img src={qrData.qrApiUrl} alt="QR Code" className="w-24 h-24 rounded border border-gray-200 bg-white" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 mb-1">Link público:</p>
              <a href={qrData.url} target="_blank" rel="noopener noreferrer" className="text-amber-700 text-xs underline break-all">{qrData.url}</a>
              <p className="text-xs text-gray-400 mt-1.5">O pássaro precisa estar marcado como "público" nas configurações para o link funcionar.</p>
            </div>
          </div>
        )}
      </div>

      {/* Links rápidos */}
      <div className="flex gap-2 flex-wrap print:hidden">
        <Link href={`/pedigree/${birdId}`}><Button variant="outline" size="sm"><GitBranch className="w-4 h-4 mr-1.5" />Pedigree</Button></Link>
        <Link href="/genetics-calculator"><Button variant="outline" size="sm"><Dna className="w-4 h-4 mr-1.5" />Calculadora</Button></Link>
      </div>
    </div>
  );
}

// ─── Aba Genética ───────────────────────────────────────────────────────────

function AbaGenetica({ birdId, sex }: { birdId: number; sex: string }) {
  const { data: genotype } = trpc.mendelian.getGenotype.useQuery(birdId);
  const { data: profile } = trpc.geneticProfile.getByBird.useQuery({ birdId });

  const mutations = (genotype?.mutations as Array<{ mutation: string; inheritance: string; zygosity: string }> | null) ?? [];

  const hasGenotype = genotype && (genotype.backgroundColor || genotype.featherType || genotype.hasCrest || mutations.length > 0);

  return (
    <div className="space-y-6">
      {/* Genótipo operacional */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Genótipo Operacional</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasGenotype ? (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Genótipo avançado não preenchido. Edite o pássaro para completar.
            </div>
          ) : (
            <div className="space-y-0">
              {genotype?.backgroundColor && <DataRow label="Lipocromo (fundo)" value={labelFor(BACKGROUND_COLORS, genotype.backgroundColor)} />}
              {genotype?.featherType && <DataRow label="Plumagem" value={labelFor(FEATHER_TYPES, genotype.featherType)} />}
              <DataRow label="Tem crista" value={genotype?.hasCrest ? "Sim (gene dominante)" : "Não"} />
              {mutations.length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Mutações</p>
                  {mutations.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                      <span className="font-medium text-gray-800 flex-1">{m.mutation}</span>
                      <Badge variant="outline" className="text-xs">{INHERITANCE_PT[m.inheritance] ?? m.inheritance}</Badge>
                      <Badge className={`text-xs ${m.zygosity === "homozygous_mutant" ? "bg-amber-100 text-amber-800" : m.zygosity === "heterozygous_carrier" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"}`}>
                        {ZYGOSITY_PT[m.zygosity] ?? m.zygosity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Perfil genético oficial */}
      {profile && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Perfil Genético Oficial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <DataRow label="Classe" value={profile.officialCode ? `${profile.officialCode} — ${profile.officialName ?? ""}` : undefined} />
            <DataRow label="Lipocromo" value={profile.lipochromeBase} />
            <DataRow label="Melanina" value={profile.melaninSeries} />
            <DataRow label="Plumagem" value={profile.featherCategory} />
            <DataRow label="Crista" value={profile.crestType} />
            <DataRow label="Branco dominante" value={profile.dominantWhiteStatus} />
            <DataRow label="Branco recessivo" value={profile.recessiveWhiteStatus} />
            <DataRow label="Marfim" value={profile.ivoryStatus} />
            <DataRow label="Fator vermelho" value={profile.redFactorStatus} />
            {profile.visibleMutations && Array.isArray(profile.visibleMutations) && profile.visibleMutations.length > 0 && (
              <DataRow label="Mutações visíveis" value={profile.visibleMutations.join(", ")} />
            )}
            <DataRow label="Confiança" value={profile.confidenceScore !== null ? `${Math.round((profile.confidenceScore ?? 0) * 100)}%` : undefined} />
            {profile.manualOverride && <DataRow label="Override manual" value="Sim — dados protegidos" />}
          </CardContent>
        </Card>
      )}

      {!profile && (
        <div className="text-center py-6 text-gray-400 text-sm">
          <Dna className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Perfil genético oficial não preenchido. Selecione uma classe oficial na edição do pássaro.
        </div>
      )}
    </div>
  );
}

// ─── Aba Pedigree ───────────────────────────────────────────────────────────

function AbaPedigree({ birdId }: { birdId: number }) {
  const { data: report } = trpc.reports.birdIndividual.useQuery({ birdId });

  if (!report) return <p className="text-gray-400 py-8 text-center">Carregando...</p>;

  const { pedigree } = report;

  function BirdBox({ bird, label }: { bird: { ring: string; displayTitle?: string | null; sex: string } | null; label: string }) {
    if (!bird) return (
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xs text-gray-300 mt-0.5">Desconhecido</p>
      </div>
    );
    return (
      <div className="border border-gray-200 rounded-lg p-3 bg-white">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="font-mono text-sm font-semibold text-gray-800 mt-0.5">{bird.ring}</p>
        {bird.displayTitle && <p className="text-xs text-gray-500 truncate">{bird.displayTitle}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Visual simples 3 gerações */}
      <div className="space-y-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Linha Paterna</p>
        <div className="grid grid-cols-2 gap-3">
          <BirdBox bird={pedigree.father} label="Pai" />
          <div className="grid grid-cols-2 gap-2">
            <BirdBox bird={pedigree.paternalGf} label="Avô paterno" />
            <BirdBox bird={pedigree.paternalGm} label="Avó paterna" />
          </div>
        </div>
        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Linha Materna</p>
        <div className="grid grid-cols-2 gap-3">
          <BirdBox bird={pedigree.mother} label="Mãe" />
          <div className="grid grid-cols-2 gap-2">
            <BirdBox bird={pedigree.maternalGf} label="Avô materno" />
            <BirdBox bird={pedigree.maternalGm} label="Avó materna" />
          </div>
        </div>
      </div>

      {report.coi !== null && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-100">
          <span className="text-gray-500">COI calculado: </span>
          <span className="font-bold text-gray-900">{(report.coi * 100).toFixed(2)}%</span>
          {report.coiRisk && <span className={`ml-2 text-xs ${report.coiRisk === "high" ? "text-red-600" : report.coiRisk === "moderate" ? "text-amber-600" : "text-green-600"}`}>({report.coiRisk === "high" ? "alto" : report.coiRisk === "moderate" ? "moderado" : "baixo"})</span>}
        </div>
      )}

      <Link href={`/pedigree/${birdId}`}>
        <Button variant="outline" size="sm" className="w-full">
          <GitBranch className="w-4 h-4 mr-2" />
          Abrir Árvore Genealógica Completa
        </Button>
      </Link>
    </div>
  );
}

// ─── Aba Reprodução ─────────────────────────────────────────────────────────

function AbaReproducao({ birdId }: { birdId: number }) {
  const { data: report } = trpc.reports.birdIndividual.useQuery({ birdId });

  if (!report) return <p className="text-gray-400 py-8 text-center">Carregando...</p>;

  const { couples, clutches } = report;
  const totalEggs = clutches.reduce((s, c) => s + c.totalEggs, 0);
  const totalFertilized = clutches.reduce((s, c) => s + c.fertilizedEggs, 0);
  const totalHatched = clutches.reduce((s, c) => s + c.hatchedChicks, 0);

  return (
    <div className="space-y-5">
      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Casais", couples.length, "text-blue-700"],
          ["Posturas", clutches.length, "text-amber-700"],
          ["Ovos total", totalEggs, "text-gray-700"],
          ["Eclosões", totalHatched, "text-green-700"],
        ].map(([label, value, color]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Taxas */}
      {totalEggs > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Taxa de fertilização</span><span className="font-semibold">{Math.round(totalFertilized / totalEggs * 100)}%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Taxa de eclosão</span><span className="font-semibold">{totalFertilized > 0 ? Math.round(totalHatched / totalFertilized * 100) : 0}%</span></div>
          </CardContent>
        </Card>
      )}

      {/* Casais */}
      {couples.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Nenhum casal registrado com este pássaro.</div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Casais</p>
          {couples.map((c) => (
            <div key={c.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-sm flex items-center justify-between">
              <div>
                <p className="font-medium">Casal #{c.id} — Gaiola {c.cageNumber}</p>
                <p className="text-xs text-gray-400">{c.status} · Formado em {new Date(c.formationDate).toLocaleDateString("pt-BR")}</p>
              </div>
              <Badge variant="outline" className="text-xs">{c.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Aba Linha do Tempo ──────────────────────────────────────────────────────

function AbaTimeline({ birdId }: { birdId: number }) {
  const { data: report } = trpc.reports.birdIndividual.useQuery({ birdId });
  const { data: health } = trpc.health.listByBird.useQuery(birdId);

  if (!report) return <p className="text-gray-400 py-8 text-center">Carregando...</p>;

  type TimelineEvent = { date: Date; type: string; icon: React.ReactNode; title: string; description: string; color: string };
  const events: TimelineEvent[] = [];

  const { bird, couples, clutches } = report;

  if (bird.birthDate) events.push({ date: new Date(bird.birthDate), type: "birth", icon: <Bird className="w-4 h-4" />, title: "Nascimento", description: `Nasceu em ${new Date(bird.birthDate).toLocaleDateString("pt-BR")}`, color: "bg-green-100 text-green-700 border-green-200" });
  if (bird.createdAt) events.push({ date: new Date(bird.createdAt), type: "register", icon: <Feather className="w-4 h-4" />, title: "Cadastrado no sistema", description: `Anilha ${bird.ring}`, color: "bg-blue-100 text-blue-700 border-blue-200" });

  for (const couple of couples) {
    events.push({ date: new Date(couple.formationDate), type: "couple", icon: <Egg className="w-4 h-4" />, title: "Formou casal", description: `Gaiola ${couple.cageNumber} · Status: ${couple.status}`, color: "bg-rose-100 text-rose-700 border-rose-200" });
  }

  for (const clutch of clutches) {
    events.push({ date: new Date(clutch.clutchDate), type: "clutch", icon: <Egg className="w-4 h-4" />, title: "Postura", description: `${clutch.totalEggs} ovos · ${clutch.fertilizedEggs} galados · ${clutch.hatchedChicks} eclodidos`, color: "bg-amber-100 text-amber-700 border-amber-200" });
  }

  for (const h of health ?? []) {
    events.push({ date: new Date(h.date), type: "health", icon: <AlertTriangle className="w-4 h-4" />, title: h.type === "weight" ? "Peso registrado" : h.type === "diet" ? "Plano alimentar" : h.type === "treatment" ? "Tratamento" : h.type === "vaccine" ? "Vacina" : h.type, description: h.description, color: "bg-purple-100 text-purple-700 border-purple-200" });
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-1">
      {events.length === 0 ? (
        <div className="text-center py-8 text-gray-400"><Clock className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum evento registrado.</p></div>
      ) : (
        <div className="relative pl-5">
          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-100" />
          {events.map((ev, i) => (
            <div key={i} className="relative mb-4 pl-5">
              <div className={`absolute -left-1 top-1 w-6 h-6 rounded-full border flex items-center justify-center ${ev.color}`}>
                {ev.icon}
              </div>
              <div className="bg-white rounded-lg border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{ev.title}</p>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{ev.date.toLocaleDateString("pt-BR")}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ───────────────────────────────────────────────────────

export default function BirdFichaPage() {
  const [, params] = useRoute("/birds/:birdId/ficha");
  const birdId = params?.birdId ? Number(params.birdId) : null;

  const { data: bird } = trpc.birds.getById.useQuery(birdId ?? 0, { enabled: !!birdId });

  if (!birdId) return (
    <DashboardLayout>
      <p className="text-gray-400 p-8">ID inválido.</p>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 print:hidden">
          <Link href="/birds">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" />Pássaros</Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{bird?.displayTitle ?? bird?.ring ?? "Ficha do Pássaro"}</h1>
            {bird?.nickname && <p className="text-gray-500 text-sm">"{bird.nickname}"</p>}
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir
          </Button>
        </div>

        {/* Abas */}
        <Tabs defaultValue="resumo">
          <TabsList className="print:hidden">
            <TabsTrigger value="resumo"><Info className="w-4 h-4 mr-1.5" />Resumo</TabsTrigger>
            <TabsTrigger value="genetica"><Dna className="w-4 h-4 mr-1.5" />Genética</TabsTrigger>
            <TabsTrigger value="pedigree"><GitBranch className="w-4 h-4 mr-1.5" />Pedigree</TabsTrigger>
            <TabsTrigger value="reproducao"><Egg className="w-4 h-4 mr-1.5" />Reprodução</TabsTrigger>
            <TabsTrigger value="timeline"><Clock className="w-4 h-4 mr-1.5" />Linha do Tempo</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-5"><AbaResumo birdId={birdId} /></TabsContent>
          <TabsContent value="genetica" className="mt-5"><AbaGenetica birdId={birdId} sex={bird?.sex ?? ""} /></TabsContent>
          <TabsContent value="pedigree" className="mt-5"><AbaPedigree birdId={birdId} /></TabsContent>
          <TabsContent value="reproducao" className="mt-5"><AbaReproducao birdId={birdId} /></TabsContent>
          <TabsContent value="timeline" className="mt-5"><AbaTimeline birdId={birdId} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
