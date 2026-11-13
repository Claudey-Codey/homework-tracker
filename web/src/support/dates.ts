/// When only a date is chosen, the item is due at the very end of that day.
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0);
  return d;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function defaultDueDate(): Date {
  return startOfDay(addDays(new Date(), 1));
}

export function defaultExamDate(): Date {
  return startOfDay(addDays(new Date(), 7));
}

const pad = (n: number) => String(n).padStart(2, "0");

/// `<input type="date">` speaks "YYYY-MM-DD" in local time.
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/// Replaces the calendar day of `date`, keeping its time.
export function withDay(date: Date, value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return date;
  const next = new Date(date);
  next.setFullYear(y, m - 1, d);
  return next;
}

/// Replaces the time of `date`, keeping its day.
export function withTime(date: Date, value: string): Date {
  const [h, min] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(min)) return date;
  const next = new Date(date);
  next.setHours(h, min, 0, 0);
  return next;
}

const monthDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const mediumDate = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const shortTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/// "Nov 14" — the row format (`.dateTime.month().day()`).
export const formatMonthDay = (ms: number) => monthDay.format(ms);
/// "Nov 14, 2026" — what a compact DatePicker shows.
export const formatMediumDate = (ms: number) => mediumDate.format(ms);
/// "4:30 PM" or "16:30", following the device's locale.
export const formatTime = (ms: number) => shortTime.format(ms);
