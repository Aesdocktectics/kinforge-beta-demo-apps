import type { PrivateAccessSettings } from "./privateAccess";

export const NATIVE_EXPORT_FOLDER = "KinForge Genealogy Studio";
export const NATIVE_STORAGE_CATEGORIES = ["Reports", "Backups", "Websites", "Exports", "Media", "GEDCOM", "Charts"] as const;
export type NativeStorageCategory = typeof NATIVE_STORAGE_CATEGORIES[number];

export type NativeStorageFolders = {
  appRoot: string;
  downloadsRoot: string;
  folders: Record<NativeStorageCategory, string>;
  appFolders: Record<string, string>;
};

export type NativeSaveResult = { ok: boolean; path: string; category: NativeStorageCategory };
export type NativeAppInfo = { version: string; platform: string; arch: string; platformLabel: string; monthlyUpdateCadenceDays: number };
export type NativeUpdateResult = { ok: boolean; path: string; sha256?: string };
export type NativeLocalUpdatePackage = {
  id: string;
  version: string;
  platform: string;
  format: string;
  name: string;
  size: number;
  sha256?: string;
  available: boolean;
  localPath: string;
  url: string;
};

type NativeBridge = {
  openDriveAuth?: (url: string) => Promise<void>;
  cloudRequest?: (request: { path: string; method: string; body?: string; privateAccess?: PrivateAccessSettings }) => Promise<{ status: number; body: string }>;
  getAppInfo?: () => Promise<NativeAppInfo>;
  listLocalUpdates?: () => Promise<NativeLocalUpdatePackage[]>;
  openLocalUpdate?: (filePath: string) => Promise<{ ok: boolean; path: string; error?: string }>;
  downloadUpdate?: (url: string) => Promise<NativeUpdateResult>;
  openUpdateDownloads?: () => Promise<{ ok: boolean; path: string; error?: string }>;
  getStorageFolders: () => Promise<NativeStorageFolders>;
  saveFile: (payload: { fileName: string; mimeType?: string; category: NativeStorageCategory; base64: string }) => Promise<NativeSaveResult>;
  showFolder: (target: NativeStorageCategory | "app" | "downloads") => Promise<{ ok: boolean; path: string; error?: string }>;
};

declare global {
  interface Window {
    kinforgeNative?: NativeBridge;
  }
}

export function sanitizeNativeFileName(fileName: string) {
  const leaf = String(fileName || "").replace(/\\/g, "/").split("/").filter(Boolean).pop() || "KinForge-export";
  let safe = leaf.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "-").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  if (!safe || safe === "." || safe === "..") safe = "KinForge-export";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(safe)) safe = `KinForge-${safe}`;
  if (safe.length <= 140) return safe;
  const dot = safe.lastIndexOf(".");
  if (dot > 0 && safe.length - dot < 14) return `${safe.slice(0, Math.max(1, 140 - (safe.length - dot)))}${safe.slice(dot)}`;
  return safe.slice(0, 140);
}

export function categoryForFileName(fileName: string): NativeStorageCategory {
  const safe = sanitizeNativeFileName(fileName).toLowerCase();
  if (safe.includes("report") || safe.endsWith(".pdf") || safe.endsWith(".rtf")) return "Reports";
  if (safe.includes("backup") || safe.endsWith(".json")) return "Backups";
  if (safe.endsWith(".ged") || safe.endsWith(".gedcom")) return "GEDCOM";
  if (safe.includes("family-site") || safe.includes("website") || safe.endsWith(".html") || safe.endsWith(".htm")) return "Websites";
  if (/\.(png|jpe?g|webp|gif|tiff?|heic|avif)$/i.test(safe)) return "Media";
  if (safe.includes("chart")) return "Charts";
  return "Exports";
}

export function hasNativeStorage() {
  return typeof window !== "undefined" && !!window.kinforgeNative;
}

export async function getNativeStorageFolders() {
  return hasNativeStorage() ? window.kinforgeNative!.getStorageFolders() : null;
}

export async function openNativeFolder(target: NativeStorageCategory | "app" | "downloads") {
  return hasNativeStorage() ? window.kinforgeNative!.showFolder(target) : null;
}

async function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(new Error("The export could not be prepared for local storage."));
    reader.readAsDataURL(blob);
  });
}

export async function saveBlobToNative(fileName: string, blob: Blob, category = categoryForFileName(fileName), mimeType = blob.type) {
  if (!hasNativeStorage()) return null;
  return window.kinforgeNative!.saveFile({
    fileName: sanitizeNativeFileName(fileName),
    mimeType: mimeType || "application/octet-stream",
    category,
    base64: await blobToBase64(blob)
  });
}
