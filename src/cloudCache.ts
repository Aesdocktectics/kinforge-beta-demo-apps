import type { AppState } from "./domain";
import { cleanupLibraryPreviews, writeLibraryPreview } from "./cloudPreview";
export type CachedLibrary = { base: AppState | null; draft: AppState; revision: number; dirty: boolean; updatedAt?: number };
let database: Promise<IDBDatabase> | undefined;
function open() {
  return database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("kinforge-cloud-cache-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("libraries");
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function readCache(userId: string, libraryId: string): Promise<CachedLibrary | undefined> {
  const db = await open(); return new Promise((resolve, reject) => { const request = db.transaction("libraries").objectStore("libraries").get(`${userId}:${libraryId}`); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
export async function writeCache(userId: string, libraryId: string, value: CachedLibrary) {
  const db = await open(); return new Promise<void>((resolve, reject) => { const transaction = db.transaction("libraries", "readwrite"); transaction.objectStore("libraries").put({ ...value, updatedAt: Date.now() }, `${userId}:${libraryId}`); transaction.oncomplete = () => { writeLibraryPreview(userId, libraryId, value.draft); resolve(); }; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
}
export async function cleanupCloudCache(activeUserId = "", activeLibraryId = "", maxAgeMs = 14 * 86400000) {
  const cutoff = Date.now() - maxAgeMs;
  cleanupLibraryPreviews(maxAgeMs, activeUserId, activeLibraryId);
  try {
    if ("caches" in globalThis) {
      const names = await caches.keys();
      await Promise.all(names.filter(name => /kinforge/i.test(name)).map(name => caches.delete(name)));
    }
  } catch { /* Browser cache cleanup should never block opening a library. */ }
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("libraries", "readwrite");
      const store = transaction.objectStore("libraries");
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const [userId, libraryId] = String(cursor.key).split(":");
        const value = cursor.value as CachedLibrary;
        const isActive = userId === activeUserId && libraryId === activeLibraryId;
        const isOldCleanCache = !value.dirty && Number(value.updatedAt || 0) > 0 && Number(value.updatedAt || 0) < cutoff;
        if (!isActive && isOldCleanCache) void cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch { /* IndexedDB may be unavailable; sync still works from the server. */ }
}
