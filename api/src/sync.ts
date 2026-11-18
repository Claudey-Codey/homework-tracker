import type { Account } from "./auth";
import { HttpError, json, readJSON, type Env } from "./http";

/// Records (subjects, assignments, exams, the profile) and their files.
///
/// Every stored change gets the account's next `seq`. A device remembers the
/// highest one it has seen and asks for everything after it, which gives it
/// other devices' edits and deletes in order. Pushing a record replaces the
/// stored copy whole; the newest push wins.

const kinds = new Set(["subject", "assignment", "exam", "profile"]);
const maxChangesPerPush = 200;
const pullPageSize = 500;
/// D1 rows top out at 2 MB; records are a few KB, notes included.
const maxRecordBytes = 1_000_000;
/// Photos and scanned PDFs. Bigger files are refused rather than half-stored.
const maxFileBytes = 50 * 1024 * 1024;
const fileKeyPattern = /^[A-Za-z0-9:_.-]{1,200}$/;

interface Change {
  kind: string;
  id: string;
  deleted: boolean;
  data?: Record<string, unknown> | null;
}

/// GET /sync?since=N — the changes after N, oldest first, a page at a time.
export async function pull(url: URL, env: Env, account: Account): Promise<Response> {
  const since = Number(url.searchParams.get("since") ?? "0");
  if (!Number.isSafeInteger(since) || since < 0) throw new HttpError(400, "since must be a whole number.");

  const { results } = await env.DB.prepare(
    `SELECT kind, id, data, deleted, seq FROM records
     WHERE user_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3`,
  )
    .bind(account.id, since, pullPageSize + 1)
    .all<{ kind: string; id: string; data: string | null; deleted: number; seq: number }>();

  const more = results.length > pullPageSize;
  const page = more ? results.slice(0, pullPageSize) : results;
  return json({
    changes: page.map((row) => ({
      kind: row.kind,
      id: row.id,
      deleted: row.deleted === 1,
      data: row.data === null ? null : JSON.parse(row.data),
    })),
    cursor: page.length > 0 ? page[page.length - 1]!.seq : since,
    more,
  });
}

/// POST /sync — stores a batch of changes. All of them get new seq numbers
/// in one transaction, so a device pulling at the same moment sees either
/// none or all of them, never a gap it would skip over.
export async function push(request: Request, env: Env, account: Account): Promise<Response> {
  const body = await readJSON<{ changes?: unknown }>(request);
  if (!Array.isArray(body.changes)) throw new HttpError(400, "changes must be a list.");
  if (body.changes.length > maxChangesPerPush) throw new HttpError(413, "Too many changes in one request.");

  const changes: Change[] = body.changes.map((value): Change => {
    const change = value as Partial<Change>;
    if (typeof change.kind !== "string" || !kinds.has(change.kind)) throw new HttpError(400, "Unknown record kind.");
    if (typeof change.id !== "string" || change.id.length === 0 || change.id.length > 100) {
      throw new HttpError(400, "Record ids must be 1 to 100 characters.");
    }
    if (change.deleted === true) return { kind: change.kind, id: change.id, deleted: true, data: null };
    if (!change.data || typeof change.data !== "object" || Array.isArray(change.data)) {
      throw new HttpError(400, "A record's data must be an object.");
    }
    if (JSON.stringify(change.data).length > maxRecordBytes) throw new HttpError(413, "A record is too large.");
    return { kind: change.kind, id: change.id, deleted: false, data: change.data };
  });
  if (changes.length === 0) return json({ ok: true });

  const count = changes.length;
  const [, , last] = await env.DB.batch([
    env.DB.prepare("UPDATE users SET seq = seq + ?2 WHERE id = ?1").bind(account.id, count),
    // One statement for the whole batch: the changes go in as a single JSON
    // parameter (D1 caps bound parameters at 100 per statement).
    env.DB.prepare(
      `INSERT INTO records (user_id, kind, id, data, deleted, seq, updated_at)
       SELECT ?1,
              json_extract(value, '$.kind'),
              json_extract(value, '$.id'),
              CASE WHEN json_extract(value, '$.deleted') THEN NULL ELSE json_extract(value, '$.data') END,
              CASE WHEN json_extract(value, '$.deleted') THEN 1 ELSE 0 END,
              (SELECT seq FROM users WHERE id = ?1) - ?2 + key + 1,
              ?3
       FROM json_each(?4) WHERE true
       ON CONFLICT (user_id, kind, id) DO UPDATE SET
         data = excluded.data, deleted = excluded.deleted, seq = excluded.seq, updated_at = excluded.updated_at`,
    ).bind(account.id, count, Date.now(), JSON.stringify(changes)),
    env.DB.prepare("SELECT seq FROM users WHERE id = ?1").bind(account.id),
  ]);
  const seq = (last?.results[0] as { seq: number } | undefined)?.seq ?? 0;
  return json({ ok: true, seq });
}

/// Files live in R2 under the account's id, named by the app's own key
/// ("image:<id>", "avatarPhoto").
function objectKey(account: Account, key: string): string {
  if (!fileKeyPattern.test(key)) throw new HttpError(400, "That isn't a valid file name.");
  return `${account.id}/${key}`;
}

export async function getFile(key: string, env: Env, account: Account): Promise<Response> {
  const object = await env.FILES.get(objectKey(account, key));
  if (!object) throw new HttpError(404, "File not found.");
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}

export async function putFile(request: Request, key: string, env: Env, account: Account): Promise<Response> {
  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (!request.body || length <= 0) throw new HttpError(411, "The file is empty.");
  if (length > maxFileBytes) throw new HttpError(413, "Files can be up to 50 MB.");
  await env.FILES.put(objectKey(account, key), request.body, {
    httpMetadata: { contentType: request.headers.get("Content-Type") ?? "application/octet-stream" },
  });
  return json({ ok: true });
}

export async function deleteFile(key: string, env: Env, account: Account): Promise<Response> {
  await env.FILES.delete(objectKey(account, key));
  return json({ ok: true });
}
