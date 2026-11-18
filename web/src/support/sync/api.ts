import { readSetting, removeSetting, writeSetting } from "../settings";

/// Talking to the Donedey API (the Cloudflare Worker in `api/`), and the
/// signed-in session it hands out.

/// Where the API lives, from `VITE_API_URL` at build time. Without one the
/// app has no accounts at all and hides everything to do with them.
export const apiURL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
export const accountsAvailable = apiURL !== "";

export interface Account {
  id: string;
  name: string;
}

export interface Session {
  token: string;
  account: Account;
}

/// Not part of `keys` in settings.ts on purpose: a backup must never carry a
/// sign-in token to another device.
export const sessionKey = "syncSession";
/// The account the data on this device belongs to. It outlives the session,
/// so signing back in to the same account after being signed out carries on
/// where it left off, while a different account starts from a clean device.
export const ownerKey = "syncOwner";

export const readSession = () => readSetting<Session | null>(sessionKey, null);
export const saveSession = (session: Session) => writeSetting(sessionKey, session);
export const clearSession = () => removeSetting(sessionKey);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/// True when the request never reached the server: offline, or the server
/// is down. The app keeps working and syncs later.
export const isOffline = (error: unknown) => error instanceof ApiError && error.status === 0;

/// Sends a request with the session's token. A 401 means the session has
/// ended (expired, or signed out on the server), so it's dropped here and
/// the app shows "Sign In" again.
export async function request(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const session = readSession();
  if (session) headers.set("Authorization", `Bearer ${session.token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  let response: Response;
  try {
    response = await fetch(`${apiURL}${path}`, { ...init, headers, body, cache: "no-store" });
  } catch {
    throw new ApiError(0, "You’re offline.");
  }
  if (response.ok) return response;

  let message = `The server answered ${response.status}.`;
  let code: string | undefined;
  try {
    const parsed = (await response.json()) as { error?: string; code?: string };
    if (parsed.error) message = parsed.error;
    code = parsed.code;
  } catch {
    // Not JSON: keep the generic message.
  }
  if (response.status === 401 && session) clearSession();
  throw new ApiError(response.status, message, code);
}

export async function requestJSON<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  return (await (await request(path, init)).json()) as T;
}
