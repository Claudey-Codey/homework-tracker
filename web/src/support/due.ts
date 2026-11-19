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

/// An exam that's behind you is done, not late, so its date turns green
/// rather than red. Before then it warns like an assignment: orange within
/// two days. Date-only exams count as past from the day after. Once it has a
/// score the date goes grey, so the score's colour is the only one on the row.
export function examDateColor(date: number, hasScore: boolean, now = new Date()): string {
  if (hasScore) return "var(--label-2)";
  if (date < now.getTime()) return "var(--green)";
  return urgencyColor(date, false, now);
}

/// How an exam's score reads at a glance: green from 85, orange from 70,
/// red below that.
export function scoreColor(score: number): string {
  if (score >= 85) return "var(--green)";
  if (score >= 70) return "var(--orange)";
  return "var(--red)";
}
