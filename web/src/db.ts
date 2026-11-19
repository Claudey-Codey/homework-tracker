import Dexie, { type EntityTable } from "dexie";
import type { ReminderUnit } from "./support/reminders";

/// The web counterpart of the SwiftData models. Child lists (checklist steps,
/// study notes, reminders) live inside their parent record rather than in
/// tables of their own: they're tiny, always loaded with the parent, and this
/// way deleting an assignment or exam takes them with it for free.

export interface Subject {
  id: string;
  name: string;
  isActive: boolean;
  colorHex: string;
  createdAt: number;
}

/// One lead time before an item is due — "1 week before".
export interface Reminder {
  id: string;
  count: number;
  unit: ReminderUnit;
}

/// One step in an assignment's optional to-do list. Array order is list order.
export interface ChecklistItem {
  id: string;
  text: string;
  isDone: boolean;
}

/// A single note — an exam's study material or an assignment's content. Like the Notes app, the first line doubles as the
/// title and the rest is the preview. Stored as Markdown.
export interface StudyNote {
  id: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

/// A picture or PDF attached to an assignment or exam. Only this description
/// lives on the record; the bytes sit in `files` under `imageKey(id)`, so
/// listing assignments and exams doesn't drag every file along with it.
export interface ImageAttachment {
  id: string;
  /// The original filename, shown in the list.
  name: string;
  createdAt: number;
  /// The MIME type. Missing on images saved before PDFs could be attached,
  /// so anything without one is an image.
  type?: string;
}

/// An exam's score out of 100, or null for none. Also reads the free-text
/// scores saved before scores were out of 100: "88" is 88, and "18/20"
/// becomes 90.
export function examScore(exam: Exam): number | null {
  const { score } = exam;
  if (score === undefined || score === "") return null;
  if (typeof score === "number") return score;
  const fraction = score.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
  const value = fraction ? (Number(fraction[1]) / Number(fraction[2])) * 100 : parseFloat(score);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null;
}

export const isPdf = (attachment: ImageAttachment) => attachment.type === "application/pdf";

export const imageKey = (id: string) => `image:${id}`;

export interface Assignment {
  id: string;
  title: string;
  /// Milliseconds since 1970. When `hasTime` is false only the date matters
  /// and the time is normalized to the end of the day.
  dueDate: number;
  hasTime: boolean;
  isDone: boolean;
  subjectId: string | null;
  checklist: ChecklistItem[];
  /// Free-form content notes. Missing on assignments saved before notes
  /// existed, so read it as `notes ?? []`.
  notes?: StudyNote[];
  /// Attached pictures and PDFs. Missing on records from before images existed.
  images?: ImageAttachment[];
  reminders: Reminder[];
  createdAt: number;
}

export interface Exam {
  id: string;
  title: string;
  date: number;
  hasTime: boolean;
  subjectId: string | null;
  notes: StudyNote[];
  /// Attached pictures and PDFs. Missing on records from before images existed.
  images?: ImageAttachment[];
  reminders: Reminder[];
  /// The mark you got out of 100, a whole number from 0 to 100. Missing
  /// means no score yet, and the exam's row then shows nothing for it.
  /// Exams saved while the score was free text hold a string; read it with
  /// `examScore`.
  score?: number | string;
  createdAt: number;
}

/// Binary blobs that don't belong in localStorage — the profile photo and
/// attached images and PDFs.
export interface StoredFile {
  key: string;
  blob: Blob;
}

class TaskDatabase extends Dexie {
  subjects!: EntityTable<Subject, "id">;
  assignments!: EntityTable<Assignment, "id">;
  exams!: EntityTable<Exam, "id">;
  files!: EntityTable<StoredFile, "key">;

  constructor() {
    super("taskmng");
    this.version(1).stores({
      subjects: "id, name",
      assignments: "id, dueDate, subjectId",
      exams: "id, date, subjectId",
      files: "key",
    });
  }
}

export const db = new TaskDatabase();

/// Deleting a subject unlinks its assignments and exams rather than deleting
/// them — the same `.nullify` rule as the iOS app.
export async function deleteSubject(id: string) {
  await db.transaction("rw", db.subjects, db.assignments, db.exams, async () => {
    await db.assignments.where("subjectId").equals(id).modify({ subjectId: null });
    await db.exams.where("subjectId").equals(id).modify({ subjectId: null });
    await db.subjects.delete(id);
  });
}

/// Deleting an assignment or exam takes its image and PDF files with it.
export async function deleteAssignment(id: string) {
  await db.transaction("rw", db.assignments, db.files, async () => {
    const assignment = await db.assignments.get(id);
    await db.files.bulkDelete((assignment?.images ?? []).map((image) => imageKey(image.id)));
    await db.assignments.delete(id);
  });
}

export async function deleteExam(id: string) {
  await db.transaction("rw", db.exams, db.files, async () => {
    const exam = await db.exams.get(id);
    await db.files.bulkDelete((exam?.images ?? []).map((image) => imageKey(image.id)));
    await db.exams.delete(id);
  });
}

/// Ask the browser not to evict our data under storage pressure. Safari
/// grants this to Home Screen apps; elsewhere it's a harmless no-op.
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}
