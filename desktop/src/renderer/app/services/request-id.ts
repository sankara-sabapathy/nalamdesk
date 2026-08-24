export function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() || `consult-${Date.now()}-${Math.random()}`;
}
