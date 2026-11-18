import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { base64url, fromBase64url, HttpError, json, randomToken, readJSON, sha256, type Env } from "./http";

/// Accounts and passkeys. There are no passwords: creating an account makes a
/// passkey (Face ID or Touch ID on an iPhone, saved in iCloud Keychain), and
/// signing in uses it. A successful ceremony hands back a session token that
/// the app sends as `Authorization: Bearer …`.

const rpName = "Donedey";
const challengeLifetime = 5 * 60 * 1000;
const sessionLifetime = 365 * 24 * 60 * 60 * 1000;

export interface Account {
  id: string;
  name: string;
}

interface Challenge {
  challenge: string;
  user_id: string | null;
  name: string | null;
}

/// A passkey belongs to a host name (its "relying party"), so the page's own
/// host is used: claudey-codey.github.io in production, localhost when testing.
const rpID = (origin: string) => new URL(origin).hostname;

async function saveChallenge(env: Env, challenge: string, userId?: string, name?: string): Promise<string> {
  const id = randomToken(16);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM challenges WHERE expires_at < ?1").bind(now),
    env.DB.prepare("INSERT INTO challenges (id, challenge, user_id, name, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)").bind(
      id,
      challenge,
      userId ?? null,
      name ?? null,
      now + challengeLifetime,
    ),
  ]);
  return id;
}

/// Each challenge can be used once, so it's deleted as it's read.
async function takeChallenge(env: Env, id: unknown): Promise<Challenge> {
  if (typeof id !== "string") throw new HttpError(400, "Missing challengeId.");
  const row = await env.DB.prepare(
    "DELETE FROM challenges WHERE id = ?1 AND expires_at >= ?2 RETURNING challenge, user_id, name",
  )
    .bind(id, Date.now())
    .first<Challenge>();
  if (!row) throw new HttpError(400, "That took too long. Try again.");
  return row;
}

async function startSession(env: Env, account: Account): Promise<Response> {
  const token = randomToken();
  const now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(await sha256(token), account.id, now, now + sessionLifetime)
    .run();
  return json({ token, account });
}

/// Step 1 of creating an account: options for `navigator.credentials.create`.
export async function registerOptions(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await readJSON<{ name?: unknown }>(request);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) throw new HttpError(400, "Enter your name.");

  const userId = crypto.randomUUID();
  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpID(origin),
    userName: name,
    userDisplayName: name,
    userID: new Uint8Array(new TextEncoder().encode(userId)),
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  const challengeId = await saveChallenge(env, options.challenge, userId, name);
  return json({ challengeId, options });
}

/// Step 2: checks the new passkey, then creates the account and signs in.
export async function registerVerify(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await readJSON<{ challengeId?: unknown; response?: RegistrationResponseJSON }>(request);
  const pending = await takeChallenge(env, body.challengeId);
  if (!pending.user_id || !pending.name || !body.response) throw new HttpError(400, "Missing passkey.");

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID(origin),
      requireUserVerification: false,
    });
  } catch (error) {
    throw new HttpError(400, `The passkey couldn't be checked: ${(error as Error).message}`);
  }
  if (!verification.verified) throw new HttpError(400, "The passkey couldn't be checked.");

  const { credential } = verification.registrationInfo;
  const now = Date.now();
  const account: Account = { id: pending.user_id, name: pending.name };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, name, created_at) VALUES (?1, ?2, ?3)").bind(account.id, account.name, now),
    env.DB.prepare(
      "INSERT INTO passkeys (id, user_id, public_key, counter, transports, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(
      credential.id,
      account.id,
      base64url(credential.publicKey),
      credential.counter,
      JSON.stringify(credential.transports ?? []),
      now,
    ),
  ]);
  return startSession(env, account);
}

/// Step 1 of signing in. No account is named: the browser offers whichever
/// Donedey passkeys the device has.
export async function loginOptions(env: Env, origin: string): Promise<Response> {
  const options = await generateAuthenticationOptions({ rpID: rpID(origin), userVerification: "preferred" });
  const challengeId = await saveChallenge(env, options.challenge);
  return json({ challengeId, options });
}

/// Step 2: finds the account the chosen passkey belongs to and checks the
/// signature.
export async function loginVerify(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await readJSON<{ challengeId?: unknown; response?: AuthenticationResponseJSON }>(request);
  const { challenge } = await takeChallenge(env, body.challengeId);
  if (!body.response?.id) throw new HttpError(400, "Missing passkey.");

  const passkey = await env.DB.prepare(
    `SELECT passkeys.id, passkeys.public_key, passkeys.counter, passkeys.transports, users.id AS user_id, users.name
     FROM passkeys JOIN users ON users.id = passkeys.user_id WHERE passkeys.id = ?1`,
  )
    .bind(body.response.id)
    .first<{ id: string; public_key: string; counter: number; transports: string | null; user_id: string; name: string }>();
  if (!passkey) {
    // The app tells the browser about it, so the dead passkey stops being offered.
    return json({ error: "This passkey's account no longer exists.", code: "unknown_passkey" }, 404);
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID(origin),
      requireUserVerification: false,
      credential: {
        id: passkey.id,
        publicKey: fromBase64url(passkey.public_key),
        counter: passkey.counter,
        transports: passkey.transports ? (JSON.parse(passkey.transports) as string[]) : undefined,
      },
    });
  } catch (error) {
    throw new HttpError(400, `The passkey couldn't be checked: ${(error as Error).message}`);
  }
  if (!verification.verified) throw new HttpError(401, "The passkey couldn't be checked.");

  await env.DB.prepare("UPDATE passkeys SET counter = ?2, last_used_at = ?3 WHERE id = ?1")
    .bind(passkey.id, verification.authenticationInfo.newCounter, Date.now())
    .run();
  return startSession(env, { id: passkey.user_id, name: passkey.name });
}

/// The account a request's bearer token belongs to. Throws 401 when the token
/// is missing, unknown or expired.
export async function authenticate(request: Request, env: Env): Promise<Account & { tokenHash: string }> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Sign in to continue.");
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT users.id, users.name FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?1 AND sessions.expires_at > ?2`,
  )
    .bind(tokenHash, Date.now())
    .first<Account>();
  if (!row) throw new HttpError(401, "You've been signed out. Sign in again.");
  return { ...row, tokenHash };
}

export async function signOut(env: Env, tokenHash: string): Promise<Response> {
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
  return json({ ok: true });
}

/// Deletes the account, its passkeys, sessions and records (through ON DELETE
/// CASCADE), and every file it uploaded. Returns the passkey ids so the app
/// can ask the browser to forget them.
export async function deleteAccount(env: Env, account: Account): Promise<Response> {
  const passkeys = await env.DB.prepare("SELECT id FROM passkeys WHERE user_id = ?1")
    .bind(account.id)
    .all<{ id: string }>();

  let cursor: string | undefined;
  do {
    const page = await env.FILES.list({ prefix: `${account.id}/`, cursor });
    if (page.objects.length > 0) await env.FILES.delete(page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(account.id).run();
  return json({ ok: true, passkeyIds: passkeys.results.map((row) => row.id) });
}
