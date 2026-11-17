/// Time unit for a reminder lead time. Paired with a count, so a reminder is
/// always "<count> <unit> before" — e.g. 2 hours before, 3 days before.
export type ReminderUnit = "minutes" | "hours" | "days" | "weeks";

export const reminderUnits: ReminderUnit[] = ["minutes", "hours", "days", "weeks"];

/// How many counts the wheel offers for each unit. Keeps the choices
/// sensible: 59 weeks is noise, 59 minutes isn't.
export const maxCount: Record<ReminderUnit, number> = {
  minutes: 59,
  hours: 23,
  days: 30,
  weeks: 8,
};

const seconds: Record<ReminderUnit, number> = {
  minutes: 60,
  hours: 3_600,
  days: 86_400,
  weeks: 604_800,
};

const singular: Record<ReminderUnit, string> = {
  minutes: "minute",
  hours: "hour",
  days: "day",
  weeks: "week",
};

export function unitName(unit: ReminderUnit, count: number): string {
  return count === 1 ? singular[unit] : singular[unit] + "s";
}

/// Lead time in milliseconds.
export function reminderOffset(count: number, unit: ReminderUnit): number {
  return Math.max(1, count) * seconds[unit] * 1000;
}

export function unitSeconds(unit: ReminderUnit): number {
  return seconds[unit];
}

/// Full sentence for the current setting, e.g. "2 hours before it's due".
export function reminderSummary(count: number, unit: ReminderUnit): string {
  const n = Math.max(1, count);
  return `${n} ${unitName(unit, n)} before it's due`;
}

/// "1 week before", "30 minutes before".
export function reminderLabel(count: number, unit: ReminderUnit): string {
  return `${count} ${unitName(unit, count)} before`;
}
