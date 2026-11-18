import Dexie from "dexie";
import { db, imageKey, type Assignment, type Exam, type Subject } from "../../db";
import { defaultAvatarHex, defaultEmoji, defaultName, type AvatarKind, type AvatarPreset } from "../account";
import { keys, readSetting, subscribeToSettings, writeSetting } from "../settings";
import { accountsAvailable, ApiError, isOffline, readSession, request, requestJSON } from "./api";

/// Keeps this device and the account in step.
///
/// Each subject, assignment and exam, and the profile, is one record. The
/// last sync's view of every record is kept in `db.syncState` as a hash, so
/// a sync can tell what changed here since (the hash differs) and what was
/// deleted here (a hash with no record). A sync:
///
/// 1. pulls everything other devices stored since last time and applies it,
///    except where this device has its own unsent edit to the same record;
/// 2. downloads files that records point to but this device doesn't have;
/// 3. uploads new files, then sends this device's changed and deleted
///    records.
///
/// So the newest edit wins, record by record. On the very first sync after
/// signing in, the account's copy wins instead, so a fresh device's default
/// profile doesn't overwrite the real one.

type Kind = "subject" | "assignment" | "exam" | "profile";

interface Change {
  kind: Kind;
  id: string;
  deleted: boolean;
  data: Record<string, unknown> | null;
}

/// The account profile as it travels: the Account tab's name and avatar,
/// plus a fingerprint of the photo, which travels as a file.
interface Profile {
  name: string;
  colorHex: string;
  avatarKind: AvatarKind;
  emoji: string;
  preset: AvatarPreset;
  photo: string | null;
}

const profileId = "account";
const photoKey = "avatarPhoto";
const cursorKey = "meta:cursor";
const initializedKey = "meta:initialized";
const pushBatchSize = 100;
/// Keeps a push request well under the Worker's body limit.
const pushBatchBytes = 2_000_000;

// MARK: - Status

export type SyncState = "idle" | "syncing" | "offline" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSynced: number | null;
  /// Set when `state` is "error".
  message: string | null;
}

/// Kept straight in localStorage rather than through `writeSetting`, whose
/// change event would itself start another sync.
const lastSyncedKey = "syncLastSynced";

let status: SyncStatus = { state: "idle", lastSynced: readSetting<number | null>(lastSyncedKey, null), message: null };
const statusListeners = new Set<() => void>();

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  if (next.lastSynced != null) {
    try {
      localStorage.setItem(lastSyncedKey, JSON.stringify(next.lastSynced));
    } catch {
      // Only the "Synced …" time is lost.
    }
  }
  statusListeners.forEach((listener) => listener());
}

/// Forgets when the last sync was, for signing out.
export function resetSyncStatus() {
  try {
    localStorage.removeItem(lastSyncedKey);
  } catch {
    // Nothing to forget.
  }
  setStatus({ state: "idle", lastSynced: null, message: null });
}

export const getSyncStatus = () => status;
export function subscribeToSyncStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

// MARK: - Hashing

/// JSON with keys in a fixed order, so the same record always hashes the
/// same however its keys were ordered when it was written.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/// cyrb53: a fast 53-bit string hash. Only used to notice changes, never for
/// security.
function hashString(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const hashRecord = (data: unknown) => hashString(stableStringify(data));

/// Attached images and PDFs never change once saved (a new file gets a new
/// id), so their size and type are enough. The profile photo is replaced in
/// place, so it's fingerprinted by its contents.
async function fingerprint(key: string, blob: Blob): Promise<string> {
  if (key !== photoKey) return `${blob.size}:${blob.type}`;
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest).slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// MARK: - Local records

async function readProfile(): Promise<Profile> {
  const photo = await db.files.get(photoKey);
  return {
    name: readSetting(keys.accountName, defaultName),
    colorHex: readSetting(keys.avatarHex, defaultAvatarHex),
    avatarKind: readSetting<AvatarKind>(keys.avatarKind, "initials"),
    emoji: readSetting(keys.avatarEmoji, defaultEmoji),
    preset: readSetting<AvatarPreset>(keys.avatarPreset, "aurora"),
    photo: photo ? await fingerprint(photoKey, photo.blob) : null,
  };
}

function writeProfile(profile: Profile) {
  writeSetting(keys.accountName, profile.name);
  writeSetting(keys.avatarHex, profile.colorHex);
  writeSetting(keys.avatarKind, profile.avatarKind);
  writeSetting(keys.avatarEmoji, profile.emoji);
  writeSetting(keys.avatarPreset, profile.preset);
}

/// Every record on this device, keyed "kind:id".
async function localRecords(): Promise<Map<string, Change>> {
  const [subjects, assignments, exams, profile] = await Promise.all([
    db.subjects.toArray(),
    db.assignments.toArray(),
    db.exams.toArray(),
    readProfile(),
  ]);
  const records = new Map<string, Change>();
  const add = (kind: Kind, id: string, data: object) =>
    records.set(`${kind}:${id}`, { kind, id, deleted: false, data: data as Record<string, unknown> });
  subjects.forEach((subject) => add("subject", subject.id, subject));
  assignments.forEach((assignment) => add("assignment", assignment.id, assignment));
  exams.forEach((exam) => add("exam", exam.id, exam));
  add("profile", profileId, profile);
  return records;
}

const imageIds = (record: Assignment | Exam | undefined | null) => (record?.images ?? []).map((image) => image.id);

// MARK: - Sync

let running: Promise<void> | null = null;
let again = false;

/// Runs a sync now, or right after the one in progress. Never throws: the
/// outcome shows in the status.
export function syncNow(): Promise<void> {
  if (!accountsAvailable || !readSession()) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      setStatus({ state: "syncing", message: null });
      try {
        await runSync();
        setStatus({ state: "idle", lastSynced: Date.now(), message: null });
      } catch (error) {
        if (isOffline(error)) setStatus({ state: "offline", message: null });
        else if (error instanceof ApiError && error.status === 401) setStatus({ state: "idle", message: null });
        else setStatus({ state: "error", message: (error as Error).message || "Something went wrong." });
        again = false;
      }
    } while (again && readSession());
  })().finally(() => {
    running = null;
  });
  return running;
}

