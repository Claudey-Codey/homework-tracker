/// `crypto.randomUUID` only exists on secure origins (https, localhost), so a
/// dev server opened over the LAN needs the fallback.
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
