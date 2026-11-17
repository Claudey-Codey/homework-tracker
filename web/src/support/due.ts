import type { Assignment } from "../db";
import { addDays } from "./dates";

/// Sections the Assignments dashboard groups items into.
export type DueSection = "overdue" | "thisWeek" | "later" | "done";

export const dueSections: { id: DueSection; title: string }[] = [
  { id: "overdue", title: "Overdue" },
  { id: "thisWeek", title: "This Week" },
  { id: "later", title: "Later" },
  { id: "done", title: "Completed" },
];

export function dueSection(assignment: Assignment, now = new Date()): DueSection {
  if (assignment.isDone) return "done";
  if (assignment.dueDate < now.getTime()) return "overdue";
  if (assignment.dueDate <= addDays(now, 7).getTime()) return "thisWeek";
  return "later";
}

/// Red when overdue, orange when due within two days, normal otherwise.
/// Returns a CSS colour so it drops straight into `style`.
export function urgencyColor(date: number, isDone: boolean, now = new Date()): string {
  if (isDone) return "var(--label-2)";
  if (date < now.getTime()) return "var(--red)";
  if (date <= addDays(now, 2).getTime()) return "var(--orange)";
  return "var(--label)";
}
