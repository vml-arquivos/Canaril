/**
 * PublicBirdPage.tsx — Página Pública do Pássaro (QR Code)
 *
 * Acessível sem login via /p/:code
 * Exibe ficha resumida do pássaro apenas se isPublic=true.
 */
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Bird, Feather, ArrowLeft } from "lucide-react";
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

export default function PublicBirdPage() {
  const [, params] = useRoute("/p/:code");
  const code = params?.code ?? "";

  const { data: bird, isLoading } = trpc.qrcode.getPublicBird.useQuery(
    { code },
    { enabled: !!code }
  );

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
      {/* Header simples */}
      <header className="border-b border-amber-100 bg-white/90 backdrop-blur sticky top-0 z-50 px-4 py-4 flex items-center gap-3">
        <Bird className="w-6 h-6 text-amber-600" />
        <span className="font-bold text-amber-900">Canaril Lima</span>
        <span className="text-gray-300 mx-1">|</span>
        <span className="text-sm text-gray-500">Ficha do Pássaro</span>
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

          {/* Dados */}
          <div className="px-6 py-5 space-y-3">
            {[
              ["Anilha", <span className="font-mono">{bird.ring}</span>],
              ["Raça", bird.breedName],
              ["Classe oficial", bird.officialCode ? `${bird.officialCode}${bird.officialName ? ` — ${bird.officialName}` : ""}` : null],
              ["Plumagem", bird.featherType],
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

          {/* Rodapé */}
          <div className="px-6 pb-5">
            <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700 border border-amber-100 flex items-start gap-2">
              <Feather className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Esta ficha é gerada pelo sistema Canaril Lima e exibe apenas informações públicas autorizadas pelo criador.
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/">
            <button className="text-amber-700 text-sm hover:underline flex items-center gap-1 mx-auto">
              <ArrowLeft className="w-3.5 h-3.5" />
              Conhecer o sistema Canaril Lima
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
