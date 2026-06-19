import { useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Printer, QrCode } from "lucide-react";

/**
 * Ficha de Gaiola — formato físico de cartão de visitas (130mm x 60mm).
 *
 * Por que um componente separado do ControlSheetPDF (que é A4, histórico
 * completo de posturas): essa ficha vive PRESA na gaiola, então precisa
 * caber no suporte padrão e mostrar só o essencial pra consulta rápida —
 * o histórico completo já está no sistema (e, futuro próximo, num QR aqui
 * mesmo na ficha).
 *
 * Estratégia de impressão: o cartão é renderizado em unidades de milímetro
 * (não px/rem), e @page define o tamanho exato do papel. Em tela, o cartão
 * fica dentro de um container com transform: scale(2) só pra facilitar a
 * conferência visual antes de imprimir — o scale é zerado em @media print,
 * então o que sai na impressora é o cartão real, sem distorção.
 *
 * Rota sugerida (adicionar em client/src/App.tsx, mesmo padrão de
 * /control-sheet/:coupleId):
 *   <Route path={"/ficha-gaiola/:coupleId"}>
 *     {(params) => <ProtectedRoute component={CageCardPrint} {...params} />}
 *   </Route>
 */

const BRAND_ACCENT = "#d4a574"; // mesmo tom usado no ControlSheetPDF existente

export default function CageCardPrint() {
  const [, params] = useRoute("/ficha-gaiola/:coupleId");
  const coupleId = params?.coupleId ? parseInt(params.coupleId) : null;

  const { data: couple } = trpc.management.couples.getById.useQuery(coupleId || 0, {
    enabled: !!coupleId,
  });

  const { data: clutches } = trpc.management.clutches.getByCoupleId.useQuery(coupleId || 0, {
    enabled: !!coupleId,
  });

  const handlePrint = () => window.print();

  if (!coupleId) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Selecione um casal para gerar a ficha de gaiola.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Mostra até 3 posturas — é o que cabe com legibilidade no espaço físico.
  // Linhas vazias completam o cartão para anotação manual na gaiola.
  const rows = [...(clutches ?? [])].slice(-3);
  while (rows.length < 3) {
    // @ts-expect-error -- linha em branco proposital, preenchida à mão na gaiola
    rows.push(null);
  }

  return (
    <DashboardLayout>
      <style>{`
        @media print {
          @page { size: 130mm 60mm; margin: 0; }
          body * { visibility: hidden; }
          #cage-card-print, #cage-card-print * { visibility: visible; }
          #cage-card-print {
            position: fixed;
            top: 0;
            left: 0;
            transform: none !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ficha de Gaiola</h1>
            <p className="text-gray-600 mt-2">
              Gaiola {couple?.cageNumber ?? "-"} · formato 13 × 6 cm, pronto para o suporte padrão
            </p>
          </div>
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir ficha
          </Button>
        </div>

        {/* Container de pré-visualização: só amplia visualmente em tela.
            O scale some na impressão (ver @media print acima). */}
        <div className="border rounded-lg bg-gray-50 p-10 overflow-auto flex justify-center">
          <div style={{ transform: "scale(2)", transformOrigin: "top left", width: "130mm", height: "60mm" }}>
            <CageCard couple={couple} rows={rows} />
          </div>
        </div>
      </div>

      {/* Alvo real de impressão — único nó usado pelo navegador ao imprimir */}
      <div id="cage-card-print">
        <CageCard couple={couple} rows={rows} />
      </div>
    </DashboardLayout>
  );
}

function CageCard({ couple, rows }: { couple: any; rows: any[] }) {
  return (
    <div
      className="bg-white flex font-sans overflow-hidden"
      style={{
        width: "130mm",
        height: "60mm",
        boxSizing: "border-box",
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
      }}
    >
      {/* Faixa lateral — identificação rápida da gaiola, visível de longe */}
      <div
        className="flex flex-col justify-between text-white shrink-0"
        style={{ width: "34mm", height: "60mm", padding: "3mm", backgroundColor: BRAND_ACCENT, boxSizing: "border-box" }}
      >
        <div style={{ fontSize: "6.5pt", letterSpacing: "0.5pt" }} className="uppercase font-semibold opacity-90">
          Canário Lima
        </div>
        <div>
          <div style={{ fontSize: "6.5pt" }} className="uppercase opacity-90">Gaiola</div>
          <div style={{ fontSize: "20pt", lineHeight: "1" }} className="font-bold">
            {couple?.cageNumber ?? "—"}
          </div>
        </div>
        <div style={{ fontSize: "6pt" }} className="opacity-80 leading-tight">
          Sistema Canário Gestão Pro
        </div>
      </div>

      {/* Área de dados */}
      <div className="flex-1 flex flex-col" style={{ padding: "3mm 3.5mm", boxSizing: "border-box" }}>
        {/* Macho / Fêmea / Data de formação */}
        <div className="flex justify-between" style={{ marginBottom: "2mm" }}>
          <Field label="Macho (anilha)" value={couple?.maleId ?? "—"} />
          <Field label="Fêmea (anilha)" value={couple?.femaleId ?? "—"} />
          <Field
            label="Formado em"
            value={couple?.formationDate ? new Date(couple.formationDate).toLocaleDateString("pt-BR") : "—"}
          />
          <div className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded shrink-0" style={{ width: "10mm", height: "10mm" }}>
            <QrCode style={{ width: "6mm", height: "6mm" }} className="text-gray-300" />
          </div>
        </div>

        {/* Mini tabela de posturas — até 3 linhas, restante é preenchido à mão */}
        <table style={{ fontSize: "6pt", borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f3f1" }}>
              <Th>Postura</Th>
              <Th>Data</Th>
              <Th>Ovos</Th>
              <Th>Galados</Th>
              <Th>Filhotes</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((clutch, idx) => (
              <tr key={clutch?.id ?? `blank-${idx}`}>
                <Td>{idx + 1}ª</Td>
                <Td>{clutch ? new Date(clutch.clutchDate).toLocaleDateString("pt-BR") : ""}</Td>
                <Td>{clutch?.totalEggs ?? ""}</Td>
                <Td>{clutch?.fertilizedEggs ?? ""}</Td>
                <Td>{clutch?.hatchedChicks ?? ""}</Td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Linha para anotação manual */}
        <div style={{ marginTop: "auto", paddingTop: "1.5mm" }}>
          <div style={{ fontSize: "6pt" }} className="text-gray-400 uppercase" >Observações</div>
          <div style={{ borderBottom: "0.3mm solid #ccc", height: "4mm" }} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ marginRight: "2mm" }}>
      <div style={{ fontSize: "5.5pt" }} className="text-gray-400 uppercase leading-none">{label}</div>
      <div style={{ fontSize: "8pt" }} className="font-semibold leading-tight">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{ border: "0.2mm solid #ddd", padding: "0.5mm 1mm", fontWeight: 600, textAlign: "left" }}
      className="text-gray-600"
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ border: "0.2mm solid #ddd", padding: "0.5mm 1mm", height: "3.2mm" }} className="text-gray-700">
      {children}
    </td>
  );
}
