import { sendSignal, startAuthentication, startRegistration, WebAuthnError } from "@simplewebauthn/browser";
import { useSyncExternalStore } from "react";
import { db } from "../../db";
import { keys, readSetting, removeSetting, useSetting, writeSetting } from "../settings";
import {
  ApiError,
  clearSession,
  ownerKey,
  readSession,
  requestJSON,
  saveSession,
  sessionKey,
  type Account,
  type Session,
} from "./api";
import { getSyncStatus, resetSyncStatus, subscribeToSyncStatus, syncNow } from "./engine";

/// Creating an account, signing in and out, and deleting the account. Each
/// throws an Error with a message ready for an alert, or a `PasskeyCancelled`
/// when the person closed the passkey sheet (which needs no alert).

export class PasskeyCancelled extends Error {}

/// The passkey sheet throws a NotAllowedError both when it's cancelled and
/// when it times out; neither deserves an error message.
function passkeyError(error: unknown): Error {
  if (error instanceof WebAuthnError && error.code === "ERROR_CEREMONY_ABORTED") return new PasskeyCancelled();
  if (error instanceof Error && error.name === "NotAllowedError") return new PasskeyCancelled();
  if (error instanceof WebAuthnError && error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    return new Error("This device already has a passkey for that account.");
  }
  if (error instanceof ApiError) return error;
  return new Error("Passkeys aren’t available here. On iPhone, use Safari or the Home Screen app.");
}

/// Everything signing out removes: the data and the profile, which now live
/// in the account.
async function clearLocalData() {
  await db.transaction("rw", [db.subjects, db.assignments, db.exams, db.files, db.syncState], async () => {
    await Promise.all([db.subjects.clear(), db.assignments.clear(), db.exams.clear(), db.files.clear(), db.syncState.clear()]);
  });
  for (const key of [keys.accountName, keys.avatarHex, keys.avatarKind, keys.avatarEmoji, keys.avatarPreset]) {
    removeSetting(key);
  }
  resetSyncStatus();
}

/// Makes a passkey and an account named `name`, then uploads everything on
/// this device to it.
export async function createAccount(name: string): Promise<void> {
  const { challengeId, options } = await requestJSON<{ challengeId: string; options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>(
    "/auth/register/options",
    { method: "POST", json: { name } },
  );
  let response;
  try {
    response = await startRegistration({ optionsJSON: options });
  } catch (error) {
    throw passkeyError(error);
  }
  const session = await requestJSON<Session>("/auth/register/verify", {
    method: "POST",
    json: { challengeId, response },
  });

  // A new account starts from what's here, even if it came from another
  // account whose session ended: forget what was synced so all of it uploads.
  await db.syncState.clear();
  resetSyncStatus();
  writeSetting(keys.accountName, session.account.name);
  begin(session);
}

/// Signs in with a passkey this device (or iCloud Keychain) has.
export async function signIn(): Promise<void> {
  const { challengeId, options } = await requestJSON<{ challengeId: string; options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }>(
    "/auth/login/options",
    { method: "POST" },
  );
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options });
  } catch (error) {
    throw passkeyError(error);
  }

  let session: Session;
  try {
    session = await requestJSON<Session>("/auth/login/verify", { method: "POST", json: { challengeId, response } });
  } catch (error) {
    if (error instanceof ApiError && error.code === "unknown_passkey") {
      // Tells Safari / iCloud Keychain to stop offering it.
      void sendSignal({ signalName: "unknownCredential", rpID: location.hostname, credentialID: response.id }).catch(() => {});
      throw new Error("That passkey’s account was deleted. Create a new account, or choose another passkey.");
    }
    throw error;
  }

  // This device's data belongs to another account: it's in that account
  // already, so start clean rather than mixing the two.
  const owner = readSetting<string | null>(ownerKey, null);
  if (owner && owner !== session.account.id) await clearLocalData();
  begin(session);
}

function begin(session: Session) {
  saveSession(session);
  writeSetting(ownerKey, session.account.id);
  void syncNow();
}

/// Sends anything not yet synced. Resolves to false when that failed, so
/// the caller can warn that signing out would lose it.
export async function finishSyncing(): Promise<boolean> {
  await syncNow();
  return getSyncStatus().state === "idle";
}

/// Ends the session here and removes the account's data from this device.
export async function signOut(): Promise<void> {
  try {
    await requestJSON("/auth/signout", { method: "POST" });
  } catch {
    // Offline or already ended: the token is forgotten here either way.
  }
  clearSession();
  removeSetting(ownerKey);
  await clearLocalData();
}

/// Deletes the account and everything in it from the server. What's on this
/// device stays, no longer synced.
export async function deleteAccount(): Promise<void> {
  const result = await requestJSON<{ passkeyIds: string[] }>("/account", { method: "DELETE" });
  for (const credentialID of result.passkeyIds) {
    void sendSignal({ signalName: "unknownCredential", rpID: location.hostname, credentialID }).catch(() => {});
  }
  clearSession();
  removeSetting(ownerKey);
  await db.syncState.clear();
  resetSyncStatus();
}

/// The signed-in account, or null. `expired` is true when this device's
/// data belongs to an account but the session has ended.
export function useAccountSession(): { account: Account | null; expired: boolean } {
  const [session] = useSetting<Session | null>(sessionKey, null);
  const [owner] = useSetting<string | null>(ownerKey, null);
  return { account: session?.account ?? null, expired: !session && owner !== null };
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribeToSyncStatus, getSyncStatus);
}

export { readSession };
