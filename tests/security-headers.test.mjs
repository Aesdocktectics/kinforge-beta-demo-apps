import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredHeaders = [
  "Strict-Transport-Security",
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Permissions-Policy"
];

test("public website and app APIs keep hardened security headers", async () => {
  const [publicWebsite, worker, releases] = await Promise.all([
    readFile(new URL("../server/publicWebsite.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/worker.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/releases.ts", import.meta.url), "utf8")
  ]);

  for (const header of requiredHeaders) {
    assert.match(publicWebsite, new RegExp(`["']${header}["']`), `${header} missing from public website headers`);
  }

  assert.match(worker, /securityHeaders/, "API worker should share the hardened security header set");
  assert.match(releases, /publicSecurityHeaders/, "Release and download routes should reuse the public hardened header set");
  assert.doesNotMatch(publicWebsite, /frame-ancestors 'self'/, "Public marketing pages should not be frameable");
});
