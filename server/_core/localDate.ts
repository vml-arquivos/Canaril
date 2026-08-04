const DEFAULT_TIME_ZONE = process.env.APP_TIME_ZONE || "America/Sao_Paulo";

export function localDateString(date = new Date(), timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function dateAtLocalNoon(dateString: string): Date {
  // Meio-dia evita mudança involuntária de dia em conversões UTC/local.
  return new Date(`${dateString}T12:00:00`);
}

export function addLocalDays(dateString: string, days: number): Date {
  const date = dateAtLocalNoon(dateString);
  date.setDate(date.getDate() + days);
  return date;
}
