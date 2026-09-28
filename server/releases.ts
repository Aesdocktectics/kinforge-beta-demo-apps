import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { release } from "./releaseManifest";
import { PUBLIC_EXPORT_COPYRIGHT, PUBLIC_EXPORT_CREDIT, PUBLIC_EXPORT_PERMISSION } from "../src/exportAttribution";
import { publicSecurityHeaders, siteOrigin } from "./publicWebsite";

export type ReleaseEnv = { BUCKET: R2Bucket; RELEASE_UPLOAD_TOKEN?: string; RELEASE_UPLOAD_EXPIRES?: string };
const partSize = 8 * 1024 * 1024;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", ...publicSecurityHeaders } });
const keyFor = (hash: string) => `releases/${release.version}/${hash}`;
const equal = (a: string, b: string) => { let different = a.length ^ b.length; for (let i = 0; i < 64; i++) different |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return different === 0; };
async function releaseFiles(env: ReleaseEnv) {
  return Promise.all(release.files.map(async file => ({ ...file, available: !!await env.BUCKET.head(`${keyFor(file.sha256)}.verified`), url: `/api/releases/${release.version}/${file.id}` })));
}
async function releaseSummary(env: ReleaseEnv) {
  return {
    version: release.version,
    cadence: "monthly",
    cadenceDays: 30,
    policy: "KinForge checks monthly for published, verified updates. Critical fixes can be published sooner.",
    agent: {
      name: "Monthly Update Agent",
      purpose: "Checks published app installers, keeps a local feedback and bug queue, and prepares competitor SWOT review prompts so KinForge keeps improving without requiring Codex for routine updates.",
      safety: "The app downloads verified published packages; it updates the KinForge app, not the user's library data, and it does not silently rewrite its own executable."
    },
    notes: [
      "Bug fixes, security hardening, accessibility improvements and new relationship-mapping features arrive through versioned app updates.",
      "Use the in-app Update Agent to download the newest Apple Silicon, Intel or Windows package when it is available. The installer updates the app, not your library data."
    ],
    files: await releaseFiles(env)
  };
}
async function bytes(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("Request is too large.");
  const reader = request.body?.getReader(), chunks: Uint8Array[] = []; let size = 0;
  if (reader) for (;;) { const value = await reader.read(); if (value.done) break; size += value.value.length; if (size > limit) { await reader.cancel(); throw new Error("Request is too large."); } chunks.push(value.value); }
  const result = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; } return result;
}
async function hashBody(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader(), hash = sha256.create();
  for (;;) { const { value, done } = await reader.read(); if (done) break; hash.update(value); }
  return bytesToHex(hash.digest());
}
const escape = (text: string) => text.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export async function releaseRoutes(request: Request, env: ReleaseEnv): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname;
  if (path !== "/downloads" && path !== "/downloads/" && !path.startsWith("/api/releases/") && !path.startsWith("/api/release-upload/")) return null;
  try {
    if (path === "/downloads/") return new Response(null, { status: 308, headers: { Location: "/downloads" } });
    if (path === "/api/releases/latest" || path === "/api/releases/latest/") {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed." }, 405);
      return json(request.method === "HEAD" ? null : await releaseSummary(env));
    }
    if (path === "/downloads" || path === `/api/releases/${release.version}`) {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed." }, 405);
      const files = await releaseFiles(env);
      if (path !== "/downloads") return json({ version: release.version, files });
      const agreement = `${PUBLIC_EXPORT_COPYRIGHT} ${PUBLIC_EXPORT_CREDIT} ${PUBLIC_EXPORT_PERMISSION}`;
      const groups = ["Apple Silicon", "Intel", "Windows"].map(platform => `<section><h2>${platform}</h2><ul>${files.filter(file => file.platform === platform).map(file => `<li>${file.available ? `<form action="${file.url}" method="get"><label class="check"><input type="checkbox" required> I agree to the KinForge copyright, export and download terms.</label><button type="submit">${escape(file.format.toUpperCase())} download</button></form>` : `<span>${escape(file.format.toUpperCase())}: preparing download</span>`}<span>${(file.size / 1048576).toFixed(1)} MB</span><details><summary>SHA-256 checksum</summary><code>${file.sha256}</code></details></li>`).join("")}</ul></section>`).join("");
      const title = `Download KinForge ${release.version}`;
      const description = "Official KinForge Genealogy Studio downloads for Apple Silicon Mac, Intel Mac and Windows, with checksums and copyright terms.";
      const schema = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "KinForge Genealogy Studio", softwareVersion: release.version, operatingSystem: "macOS, Windows, Web", applicationCategory: "LifestyleApplication", url: `${siteOrigin}/website/app/`, downloadUrl: `${siteOrigin}/downloads`, publisher: { "@type": "Organization", name: "Dreams of Serene Landscapes" } };
      return new Response(request.method === "HEAD" ? null : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | KinForge</title><meta name="description" content="${escape(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="googlebot" content="index,follow"><link rel="canonical" href="${siteOrigin}/downloads"><meta property="og:site_name" content="KinForge Genealogy Studio"><meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${siteOrigin}/downloads"><meta name="twitter:card" content="summary"><link rel="icon" href="/website/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/website/styles.css"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/website/"><img src="/website/icon.svg" width="42" height="42" alt=""><span>KinForge<small>Genealogy Studio</small></span></a><nav class="desktop-nav" aria-label="Website"><a href="/website/">Overview</a><a href="/website/app/">Official app</a><a href="/website/features/">Use cases</a><a href="/website/tutorials/">Tutorials</a><a href="/downloads" aria-current="page">Download</a><a href="/website/beta/">Beta</a><a href="/website/support/">Support</a></nav><a class="button small" href="/">Open app</a></header><main id="main" class="wrap section prose"><p class="eyebrow">Official app download</p><h1>Download KinForge ${release.version}</h1><p class="lead">Choose the official KinForge Genealogy Studio package for your computer. Installing an update changes KinForge itself, not your library, trees, books, collections, media, or reports.</p><div class="actions left"><a class="button" href="/">Open the web app</a><a class="button secondary" href="/website/tutorials/">Tutorials</a></div><div class="notice"><strong>Required before download.</strong> ${escape(agreement)}</div><p>Product of Dreams of Serene Landscapes. Copyright 2026 Dreams of Serene Landscapes. All rights reserved.</p><p>The Monthly Update Agent checks for published app updates inside the app, downloads the correct Apple Silicon, Intel or Windows package, and keeps a feedback/SWOT queue for future app improvements.</p><p>Mac apps are locally signed, but are not Apple-notarized. Windows packages are not publisher-signed. Your operating system may require permission before opening them.</p><div class="download-grid">${groups}</div><p>Sign in with your KinForge account to access your cloud library. Google Drive and OneDrive connections require provider setup before they can be activated.</p></main><footer><div><a class="brand" href="/website/"><img src="/website/icon.svg" width="36" height="36" alt="">KinForge</a><p>Product of Dreams of Serene Landscapes</p><small>Copyright &copy; 2026 Dreams of Serene Landscapes.</small></div><nav aria-label="Footer"><a href="/website/app/">Official app</a><a href="/website/tutorials/">Tutorials</a><a href="/website/privacy-policy/">Privacy Policy</a><a href="/website/terms/">Terms</a><a href="/website/support/">Help &amp; support</a></nav></footer></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...publicSecurityHeaders } });
    }
    const download = path.match(/^\/api\/releases\/([^/]+)\/([^/]+)$/);
    if (download) {
      if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
      const file = release.files.find(file => file.id === download[2]);
      if (download[1] !== release.version || !file || !await env.BUCKET.head(`${keyFor(file.sha256)}.verified`)) return json({ error: "This installer is not published yet." }, 404);
      const key = keyFor(file.sha256), range = request.headers.get("Range");
      if (range && !/^bytes=\d+-\d*$/.test(range)) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
      let selected: { offset: number; length: number } | undefined;
      if (range) { const [start, end] = range.slice(6).split("-"); const offset = Number(start), last = end ? Math.min(Number(end), file.size - 1) : file.size - 1; if (!Number.isSafeInteger(offset) || offset >= file.size || last < offset) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } }); selected = { offset, length: last - offset + 1 }; }
      const object = request.method === "HEAD" ? await env.BUCKET.head(key) : await env.BUCKET.get(key, selected ? { range: selected } : {});
      if (!object || object.size !== file.size) return json({ error: "Installer temporarily unavailable." }, 503);
      const headers = new Headers({ "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${file.name}"`, "Content-Length": String(selected?.length ?? file.size), "Accept-Ranges": "bytes", "ETag": `"${file.sha256}"`, "X-Checksum-SHA256": file.sha256, "Cache-Control": "public, max-age=3600, immutable", ...publicSecurityHeaders });
      if (selected) headers.set("Content-Range", `bytes ${selected.offset}-${selected.offset + selected.length - 1}/${file.size}`);
      return new Response(request.method === "HEAD" ? null : (object as R2ObjectBody).body, { status: selected ? 206 : 200, headers });
    }
    const upload = path.match(/^\/api\/release-upload\/([^/]+)\/(start|complete|part\/\d+)$/);
    if (!upload) return json({ error: "Not found." }, 404);
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    if (!env.RELEASE_UPLOAD_TOKEN || !/^[a-f0-9]{64}$/.test(token) || !equal(token, env.RELEASE_UPLOAD_TOKEN) || !(Number(env.RELEASE_UPLOAD_EXPIRES) > Date.now())) return json({ error: "Release publisher authorization required." }, 403);
    if (request.headers.has("Origin") && request.headers.get("Origin") !== url.origin) return json({ error: "Origin rejected." }, 403);
    const file = release.files.find(file => file.id === upload[1]);
    if (!file) return json({ error: "Unknown installer." }, 404);
    if (request.method !== (upload[2].startsWith("part/") ? "PUT" : "POST")) return json({ error: "Method not allowed." }, 405);
    const key = keyFor(file.sha256), sessionKey = `${key}.upload`, verifiedKey = `${key}.verified`;
    if (upload[2] === "start") {
      if (await env.BUCKET.head(verifiedKey)) return json({ complete: true });
      const saved = await env.BUCKET.get(sessionKey);
      if (saved) { const session = await saved.json<{ uploadId: string }>(); return json({ uploadId: session.uploadId, partSize }); }
      const session = await env.BUCKET.createMultipartUpload(key, { httpMetadata: { contentType: "application/octet-stream" } });
      await env.BUCKET.put(sessionKey, JSON.stringify({ uploadId: session.uploadId }));
      return json({ uploadId: session.uploadId, partSize });
    }
    const session = await env.BUCKET.get(sessionKey);
    if (!session) return json({ error: "Start the upload first." }, 409);
    const { uploadId } = await session.json<{ uploadId: string }>();
    const multipart = env.BUCKET.resumeMultipartUpload(key, uploadId), partCount = Math.ceil(file.size / partSize);
    if (upload[2].startsWith("part/")) {
      const partNumber = Number(upload[2].slice(5));
      if (partNumber < 1 || partNumber > partCount) return json({ error: "Invalid part number." }, 400);
      const content = await bytes(request, partSize), expectedSize = partNumber === partCount ? file.size - (partCount - 1) * partSize : partSize;
      if (content.length !== expectedSize) return json({ error: "Incorrect part length." }, 400);
      return json(await multipart.uploadPart(partNumber, content));
    }
    const input = JSON.parse(new TextDecoder().decode(await bytes(request, 16384)));
    if (!Array.isArray(input.parts) || input.parts.length !== partCount || input.parts.some((part: R2UploadedPart, index: number) => part.partNumber !== index + 1 || typeof part.etag !== "string" || part.etag.length > 200)) return json({ error: "All ordered upload parts are required." }, 400);
    await multipart.complete(input.parts);
    await env.BUCKET.delete(sessionKey);
    const object = await env.BUCKET.get(key);
    if (!object || object.size !== file.size || await hashBody(object.body) !== file.sha256) { await env.BUCKET.delete(key); return json({ error: "Installer checksum failed. Start a fresh upload." }, 422); }
    await env.BUCKET.put(verifiedKey, file.sha256);
    return json({ complete: true, sha256: file.sha256 });
  } catch (error) {
    console.error("Release transfer failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Release transfer failed. Retry the current step." }, 503);
  }
}