async function runSync() {
  const initial = !(await db.syncState.get(initializedKey));
  const photoWanted = await pull(initial);
  await downloadMissingFiles(photoWanted);
  await pushChanges();
  if (initial) await db.syncState.put({ key: initializedKey, value: "1" });
}

/// Pulls and applies remote changes a page at a time. Returns the profile
/// photo's fingerprint when a new photo needs downloading.
async function pull(initial: boolean): Promise<string | null> {
  let photoWanted: string | null = null;
  let more = true;
  while (more) {
    const since = (await db.syncState.get(cursorKey))?.value ?? "0";
    const page = await requestJSON<{ changes: Change[]; cursor: number; more: boolean }>(`/sync?since=${since}`);
    let profile: Profile | null = null;
    // Read up front: hashing the photo can't happen inside a transaction,
    // which closes as soon as it waits on anything but the database.
    const localProfileHash = hashRecord(await readProfile());

    await db.transaction("rw", [db.subjects, db.assignments, db.exams, db.files, db.syncState], async () => {
      for (const change of page.changes) {
        const key = `${change.kind}:${change.id}`;
        const synced = (await db.syncState.get(key))?.value ?? null;
        const local = change.kind === "profile" ? undefined : await table(change.kind)?.get(change.id);
        const localHash = change.kind === "profile" ? localProfileHash : local ? hashRecord(local) : null;
        const remoteHash = change.deleted ? null : hashRecord(change.data);

        if (remoteHash !== localHash) {
          // An edit here that hasn't been sent yet wins over the server's
          // copy, and goes up in this same sync. A fresh device defers.
          const editedHere = localHash !== synced;
          if (editedHere && !initial) continue;
          if (change.kind === "profile") {
            if (change.data) profile = change.data as unknown as Profile;
          } else {
            await applyRecord(change, local as Assignment | Exam | Subject | undefined);
          }
        }
        if (remoteHash === null) await db.syncState.delete(key);
        else await db.syncState.put({ key, value: remoteHash });
      }
      if (String(page.cursor) !== since) await db.syncState.put({ key: cursorKey, value: String(page.cursor) });
    });

    if (profile) {
      const remote: Profile = profile;
      writeProfile(remote);
      const photo = await db.files.get(photoKey);
      if (!remote.photo) {
        await db.files.delete(photoKey);
        await db.syncState.delete(`file:${photoKey}`);
      } else if (!photo || (await fingerprint(photoKey, photo.blob)) !== remote.photo) {
        photoWanted = remote.photo;
      }
    }
    more = page.more;
  }
  return photoWanted;
}

function table(kind: Kind) {
  if (kind === "subject") return db.subjects;
  if (kind === "assignment") return db.assignments;
  if (kind === "exam") return db.exams;
  return null;
}

