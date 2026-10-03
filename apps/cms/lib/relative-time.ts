const formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "em 23 horas", "há 5 minutos", "agora". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  if (abs < MINUTE) return formatter.format(Math.round(diff / 1000), "second");
  if (abs < HOUR) return formatter.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return formatter.format(Math.round(diff / HOUR), "hour");
  return formatter.format(Math.round(diff / DAY), "day");
}
