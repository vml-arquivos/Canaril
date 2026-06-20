import { useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { SPECIALTIES, COLORS } from "@shared/constants";
import { AlertTriangle, CheckCircle2, Bird as BirdIcon } from "lucide-react";

/**
 * Árvore genealógica visual de até 5 gerações, com o Coeficiente de
 * Endogamia (COI) do pássaro já calculado e destacado.
 *
 * Layout: cada geração é uma coluna, dobrando de tamanho a cada coluna
 * (1 → 2 → 4 → 8 → 16 ancestrais), com rolagem horizontal — é a forma
 * mais legível de mostrar 5 gerações sem amontoar tudo.
 */
export default function PedigreeTree() {
  const [, params] = useRoute("/pedigree/:birdId");
  const birdId = params?.birdId ? parseInt(params.birdId) : null;

  const { data, isLoading } = trpc.genetics.pedigree.useQuery(
    { birdId: birdId ?? 0, generations: 5 },
    { enabled: !!birdId }
  );

  if (!birdId) {
    return (
      <DashboardLayout>
        <p className="text-center text-gray-400 py-12">Selecione um pássaro para ver o pedigree.</p>
      </DashboardLayout>
    );
  }

  const riskConfig = {
    low: { label: "Risco baixo", className: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle2 },
    moderate: { label: "Risco moderado", className: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: AlertTriangle },
    high: { label: "Risco alto", className: "bg-red-100 text-red-800 border-red-300", icon: AlertTriangle },
  };

  const risk = data ? riskConfig[data.coiRisk as keyof typeof riskConfig] : null;

  // Constrói as colunas por geração a partir da árvore aninhada
  const columns: (PedigreeTreeNode | null)[][] = [];
  function fillColumns(node: PedigreeTreeNode | null, generation: number, slot: number) {
    if (!columns[generation]) columns[generation] = [];
    columns[generation][slot] = node;
    const childSlots = slot * 2;
    if (generation < 4) {
      fillColumns(node?.father ?? null, generation + 1, childSlots);
      fillColumns(node?.mother ?? null, generation + 1, childSlots + 1);
    }
  }
  if (data?.tree) fillColumns(data.tree, 0, 0);

  const genTitles = ["Pássaro", "Pais", "Avós", "Bisavós", "Trisavós"];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pedigree</h1>
          <p className="text-gray-600 mt-2">Árvore genealógica de até 5 gerações</p>
        </div>

        {isLoading && <p className="text-gray-400">Carregando...</p>}

        {data && (
          <>
            {risk && (
              <div className={`flex items-center gap-3 rounded-lg border-2 p-4 ${risk.className}`}>
                <risk.icon className="w-6 h-6 shrink-0" />
                <div>
                  <p className="font-semibold">
                    Consanguinidade (COI): {(data.coi * 100).toFixed(1)}% — {risk.label}
                  </p>
                  <p className="text-sm opacity-80">
                    {data.coiRisk === "high"
                      ? "Esse nível de parentesco entre os pais é considerado alto para canários — avalie com cautela antes de usar esse pássaro em novos cruzamentos próximos."
                      : data.coiRisk === "moderate"
                      ? "Parentesco moderado entre os pais — atenção redobrada na escolha do próximo par."
                      : "Parentesco baixo ou ausente entre os pais — situação genética saudável."}
                  </p>
                </div>
              </div>
            )}

            <div className="overflow-x-auto pb-4">
              <div className="flex gap-6 min-w-max">
                {columns.map((col, genIdx) => (
                  <div key={genIdx} className="flex flex-col justify-around gap-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase text-center mb-1">
                      {genTitles[genIdx] ?? `Geração ${genIdx}`}
                    </p>
                    {col.map((node, i) => (
                      <PedigreeBox key={i} node={node} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

type PedigreeTreeNode = {
  id: number;
  ring: string;
  specialty_code: string;
  color_code: string;
  sex: string;
  generation: number;
  father: PedigreeTreeNode | null;
  mother: PedigreeTreeNode | null;
  truncated: boolean;
};

function PedigreeBox({ node }: { node: PedigreeTreeNode | null }) {
  if (!node) {
    return (
      <div className="w-36 h-16 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-300">
        <BirdIcon className="w-4 h-4" />
      </div>
    );
  }
  const isMale = node.sex === "macho";
  return (
    <div
      className={`w-36 rounded-lg border-2 p-2 ${
        isMale ? "border-blue-200 bg-blue-50" : "border-rose-200 bg-rose-50"
      }`}
    >
      <p className="font-mono text-xs font-bold text-gray-800 truncate">{node.ring}</p>
      <p className="text-[10px] text-gray-500 truncate">
        {SPECIALTIES.find((s) => s.id === node.specialty_code)?.name ?? node.specialty_code}
      </p>
      <p className="text-[10px] text-gray-400 truncate">
        {COLORS.find((c) => c.id === node.color_code)?.name ?? node.color_code}
      </p>
    </div>
  );
}
