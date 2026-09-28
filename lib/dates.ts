// Manila timezone helpers (Asia/Manila = UTC+8, no DST).
// Never use new Date("YYYY-MM-DD") (parsed as UTC midnight) or Date.setDate on a
// shared Date for date-range work - use these helpers instead.

export const PH_TZ = "Asia/Manila";
const PH_OFFSET = "+08:00";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDateStr(dateStr: string): void {
  if (!DATE_RE.test(dateStr)) {
    throw new Error(`Invalid date (expected YYYY-MM-DD): ${dateStr}`);
  }
}

/** Monday 00:00 Asia/Manila of the given day, as a real UTC instant. */
export function startOfDayPH(dateStr: string): Date {
  assertDateStr(dateStr);
  return new Date(`${dateStr}T00:00:00.000${PH_OFFSET}`);
}

/** 23:59:59.999 Asia/Manila of the given day (use with lte). */
export function endOfDayPH(dateStr: string): Date {
  assertDateStr(dateStr);
  return new Date(`${dateStr}T23:59:59.999${PH_OFFSET}`);
}

/** Today's date in Manila as YYYY-MM-DD (Vercel runs UTC, so this matters). */
export function todayPH(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Format a Date to YYYY-MM-DD in Manila time. */
export function toISODate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isoToUTC(iso: string): number {
  assertDateStr(iso);
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToISO(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Shift a YYYY-MM-DD string by n days (calendar math, timezone-free). */
export function addDaysISO(iso: string, n: number): string {
  return utcToISO(isoToUTC(iso) + n * 86400000);
}

/**
 * Monday of the week containing dateStr.
 * Sunday belongs to the week that ENDS on it: (day + 6) % 7, where Monday = 0.
 */
export function mondayOf(dateStr: string): string {
  const ms = isoToUTC(dateStr);
  const dow = new Date(ms).getUTCDay(); // 0 = Sunday
  return utcToISO(ms - ((dow + 6) % 7) * 86400000);
}

/** Sunday of the week containing dateStr (Monday + 6). */
export function sundayOf(dateStr: string): string {
  return addDaysISO(mondayOf(dateStr), 6);
}

export interface WeekSlice {
  /** Full Monday of this week (start of day, Manila). */
  weekStart: Date;
  /** Full Sunday 23:59:59.999 of this week (Manila). */
  weekEnd: Date;
  /** First selected day in this week (start of day, Manila) - clipped to range. */
  rangeStart: Date;
  /** Last selected day in this week (end of day, Manila) - clipped to range. */
  rangeEnd: Date;
  /** e.g. "28-Sep to 04-Oct-2026" */
  label: string;
}

function shortLabel(fromISO: string, toISO: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
    }).format(new Date(`${iso}T00:00:00Z`));
  const year = fromISO.slice(0, 4);
  return `${fmt(fromISO)} to ${fmt(toISO)}-${year}`;
}

/**
 * Split a date range (YYYY-MM-DD, inclusive) into Monday-Sunday weeks.
 * The first and last week are clipped to the chosen range.
 * Throws if from > to.
 */
export function splitIntoWeeks(from: string, to: string): WeekSlice[] {
  assertDateStr(from);
  assertDateStr(to);
  if (from > to) throw new Error(`from > to: ${from} > ${to}`);

  const weeks: WeekSlice[] = [];
  let cursor = mondayOf(from);
  const lastWeekStart = mondayOf(to);

  while (cursor <= lastWeekStart) {
    const weekSunday = addDaysISO(cursor, 6);
    const rangeStartISO = cursor > from ? cursor : from;
    const rangeEndISO = weekSunday < to ? weekSunday : to;
    weeks.push({
      weekStart: startOfDayPH(cursor),
      weekEnd: endOfDayPH(weekSunday),
      rangeStart: startOfDayPH(rangeStartISO),
      rangeEnd: endOfDayPH(rangeEndISO),
      label: shortLabel(cursor, weekSunday),
    });
    cursor = addDaysISO(cursor, 7);
  }
  return weeks;
}

/** The current Manila week: Monday through Sunday (as YYYY-MM-DD strings). */
export function currentWeekRange(): { from: string; to: string } {
  const today = todayPH();
  return { from: mondayOf(today), to: sundayOf(today) };
}

/** Validate a from/to pair. Returns an error message, or null when valid. */
export function validateRange(from: string, to: string): string | null {
  if (!DATE_RE.test(from)) return `Invalid from date: ${from}`;
  if (!DATE_RE.test(to)) return `Invalid to date: ${to}`;
  if (from > to) return "from must be on or before to";
  const days = (isoToUTC(to) - isoToUTC(from)) / 86400000 + 1;
  if (days > 366) return "Range too long (max 366 days)";
  return null;
}

/** Days in the range (inclusive). */
export function rangeDays(from: string, to: string): number {
  return (isoToUTC(to) - isoToUTC(from)) / 86400000 + 1;
}

/**
 * Format a Date in Manila time. Defaults to "dd-mmm-yyyy".
 * Always passes timeZone: "Asia/Manila" so results never depend on server TZ.
 */
export function formatPH(
  date: Date,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }
): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: PH_TZ, ...opts }).format(date);
}
