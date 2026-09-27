import { endpointForPrivateAccess, readPrivateAccessSettings } from "./privateAccess";

export const CLOUD_URL = "https://kinforge-genealogy-studio.marianneleong3.chatgpt.site";
export type CloudUser = { id: string; name: string; email: string; ownerDashboard?: boolean };
export type CloudLibrary = { id: string; name: string; role: "owner" | "editor" | "viewer"; revision: number; owner_email: string };
export class CloudError extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } }
export async function cloudRequest<T = any>(path: string, method = "GET", data?: unknown, raw = false): Promise<T> {
  const body = data === undefined ? undefined : raw ? String(data) : JSON.stringify(data);
  const privateAccess = readPrivateAccessSettings();
  let status: number, text: string;
  try {
    if (window.kinforgeNative?.cloudRequest) {
      const result = await window.kinforgeNative.cloudRequest({ path, method, body, privateAccess }); status = result.status; text = result.body;
    } else {
      const endpoint = endpointForPrivateAccess(path, privateAccess);
      const response = await fetch(endpoint, { method, body, credentials: endpoint.startsWith("/") ? "same-origin" : "include", cache: "no-store", redirect: "error", headers: { "Content-Type": raw ? "text/plain" : "application/json", "X-KinForge-Client": "1", "X-KinForge-Private-Access": privateAccess.mode }, signal: AbortSignal.timeout(45000) });
      status = response.status; text = await response.text();
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Private Access") || error.message.includes("relay"))) throw new CloudError(0, error.message, "PRIVATE_ACCESS");
    throw error;
  }
  if (status < 200 || status >= 300) {
    let message = "The cloud connection is unavailable. Your device changes are kept.";
    let code: string | undefined;
    try {
      const error = JSON.parse(text);
      if (typeof error.error === "string") message = error.error;
      if (typeof error.code === "string") code = error.code;
    } catch { /* Non-JSON gateway failures retain the recovery message. */ }
    throw new CloudError(status, message, code);
  }
  if (raw && method === "GET") return text as T;
  try { return JSON.parse(text) as T; } catch { throw new CloudError(503, "The cloud connection is unavailable. Please try again."); }
}
const memo = new Map<string, string>();
async function hash(value: string) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, "0")).join(""); }
export async function encodeCloudAssets<T>(libraryId: string, state: T): Promise<T> {
  async function walk(value: any): Promise<any> {
    if (typeof value === "string" && value.startsWith("data:") && value.length > 2048) {
      const id = await hash(value); const key = `${libraryId}:${id}`;
      if (memo.get(key) !== value) { await cloudRequest(`/api/libraries/${libraryId}/assets/${id}`, "PUT", value, true); memo.set(key, value); }
      return `kinforge-asset:${id}`;
    }
    if (Array.isArray(value)) { const result = []; for (const item of value) result.push(await walk(item)); return result; }
    if (value && typeof value === "object") { const result: Record<string, any> = {}; for (const [key, item] of Object.entries(value)) if (!["__proto__", "constructor", "prototype"].includes(key)) result[key] = await walk(item); return result; }
    return value;
  }
  return walk(state);
}
export async function decodeCloudAssets<T>(libraryId: string, state: T): Promise<T> {
  async function walk(value: any): Promise<any> {
    if (typeof value === "string" && /^kinforge-asset:[a-f0-9]{64}$/.test(value)) {
      const id = value.slice(15); const key = `${libraryId}:${id}`;
      if (!memo.has(key)) memo.set(key, await cloudRequest<string>(`/api/libraries/${libraryId}/assets/${id}`, "GET", undefined, true));
      return memo.get(key);
    }
    if (Array.isArray(value)) { const result = []; for (const item of value) result.push(await walk(item)); return result; }
    if (value && typeof value === "object") { const result: Record<string, any> = {}; for (const [key, item] of Object.entries(value)) if (!["__proto__", "constructor", "prototype"].includes(key)) result[key] = await walk(item); return result; }
    return value;
  }
  return walk(state);
}
export function clearAssetCache() { memo.clear(); }
