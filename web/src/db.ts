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

/// A single study note. Like the Notes app, the first line doubles as the
/// title and the rest is the preview. Stored as Markdown.
export interface StudyNote {
  id: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

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
  reminders: Reminder[];
  createdAt: number;
}

/// Binary blobs that don't belong in localStorage — the profile photo.
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

/// Ask the browser not to evict our data under storage pressure. Safari
/// grants this to Home Screen apps; elsewhere it's a harmless no-op.
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}