/// Writes one remote record here. Files the old version pointed to and the
/// new one doesn't are deleted (the device that removed them deletes them
/// on the server).
async function applyRecord(change: Change, local: Assignment | Exam | Subject | undefined) {
  const target = table(change.kind);
  if (!target) return;
  if (change.kind !== "subject") {
    const kept = new Set(imageIds(change.data as unknown as Assignment | null));
    const dropped = imageIds(local as Assignment | undefined).filter((id) => !kept.has(id));
    await db.files.bulkDelete(dropped.map(imageKey));
    await db.syncState.bulkDelete(dropped.map((id) => `file:${imageKey(id)}`));
  }
  if (change.deleted) await target.delete(change.id);
  else await (target as Dexie.Table).put(change.data);
}

/// Fetches files that records point to but this device doesn't have yet.
/// One the other device hasn't uploaded yet (404) is tried again next time.
async function downloadMissingFiles(photoWanted: string | null) {
  const [assignments, exams, present] = await Promise.all([
    db.assignments.toArray(),
    db.exams.toArray(),
    db.files.toCollection().primaryKeys(),
  ]);
  const have = new Set(present);
  const wanted = [...assignments, ...exams].flatMap((record) => imageIds(record).map(imageKey));
  const missing = wanted.filter((key) => !have.has(key));
  if (photoWanted) missing.push(photoKey);

  for (const key of missing) {
    let blob: Blob;
    try {
      blob = await (await request(`/files/${encodeURIComponent(key)}`)).blob();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) continue;
      throw error;
    }
    const print = await fingerprint(key, blob);
    await db.transaction("rw", db.files, db.syncState, async () => {
      await db.files.put({ key, blob });
      await db.syncState.put({ key: `file:${key}`, value: print });
    });
  }
}

async function pushChanges() {
  // Files first, so a record never reaches another device before its files.
  const files = await db.files.toArray();
  const syncedFiles = await db.syncState.where("key").startsWith("file:").toArray();
  const syncedFileValues = new Map(syncedFiles.map((entry) => [entry.key.slice(5), entry.value]));
  for (const { key, blob } of files) {
    const print = await fingerprint(key, blob);
    if (syncedFileValues.get(key) === print) continue;
    await request(`/files/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": blob.type || "application/octet-stream" },
    });
    await db.syncState.put({ key: `file:${key}`, value: print });
  }
  const present = new Set(files.map((file) => file.key));
  for (const key of syncedFileValues.keys()) {
    if (present.has(key)) continue;
    await request(`/files/${encodeURIComponent(key)}`, { method: "DELETE" });
    await db.syncState.delete(`file:${key}`);
  }

  const local = await localRecords();
  const synced = await db.syncState
    .filter((entry) => !entry.key.startsWith("file:") && !entry.key.startsWith("meta:"))
    .toArray();
  const syncedHashes = new Map(synced.map((entry) => [entry.key, entry.value]));

  const outgoing: { key: string; hash: string | null; change: Change }[] = [];
  for (const [key, change] of local) {
    const hash = hashRecord(change.data);
    if (syncedHashes.get(key) !== hash) outgoing.push({ key, hash, change });
  }
  for (const key of syncedHashes.keys()) {
    if (local.has(key)) continue;
    const [kind, ...rest] = key.split(":");
    outgoing.push({ key, hash: null, change: { kind: kind as Kind, id: rest.join(":"), deleted: true, data: null } });
  }

  let batch: typeof outgoing = [];
  let bytes = 0;
  const send = async () => {
    if (batch.length === 0) return;
    await request("/sync", { method: "POST", json: { changes: batch.map((item) => item.change) } });
    await db.transaction("rw", db.syncState, async () => {
      for (const item of batch) {
        if (item.hash === null) await db.syncState.delete(item.key);
        else await db.syncState.put({ key: item.key, value: item.hash });
      }
    });
    batch = [];
    bytes = 0;
  };
  for (const item of outgoing) {
    const size = JSON.stringify(item.change).length;
    if (batch.length >= pushBatchSize || (batch.length > 0 && bytes + size > pushBatchBytes)) await send();
    batch.push(item);
    bytes += size;
  }
  await send();
}

// MARK: - Triggers

let started = false;
let timer: number | undefined;

/// Syncs a moment after anything changes, when the app comes back to the
/// front or back online, and every minute while it's open.
export function startAutoSync() {
  if (started || !accountsAvailable) return;
  started = true;
  const soon = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void syncNow(), 1500);
  };
  // Changes to the app's data, but not the sync's own bookkeeping, which
  // would otherwise start a sync after every sync.
  Dexie.on("storagemutated", (parts) => {
    if (Object.keys(parts).some((part) => part.startsWith("idb://") && !part.includes("/syncState/"))) soon();
  });
  subscribeToSettings(soon);
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  window.setInterval(() => {
    if (document.visibilityState === "visible") void syncNow();
  }, 60_000);
  void syncNow();
}
