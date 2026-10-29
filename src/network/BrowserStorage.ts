/** Colyseus's optional auth-token persistence must not prevent anonymous play when storage is blocked. */
const memory = new Map<string, string>();
export function getItem(key: string, callback: (value: string | null) => void): void {
  let value = memory.get(key) ?? null;
  try { value = localStorage.getItem(key) ?? value; } catch { /* memory only */ }
  callback(value);
}
export function setItem(key: string, value: string): void {
  memory.set(key, value);
  try { localStorage.setItem(key, value); } catch { /* memory only */ }
}
export function removeItem(key: string): void {
  memory.delete(key);
  try { localStorage.removeItem(key); } catch { /* memory only */ }
}
