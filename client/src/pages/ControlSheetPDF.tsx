import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";

export default function ControlSheetPDF() {
  const [, params] = useRoute("/control-sheet/:coupleId");
  const coupleId = params?.coupleId ? parseInt(params.coupleId) : null;
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: couple } = trpc.management.couples.getById.useQuery(coupleId || 0, {
    enabled: !!coupleId,
  });

  const { data: clutches } = trpc.management.clutches.getByCoupleId.useQuery(coupleId || 0, {
    enabled: !!coupleId,
  });

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      // Simular geração de PDF
      const htmlContent = `
        <html>
          <head>
            <title>Ficha de Controle de Choca - Canaril Lima</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
              .header h1 { margin: 0; color: #333; }
              .header p { margin: 5px 0; color: #666; }
              .section { margin-bottom: 20px; page-break-inside: avoid; }
              .section-title { background-color: #f0f0f0; padding: 10px; font-weight: bold; border-left: 4px solid #d4a574; }
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
              .info-item { }
              .info-label { font-weight: bold; color: #666; font-size: 12px; }
              .info-value { border-bottom: 1px solid #999; padding: 5px 0; min-height: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th { background-color: #d4a574; color: white; padding: 8px; text-align: left; font-size: 12px; }
              td { border: 1px solid #ddd; padding: 8px; font-size: 11px; }
              .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; }
              .page-break { page-break-after: always; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🐦 FICHA DE CONTROLE DE CHOCA</h1>
              <p>Criadouro Canaril Lima - Brasília, DF</p>
              <p>Temporada de Reprodução</p>
            </div>

            <div class="section">
              <div class="section-title">INFORMAÇÕES DO CASAL</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Gaiola</div>
                  <div class="info-value">${couple?.cageNumber || "___________"}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Data de Formação</div>
                  <div class="info-value">${couple?.formationDate ? new Date(couple.formationDate).toLocaleDateString("pt-BR") : "___________"}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Macho (Anilha)</div>
                  <div class="info-value">${couple?.maleId || "___________"}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Fêmea (Anilha)</div>
                  <div class="info-value">${couple?.femaleId || "___________"}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">REGISTRO DE POSTURAS</div>
              <table>
                <thead>
                  <tr>
                    <th>Postura</th>
                    <th>Data</th>
                    <th>Total Ovos</th>
                    <th>Galados</th>
                    <th>Inférteis</th>
                    <th>Perdidos</th>
                    <th>Filhotes</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  ${clutches?.map((clutch, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${new Date(clutch.clutchDate).toLocaleDateString("pt-BR")}</td>
                      <td>${clutch.totalEggs}</td>
                      <td>${clutch.fertilizedEggs}</td>
                      <td>${clutch.infertileEggs}</td>
                      <td>${clutch.lostEggs}</td>
                      <td>${clutch.hatchedChicks}</td>
                      <td>${clutch.notes || "-"}</td>
                    </tr>
                  `).join("") || `
                    <tr>
                      <td colspan="8" style="text-align: center; color: #999;">Nenhuma postura registrada</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>

            <div class="section">
              <div class="section-title">ACOMPANHAMENTO DIÁRIO</div>
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Observações</th>
                    <th>Assinatura</th>
                  </tr>
                </thead>
                <tbody>
                  ${Array.from({ length: 15 }).map(() => `
                    <tr>
                      <td style="width: 80px;"></td>
                      <td></td>
                      <td style="width: 100px;"></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>

            <div class="footer">
              <p>Ficha gerada pelo Sistema Canaril Lima - ${new Date().toLocaleDateString("pt-BR")}</p>
            </div>
          </body>
        </html>
      `;

      // Criar blob e download
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ficha-choca-gaiola-${couple?.cageNumber || "controle"}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Ficha de controle gerada com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar ficha: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!coupleId) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Selecione um casal para gerar a ficha de controle.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ficha de Controle de Choca</h1>
            <p className="text-gray-600 mt-2">Gaiola {couple?.cageNumber}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrint} variant="outline">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={generatePDF} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 mr-2" />
              {isGenerating ? "Gerando..." : "Baixar PDF"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Casal</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Gaiola</p>
              <p className="text-lg font-semibold">{couple?.cageNumber || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Data de Formação</p>
              <p className="text-lg font-semibold">
                {couple?.formationDate ? new Date(couple.formationDate).toLocaleDateString("pt-BR") : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Macho (Anilha)</p>
              <p className="text-lg font-semibold font-mono">{couple?.maleId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fêmea (Anilha)</p>
              <p className="text-lg font-semibold font-mono">{couple?.femaleId}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posturas Registradas</CardTitle>
            <CardDescription>Total: {clutches?.length || 0} posturas</CardDescription>
          </CardHeader>
          <CardContent>
            {clutches && clutches.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Postura</th>
                      <th className="text-left py-2">Data</th>
                      <th className="text-center py-2">Total</th>
                      <th className="text-center py-2">Galados</th>
                      <th className="text-center py-2">Filhotes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clutches.map((clutch, idx) => (
                      <tr key={clutch.id} className="border-b">
                        <td className="py-2">{idx + 1}ª Postura</td>
                        <td className="py-2">{new Date(clutch.clutchDate).toLocaleDateString("pt-BR")}</td>
                        <td className="text-center">{clutch.totalEggs}</td>
                        <td className="text-center text-green-600 font-semibold">{clutch.fertilizedEggs}</td>
                        <td className="text-center text-blue-600 font-semibold">{clutch.hatchedChicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Nenhuma postura registrada para este casal.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
