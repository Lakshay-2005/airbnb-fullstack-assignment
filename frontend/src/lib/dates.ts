/** Dates travel as ISO "YYYY-MM-DD" strings and are only turned into Date objects for display. */

export const toISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const parseISO = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = (): string => toISO(new Date());

export const addDays = (iso: string, days: number): string => {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
};

export const diffDays = (from: string, to: string): number =>
  Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000);

export const isValidRange = (checkIn?: string | null, checkOut?: string | null): boolean =>
  Boolean(checkIn && checkOut && checkOut > checkIn);

const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", options).format(parseISO(iso));

export const formatShort = (iso: string) => fmt(iso, { month: "short", day: "numeric" });
export const formatLong = (iso: string) =>
  fmt(iso, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
export const formatMonthYear = (iso: string) => fmt(iso, { month: "long", year: "numeric" });

/** "Oct 20 – 25" when both dates share a month, otherwise "Oct 28 – Nov 2". */
export function formatRange(checkIn: string, checkOut: string): string {
  const a = parseISO(checkIn);
  const b = parseISO(checkOut);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${formatShort(checkIn)} – ${b.getDate()}`;
  }
  return `${formatShort(checkIn)} – ${formatShort(checkOut)}`;
}

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso.endsWith("Z") ? iso : `${iso}Z`),
  );
