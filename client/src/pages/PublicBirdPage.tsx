/**
 * PublicBirdPage.tsx — Certificado Genético Individual (QR Code)
 *
 * Acessível sem login via /p/:code ou /g/:code.
 * Exibe a ficha completa do pássaro apenas se isPublic=true: dados básicos,
 * genótipo completo (mutações com zigosidade), genealogia (pais) e
 * premiações em concursos já julgados.
 *
 * A marca exibida no cabeçalho/rodapé é a do criadouro DONO do pássaro
 * (breederName), não mais fixa em "Canaril Lima" — antes isso vazava a
 * marca de um cliente específico para os certificados de todos os outros
 * criadouros da plataforma.
 */
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Bird, Feather, ArrowLeft, Trophy, Dna, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function ageString(birthDate: Date | string | null | undefined): string {
  if (!birthDate) return "Desconhecida";
  const d = new Date(birthDate as string);
  if (isNaN(d.getTime())) return "Desconhecida";
  const months = (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth());
  if (months < 12) return `${months} mês${months !== 1 ? "es" : ""}`;
  const years = Math.floor(months / 12);
  return `${years} ano${years !== 1 ? "s" : ""}`;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d as string);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

export default function PublicBirdPage() {
  const [, params] = useRoute("/p/:code");
  const [, paramsG] = useRoute("/g/:code");
  const code = params?.code ?? paramsG?.code ?? "";

  const { data: bird, isLoading } = trpc.qrcode.getPublicBird.useQuery(
    { code },
    { enabled: !!code }
  );

  const breederName = bird?.breederName || "VittaBird";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FBF8F3] flex items-center justify-center">
        <div className="text-center">
          <Bird className="w-10 h-10 text-amber-500 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!bird) {
    return (
      <div className="min-h-screen bg-[#FBF8F3] flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <Bird className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Pássaro não encontrado</h1>
          <p className="text-gray-500 text-sm mb-6">Este QR Code não aponta para um pássaro público ou o código é inválido.</p>
          <Link href="/">
            <button className="text-amber-700 text-sm underline">← Voltar ao início</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      {/* Header — mostra o criadouro dono do pássaro, não uma marca fixa */}
      <header className="border-b border-amber-100 bg-white/90 backdrop-blur sticky top-0 z-50 px-4 py-4 flex items-center gap-3">
        <Bird className="w-6 h-6 text-amber-600" />
        <span className="font-bold text-amber-900">{breederName}</span>
        <span className="text-gray-300 mx-1">|</span>
        <span className="text-sm text-gray-500">Certificado Genético</span>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-md">
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          {/* Banner */}
          <div className="bg-gradient-to-r from-amber-700 to-amber-600 px-6 py-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              {bird.sex === "macho" || bird.sex === "M"
                ? <Badge className="bg-white/20 text-white border-0 text-xs">♂ Macho</Badge>
                : bird.sex === "fêmea" || bird.sex === "F"
                ? <Badge className="bg-white/20 text-white border-0 text-xs">♀ Fêmea</Badge>
                : null}
              {bird.modality && <Badge className="bg-white/20 text-white border-0 text-xs">{bird.modality}</Badge>}
            </div>
            <h1 className="text-2xl font-bold">{bird.displayTitle ?? bird.ring}</h1>
            {bird.nickname && <p className="text-amber-200 text-sm mt-0.5">"{bird.nickname}"</p>}
          </div>

          {/* Dados básicos */}
          <div className="px-6 py-5 space-y-3">
            {[
              ["Anilha", <span className="font-mono">{bird.ring}</span>],
              ["Raça", bird.breedName],
              ["Classe oficial", bird.officialCode ? `${bird.officialCode}${bird.officialName ? ` — ${bird.officialName}` : ""}` : null],
              ["Plumagem", bird.featherType],
              ["Padrão", bird.pattern === "mosaico" ? "Mosaico" : bird.pattern === "comum" ? "Comum" : null],
              ["Lipocromo", bird.backgroundColor],
              ["Crista", bird.hasCrest ? "Sim" : "Não"],
              ["Idade", ageString(bird.birthDate)],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={String(label)} className="flex items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 w-28 shrink-0 pt-0.5">{label}</span>
                <span className="text-sm text-gray-800 flex-1">{value}</span>
              </div>
            ))}
          </div>

          {/* Genótipo completo — mutações portadas/manifestadas */}
          {bird.mutations && bird.mutations.length > 0 && (
            <div className="px-6 pb-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Dna className="w-3.5 h-3.5" /> Genótipo
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {bird.mutations.map((m) => (
                  <Badge key={m.id} className={m.zygosity === "homozygous_mutant" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-gray-100 text-gray-600 border-gray-200"}>
                    {m.label} <span className="opacity-70 ml-1">({m.zygosityLabel})</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Genealogia */}
          {(bird.father || bird.mother) && (
            <div className="px-6 pb-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" /> Genealogia
              </h2>
              <div className="space-y-1.5 text-sm">
                {bird.father && <p><span className="text-gray-400">Pai:</span> <span className="font-mono">{bird.father.ring}</span> {bird.father.displayTitle && <span className="text-gray-500">— {bird.father.displayTitle}</span>}</p>}
                {bird.mother && <p><span className="text-gray-400">Mãe:</span> <span className="font-mono">{bird.mother.ring}</span> {bird.mother.displayTitle && <span className="text-gray-500">— {bird.mother.displayTitle}</span>}</p>}
              </div>
            </div>
          )}

          {/* Premiações */}
          {bird.awards && bird.awards.length > 0 && (
            <div className="px-6 pb-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Premiações
              </h2>
              <div className="space-y-2">
                {bird.awards.map((a, i) => (
                  <div key={i} className="text-sm bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                    <p className="font-medium text-amber-900">{a.championshipName}</p>
                    <p className="text-xs text-gray-500">{a.category} · {formatDate(a.date)}</p>
                    <p className="text-xs mt-0.5">
                      {a.placement ? <span className="font-semibold text-amber-700">{a.placement}º lugar</span> : <span className="text-gray-500">Julgado</span>}
                      <span className="text-gray-400"> · Nota {a.totalScore.toFixed(1)}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="px-6 pb-5">
            <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700 border border-amber-100 flex items-start gap-2">
              <Feather className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Este certificado é gerado pelo criadouro {breederName} e exibe apenas informações públicas autorizadas pelo criador.
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          {bird.breederSlug ? (
            <Link href={`/c/${bird.breederSlug}`}>
              <button className="text-amber-700 text-sm hover:underline flex items-center gap-1 mx-auto">
                <ArrowLeft className="w-3.5 h-3.5" />
                Conhecer o criadouro {breederName}
              </button>
            </Link>
          ) : (
            <Link href="/">
              <button className="text-amber-700 text-sm hover:underline flex items-center gap-1 mx-auto">
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar ao início
              </button>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
