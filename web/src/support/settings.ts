import { useCallback, useSyncExternalStore } from "react";

/// The web's `@AppStorage`: small preferences kept in localStorage, with every
/// component reading a key re-rendering when any other one writes it.

const listeners = new Set<() => void>();
const changeEvent = "taskmng-setting";

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  window.addEventListener(changeEvent, listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener(changeEvent, listener);
  };
}

/// Raw string read, so `useSyncExternalStore` compares cheaply.
function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readSetting<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeSetting<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or a full disk: the setting just won't stick.
  }
  window.dispatchEvent(new Event(changeEvent));
}

export function removeSetting(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing stored, or storage unavailable: either way it's gone.
  }
  window.dispatchEvent(new Event(changeEvent));
}

/// Calls `listener` whenever any setting is written, here or in another tab.
export const subscribeToSettings = subscribe;

export function useSetting<T>(key: string, fallback: T): [T, (value: T) => void] {
  const raw = useSyncExternalStore(subscribe, () => readRaw(key));
  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      // Keep the fallback.
    }
  }
  const set = useCallback((next: T) => writeSetting(key, next), [key]);
  return [value, set];
}

/// Every key in one place, named after the iOS app's `@AppStorage` keys.
export const keys = {
  accent: "accentColorHex",
  appearance: "appearanceMode",
  showTabLabels: "showTabLabels",
  feedbackEnabled: "feedbackEnabled",
  accountName: "accountName",
  avatarHex: "accountAvatarHex",
  avatarKind: "accountAvatarKind",
  avatarEmoji: "accountAvatarEmoji",
  avatarPreset: "accountAvatarPreset",
} as const;
