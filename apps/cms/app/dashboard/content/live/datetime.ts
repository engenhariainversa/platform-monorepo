// Timezone-aware conversions between a `<input type="datetime-local">` wall-clock
// value (no zone) and the absolute UTC instant we persist in `occursAt`.
//
// We store the event start as a single UTC instant plus the IANA timezone the
// admin picked it in. `Intl.DateTimeFormat` gives us the zone's UTC offset at a
// given instant (DST included) without pulling in a date library.

// A curated set of Brazilian + common timezones for the picker. Kept short and
// relevant rather than the full IANA list.
export const TIMEZONE_OPTIONS = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (GMT-2)" },
  { value: "UTC", label: "UTC (GMT+0)" },
  { value: "America/New_York", label: "New York (GMT-5/-4)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0/+1)" },
] as const;

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

// The runtime's own IANA timezone, falling back to the default when unavailable.
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

// Offset (ms) to add to a UTC instant to get the wall-clock time in `timeZone`.
function offsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const { type, value } of parts) {
    if (type !== "literal") map[type] = Number(value);
  }
  const asUTC = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour,
    map.minute,
    map.second,
  );
  return asUTC - date.getTime();
}

// Wall-clock "YYYY-MM-DDTHH:mm" interpreted in `timeZone` → UTC ISO string.
export function zonedInputToUtcIso(
  datetimeLocal: string,
  timeZone: string,
): string | null {
  if (!datetimeLocal) return null;
  const [datePart, timePart] = datetimeLocal.split("T");
  if (!datePart || !timePart) return null;
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  if ([y, mo, d, h, mi].some(Number.isNaN)) return null;

  // First guess: treat the wall time as if it were UTC, then correct by the
  // zone's offset. A second pass handles instants near a DST transition where
  // the offset differs before/after the correction.
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  let instant = guess - offsetMs(timeZone, new Date(guess));
  const secondOffset = offsetMs(timeZone, new Date(instant));
  instant = guess - secondOffset;

  return new Date(instant).toISOString();
}

// UTC ISO string → wall-clock "YYYY-MM-DDTHH:mm" in `timeZone`, for the input.
export function utcIsoToZonedInput(
  iso: string | null | undefined,
  timeZone: string,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const { type, value } of dtf.formatToParts(date)) {
    if (type !== "literal") map[type] = value;
  }
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

// Human-readable rendering of the stored instant in its own timezone.
export function formatOccursAt(
  iso: string | null | undefined,
  timeZone: string,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}
