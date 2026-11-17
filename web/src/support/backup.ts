import { db, type Assignment, type Exam, type Subject } from "../db";
import { keys, writeSetting } from "./settings";

/// Everything the app stores, in one JSON file: subjects, assignments, exams
/// (notes and reminders ride along inside them), stored files such as images
/// and the profile photo, and the preferences in localStorage.
///
/// iPhone keeps a Home Screen app's data with that one icon, so removing the
/// icon erases it. A backup is how the data survives re-adding the app.

const format = "taskmng-backup";
const version = 1;

interface BackupFile {
  key: string;
  type: string;
  /// The bytes as a `data:` URL.
  data: string;
}

interface Backup {
  format: typeof format;
  version: number;
  createdAt: number;
  subjects: Subject[];
  assignments: Assignment[];
  exams: Exam[];
  files: BackupFile[];
  settings: Record<string, unknown>;
}

export interface BackupSummary {
  assignments: number;
  exams: number;
  subjects: number;
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataURLToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

function readSettings(): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const key of Object.values(keys)) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) settings[key] = JSON.parse(raw);
    } catch {
      // Unreadable or private mode: leave it out.
    }
  }
  return settings;
}

/// Builds the backup and hands it to the share sheet (Save to Files on
/// iPhone), or downloads it where there's no share sheet.
export async function shareBackup(): Promise<void> {
  const [subjects, assignments, exams, storedFiles] = await Promise.all([
    db.subjects.toArray(),
    db.assignments.toArray(),
    db.exams.toArray(),
    db.files.toArray(),
  ]);
  const backup: Backup = {
    format,
    version,
    createdAt: Date.now(),
    subjects,
    assignments,
    exams,
    files: await Promise.all(
      storedFiles.map(async ({ key, blob }) => ({ key, type: blob.type, data: await blobToDataURL(blob) })),
    ),
    settings: readSettings(),
  };

  const date = new Date().toISOString().slice(0, 10);
  const file = new File([JSON.stringify(backup)], `TaskMng Backup ${date}.json`, {
    type: "application/json",
  });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/// Opens the system picker for a backup file.
export function pickBackupFile(onPick: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onPick(file);
  };
  input.click();
}

/// Adds everything in a backup to the app. Items are matched by id, so
/// restoring the same backup twice doesn't duplicate anything, and nothing
/// already in the app is deleted. Throws an Error with a readable message.
export async function restoreBackup(file: File): Promise<BackupSummary> {
  let backup: Backup;
  try {
    backup = JSON.parse(await file.text()) as Backup;
  } catch {
    throw new Error("That file isn't a TaskMng backup.");
  }
  if (backup?.format !== format || !Array.isArray(backup.assignments)) {
    throw new Error("That file isn't a TaskMng backup.");
  }
  if (backup.version > version) {
    throw new Error("That backup was made by a newer version of TaskMng. Update the app and try again.");
  }

  const files = await Promise.all(
    (backup.files ?? []).map(async ({ key, data }) => ({ key, blob: await dataURLToBlob(data) })),
  );

  await db.transaction("rw", [db.subjects, db.assignments, db.exams, db.files], async () => {
    await db.subjects.bulkPut(backup.subjects ?? []);
    await db.assignments.bulkPut(backup.assignments ?? []);
    await db.exams.bulkPut(backup.exams ?? []);
    await db.files.bulkPut(files);
  });

  const known = new Set<string>(Object.values(keys));
  for (const [key, value] of Object.entries(backup.settings ?? {})) {
    if (known.has(key)) writeSetting(key, value);
  }

  return {
    assignments: backup.assignments?.length ?? 0,
    exams: backup.exams?.length ?? 0,
    subjects: backup.subjects?.length ?? 0,
  };
}
