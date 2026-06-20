/**
 * Calendário Automático de Reprodução
 * ============================================================================
 * Quando um casal é formado, gera automaticamente as datas estimadas de
 * cada etapa do ciclo reprodutivo, como lembretes editáveis (o criador
 * marca como concluído e pode ajustar a data conforme observa o casal de
 * verdade — isso é uma ESTIMATIVA de planejamento, não uma previsão
 * exata, já que o ciclo real varia por casal, idade e condição da ave).
 *
 * Referências de tempo usadas (conhecimento geral de criação de
 * canários):
 *  - Início da postura: alguns dias após a formação do casal
 *  - Incubação: ~13 dias a partir do início efetivo da chocagem
 *  - Ovoscopia (candling): por volta do 7º dia de incubação
 *  - Anilhamento: quando o pezinho atinge o tamanho certo, geralmente
 *    entre o 6º e 8º dia de vida
 *  - Desmame: geralmente entre 28 e 35 dias de vida
 * ============================================================================
 */

export type BreedingEventType =
  | "posture_start"
  | "candling"
  | "egg_return"
  | "hatching"
  | "ringing"
  | "weaning";

export type BreedingReminderSeed = {
  eventType: BreedingEventType;
  expectedDate: Date;
  notes: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function generateBreedingReminders(formationDate: Date): BreedingReminderSeed[] {
  const postureStart = addDays(formationDate, 7);
  const candling = addDays(postureStart, 12);
  const eggReturn = addDays(postureStart, 16);
  const hatching = addDays(postureStart, 18);
  const ringing = addDays(hatching, 7);
  const weaning = addDays(hatching, 30);

  return [
    { eventType: "posture_start", expectedDate: postureStart, notes: "Estimativa — acompanhe a gaiola para confirmar o início real da postura." },
    { eventType: "candling", expectedDate: candling, notes: "Ovoscopia: examine os ovos contra a luz para identificar os férteis." },
    { eventType: "egg_return", expectedDate: eggReturn, notes: "Devolva ao ninho apenas os ovos identificados como férteis na ovoscopia." },
    { eventType: "hatching", expectedDate: hatching, notes: "Eclosão esperada — confira o ninho diariamente a partir desta data." },
    { eventType: "ringing", expectedDate: ringing, notes: "Janela ideal para anilhar os filhotes (pezinho no tamanho certo)." },
    { eventType: "weaning", expectedDate: weaning, notes: "Desmame esperado — filhotes já se alimentam sozinhos." },
  ];
}

export const BREEDING_EVENT_LABELS: Record<BreedingEventType, string> = {
  posture_start: "Início da Postura",
  candling: "Ovoscopia",
  egg_return: "Retorno dos Ovos",
  hatching: "Eclosão",
  ringing: "Anilhamento",
  weaning: "Desmame",
};
