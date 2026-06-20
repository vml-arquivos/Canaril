import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { SPECIALTIES, COLORS, SEXES } from "@shared/constants";
import { Bird as BirdIcon, GitBranch, Edit2, Calendar, MapPin, Ruler, Scale } from "lucide-react";
import { Link } from "wouter";

type BirdRecord = {
  id: number;
  ring: string;
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
          <DialogTitle className="font-mono">{bird.ring}</DialogTitle>
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
            <p className="text-lg font-bold text-gray-900">{specialty?.name ?? bird.specialty_code}</p>
            <p className="text-sm text-gray-500">{color?.name ?? bird.color_code} · {sex?.name ?? bird.sex}</p>
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

        {bird.notes && (
          <div className="border-t pt-4">
            <p className="text-xs text-gray-400 uppercase mb-1">Observações</p>
            <p className="text-sm text-gray-600">{bird.notes}</p>
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
