import type { AppState } from "./domain";
const prefix = "kinforge-library-preview-v1:";
const key = (userId: string, libraryId: string) => `${prefix}${encodeURIComponent(userId)}:${encodeURIComponent(libraryId)}`;
const maximumBytes = 512 * 1024;

// Read-only startup acceleration, never a sync base or a replacement for the durable draft.
export function readLibraryPreview(userId: string, libraryId: string): AppState | undefined {
  try {
    const text = localStorage.getItem(key(userId, libraryId));
    if (!text || text.length > maximumBytes) return;
    const value = JSON.parse(text);
    if (value.userId !== userId || value.libraryId !== libraryId || !Array.isArray(value.state?.people) || !Array.isArray(value.state?.trees)) return;
    return value.state;
  } catch { return; }
}
export function writeLibraryPreview(userId: string, libraryId: string, state: AppState) {
  try {
    // Attachment bytes are loaded from the full draft; keep genealogy and report text intact.
    const text = JSON.stringify({ userId, libraryId, updatedAt: Date.now(), state }, (_name, value) => typeof value === "string" && value.startsWith("data:") ? "" : value);
    if (text.length <= maximumBytes) localStorage.setItem(key(userId, libraryId), text);
    else localStorage.removeItem(key(userId, libraryId));
  } catch { /* The full IndexedDB draft is authoritative when preview storage is unavailable. */ }
}
export function cleanupLibraryPreviews(maxAgeMs = 14 * 86400000, activeUserId = "", activeLibraryId = "") {
  try {
    const cutoff = Date.now() - maxAgeMs;
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const storageKey = localStorage.key(index);
      if (!storageKey?.startsWith(prefix)) continue;
      const text = localStorage.getItem(storageKey);
      if (!text || text.length > maximumBytes) { localStorage.removeItem(storageKey); continue; }
      let value: { userId?: string; libraryId?: string; updatedAt?: number };
      try { value = JSON.parse(text); } catch { localStorage.removeItem(storageKey); continue; }
      if (value.userId === activeUserId && value.libraryId === activeLibraryId) continue;
      if (!value.updatedAt || value.updatedAt < cutoff) localStorage.removeItem(storageKey);
    }
  } catch { /* Preview cleanup is best effort only. */ }
}
