import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { createDomainFixture } from "./helpers/domain-fixture.mjs";
let mf, db, owner, other, viewer, fixture, delivered;
async function call(path, method = "GET", data, cookie = "", extras = {}) {
  const response = await mf.dispatchFetch(`http://localhost${path}`, { method, headers: { "X-KinForge-Client": "1", "Content-Type": "application/json", cookie, ...extras }, ...(data === undefined ? {} : { body: typeof data === "string" ? data : JSON.stringify(data) }) });
  const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, cookie: response.headers.get("set-cookie")?.split(";")[0], headers: response.headers };
}
async function account(email) {
  const result = await call("/api/auth/register", "POST", { email, name: email.split("@")[0], password: "Test-library-password-42", privacyAccepted: true, termsAccepted: true });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const libraries = await call("/api/libraries", "GET", undefined, result.cookie);
  return { ...result, library: libraries.body.libraries[0].id };
}
before(async () => {
  fixture = await createDomainFixture();
  delivered = [];
  const outboundService = async request => {
    const url = new URL(request.url);
    assert.equal(url.hostname, "mail.test");
    delivered.push(await request.json());
    return new Response("ok", { status: 200 });
  };
  mf = new Miniflare({ modules: true, scriptPath: "dist/server/index.js", compatibilityDate: "2024-11-01", d1Databases: ["DB"], r2Buckets: ["BUCKET"], outboundService, bindings: { EMAIL_CODE_ENDPOINT: "https://mail.test/send", EMAIL_CODE_TOKEN: "mail-test-token", EMAIL_CODE_FROM: "KinForge <test@kinforge.local>", NEWSLETTER_EMAIL_ENDPOINT: "https://mail.test/newsletter", NEWSLETTER_EMAIL_TOKEN: "newsletter-test-token", KINFORGE_OWNER_EMAILS: "owner@example.test" } }); db = await mf.getD1Database("DB");
  for (const name of (await readdir("drizzle")).filter(n => n.endsWith(".sql")).sort()) for (const sql of (await readFile(`drizzle/${name}`, "utf8")).split("--> statement-breakpoint").filter(s => s.trim())) await db.prepare(sql.trim()).run();
  owner = await account("owner@example.test"); other = await account("other@example.test"); viewer = await account("viewer@example.test");
});
after(async () => { await mf?.dispose(); });
const lastCode = () => delivered.at(-1).text.match(/\b(\d{6})\b/)?.[1];
function lastSecretLink() {
  const link = delivered.at(-1).link || delivered.at(-1).text.match(/https:\/\/\S+/)?.[0];
  const url = new URL(link);
  const params = new URLSearchParams(url.hash.slice(url.hash.indexOf("?") + 1));
  return { email: params.get("email"), code: params.get("code") };
}
test("sessions use protected cookies and password hashes; anonymous reads fail", async () => {
  assert.match(owner.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  const row = await db.prepare("SELECT password FROM accounts WHERE email=?").bind("owner@example.test").first();
  assert.match(row.password, /^scrypt-v1:/); assert.ok(!row.password.includes("Test-library"));
  assert.equal((await call("/api/auth/login", "POST", { email: "owner@example.test", password: "wrong-password" })).status, 401);
  assert.equal((await call("/api/libraries")).status, 401);
  assert.equal((await call(`/api/libraries/${owner.library}`)).status, 401);
});
test("beta interest is account protected and records interest without payment data", async () => {
  assert.equal((await call("/api/beta/interest")).status, 401);
  const saved = await call("/api/beta/interest", "POST", { plan: "beta", interval: "year", discountCode: "WRITER10", consent: true }, owner.cookie);
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  assert.deepEqual(saved.body.interest, { plan: "beta", interval: "month", discountCode: null });
  const listed = await call("/api/beta/interest", "GET", undefined, owner.cookie);
  assert.equal(listed.body.interest.discount_code, null);
  assert.equal((await call("/api/beta/interest", "POST", { plan: "beta", interval: "month", consent: false }, owner.cookie)).status, 400);
  assert.equal((await call("/api/beta/interest", "DELETE", undefined, owner.cookie)).status, 200);
  assert.equal((await call("/api/beta/interest", "GET", undefined, owner.cookie)).body.interest, null);
});
test("public quote requests are saved for owner support without exposing payment setup", async () => {
  const request = await call("/api/stripe/quote-request", "POST", {
    type: "Business quote request",
    name: "Quote Customer",
    email: "quote@example.test",
    subject: "Need seats for a writing group",
    plan: "Business Plus",
    interval: "annual",
    discountCode: "AUTHOR10",
    suggestedCost: "SGD 80 per year",
    proof: "Writing group with five seats",
    message: "Please send a quote for five seats.",
    permissionToReply: true
  });
  assert.equal(request.status, 202, JSON.stringify(request.body));
  assert.equal(request.body.message, "Your request was saved for KinForge Support.");
  const support = await call("/api/owner/support", "GET", undefined, owner.cookie);
  assert.equal(support.status, 200, JSON.stringify(support.body));
  const ticket = support.body.tickets.find(item => item.email === "quote@example.test");
  assert.ok(ticket, "quote request should appear in owner support tickets");
  assert.equal(ticket.deliveryStatus, "stored-for-owner-dashboard");
  assert.match(ticket.message, /Business Plus/);
});
test("owner can see accounts and release newsletters to subscribers", async () => {
  const signup = await call("/api/beta/interest", "POST", { consent: true }, other.cookie);
  assert.equal(signup.status, 201, JSON.stringify(signup.body));
  const denied = await call("/api/owner/access", "GET", undefined, other.cookie);
  assert.equal(denied.status, 403);
  const access = await call("/api/owner/access", "GET", undefined, owner.cookie);
  assert.equal(access.status, 200, JSON.stringify(access.body));
  assert.ok(access.body.accounts.some(account => account.email === "owner@example.test"));
  assert.ok(access.body.signups.some(account => account.email === "other@example.test"));
  assert.ok(access.body.subscribers.some(account => account.email === "other@example.test"));
  delivered.length = 0;
  const release = await call("/api/owner/newsletters", "POST", { title: "Owner update", subject: "KinForge owner newsletter", summary: "Short update", content: "Release notes and download links.", attachments: [{ name: "notes.txt", mime: "text/plain", dataUrl: "data:text/plain;base64,bm90ZXM=" }] }, owner.cookie);
  assert.equal(release.status, 201, JSON.stringify(release.body));
  assert.equal(release.body.deliveryStatus, "sent");
  assert.equal(release.body.attachmentCount, 1);
  assert.ok(release.body.recipientCount >= 2);
  assert.equal(delivered.at(-1).source, "kinforge-owner-newsletter");
  assert.equal(delivered.at(-1).subject, "KinForge owner newsletter");
  const newsletters = await call("/api/owner/newsletters", "GET", undefined, owner.cookie);
  assert.equal(newsletters.status, 200, JSON.stringify(newsletters.body));
  assert.ok(newsletters.body.releases.some(item => item.title === "Owner update" && item.deliveryStatus === "sent"));
});
test("whole library including reports, collections, subcollections and books survives another session", async () => {
  fixture.books.push({ id: "book_extra", title: "Archive", description: "A second book" });
  fixture.collections.push({ id: "sub", bookId: fixture.books[0].id, parentId: fixture.collections[0].id, name: "Nested collection" });
  fixture.reportDrafts.push({ id: "draft", treeId: fixture.trees[0].id, title: "Person report", type: "Person Report", body: "Biography and facts", updatedAt: new Date().toISOString() });
  const saved = await call(`/api/libraries/${owner.library}`, "PUT", { revision: 0, state: fixture }, owner.cookie); assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const login = await call("/api/auth/login", "POST", { email: "OWNER@example.test", password: "Test-library-password-42" }); assert.equal(login.status, 200);
  const loaded = await call(`/api/libraries/${owner.library}`, "GET", undefined, login.cookie); assert.deepEqual(loaded.body.state, fixture); assert.equal(loaded.body.revision, 1);
});
test("each account has a separate library and cannot guess another library ID", async () => {
  assert.notEqual(owner.library, other.library);
  assert.equal((await call(`/api/libraries/${owner.library}`, "GET", undefined, other.cookie)).status, 404);
  assert.equal((await call(`/api/libraries/${owner.library}`, "PUT", { revision: 1, state: fixture }, other.cookie)).status, 404);
  const loaded = await call(`/api/libraries/${other.library}`, "GET", undefined, other.cookie); assert.equal(loaded.body.state, null);
});
test("concurrent writes accept exactly one version and reject stale overwrites", async () => {
  const versions = await Promise.all([call(`/api/libraries/${owner.library}`, "PUT", { revision: 1, state: { ...fixture, labels: ["first"] } }, owner.cookie), call(`/api/libraries/${owner.library}`, "PUT", { revision: 1, state: { ...fixture, labels: ["second"] } }, owner.cookie)]);
  assert.deepEqual(versions.map(r => r.status).sort(), [200, 409]);
  assert.equal((await call(`/api/libraries/${owner.library}?since=2`, "GET", undefined, owner.cookie)).body.unchanged, true);
});
test("attachments are checksum-verified and require library membership", async () => {
  const data = `data:text/plain;base64,${Buffer.from("Private portrait and record payload").toString("base64")}`;
  const hash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data))).toString("hex");
  assert.equal((await call(`/api/libraries/${owner.library}/assets/${hash}`, "PUT", data, owner.cookie)).status, 200);
  assert.equal((await call(`/api/libraries/${owner.library}/assets/${hash}`, "GET", undefined, owner.cookie)).body, data);
  assert.equal((await call(`/api/libraries/${owner.library}/assets/${hash}`, "GET", undefined, other.cookie)).status, 404);
  assert.equal((await call(`/api/libraries/${owner.library}/assets/${hash}`, "PUT", data + "changed", owner.cookie)).status, 400);
});
test("invitation sharing enforces viewer/editor roles, single use and revocation", async () => {
  const invitation = await call(`/api/libraries/${owner.library}/sharing`, "POST", { role: "viewer" }, owner.cookie); assert.equal(invitation.status, 200);
  assert.equal((await call("/api/invitations/accept", "POST", { code: invitation.body.code }, viewer.cookie)).status, 200);
  assert.equal((await call("/api/invitations/accept", "POST", { code: invitation.body.code }, other.cookie)).status, 404);
  assert.equal((await call(`/api/libraries/${owner.library}`, "GET", undefined, viewer.cookie)).status, 200);
  assert.equal((await call(`/api/libraries/${owner.library}`, "PUT", { revision: 2, state: fixture }, viewer.cookie)).status, 403);
  assert.equal((await call(`/api/libraries/${owner.library}/sharing`, "POST", { role: "editor" }, viewer.cookie)).status, 403);
  const edit = await call(`/api/libraries/${owner.library}/sharing`, "POST", { role: "editor" }, owner.cookie);
  assert.equal((await call("/api/invitations/accept", "POST", { code: edit.body.code }, other.cookie)).status, 200);
  const visible = await call(`/api/libraries/${owner.library}`, "GET", undefined, other.cookie);
  visible.body.state.books[0].description = "Shared editor update";
  assert.equal((await call(`/api/libraries/${owner.library}`, "PUT", { revision: visible.body.revision, state: visible.body.state }, other.cookie)).status, 200);
  const retained = await call(`/api/libraries/${owner.library}`, "GET", undefined, owner.cookie);
  assert.equal(retained.body.state.books[0].description, "Shared editor update");
  assert.deepEqual(retained.body.state.people.map(person => person.government), fixture.people.map(person => person.government));
  assert.equal((await call(`/api/libraries/${owner.library}/members/${other.body.user.id}`, "DELETE", undefined, owner.cookie)).status, 200);
  assert.equal((await call(`/api/libraries/${owner.library}`, "GET", undefined, other.cookie)).status, 404);
});
test("forged cross-origin writes and malformed snapshots are rejected", async () => {
  assert.equal((await call(`/api/libraries/${owner.library}`, "PUT", { revision: 3, state: fixture }, owner.cookie, { origin: "https://attacker.test" })).status, 403);
  assert.equal((await call(`/api/libraries/${owner.library}`, "PUT", { revision: 3, state: {} }, owner.cookie)).status, 400);
});
test("password recovery requires the private code, rotates it and revokes old sessions", async () => {
  const payload = { email: "viewer@example.test", password: "New-password-for-viewer-42", recoveryCode: "wrong" };
  assert.equal((await call("/api/auth/recover", "POST", payload)).status, 400);
  payload.recoveryCode = viewer.body.recoveryCode;
  const recovered = await call("/api/auth/recover", "POST", payload); assert.equal(recovered.status, 200);
  assert.notEqual(recovered.body.recoveryCode, payload.recoveryCode);
  assert.equal((await call("/api/auth/me", "GET", undefined, viewer.cookie)).status, 401);
  assert.equal((await call("/api/auth/recover", "POST", payload)).status, 400);
  assert.equal((await call("/api/auth/me", "GET", undefined, recovered.cookie)).status, 200);
  await call("/api/auth/logout", "POST", {}, recovered.cookie);
  assert.equal((await call("/api/auth/me", "GET", undefined, recovered.cookie)).status, 401);
});
test("email login codes, reset codes and secret links are short-lived one-time recovery options", async () => {
  const codeUser = await account("codes@example.test");
  delivered.length = 0;
  const loginCode = await call("/api/auth/code/request", "POST", { email: "codes@example.test", purpose: "login" });
  assert.equal(loginCode.status, 200, JSON.stringify(loginCode.body));
  assert.equal(delivered.at(-1).delivery, "code");
  const code = lastCode();
  assert.match(code, /^\d{6}$/);
  const codeLogin = await call("/api/auth/code/confirm", "POST", { email: "codes@example.test", purpose: "login", code });
  assert.equal(codeLogin.status, 200, JSON.stringify(codeLogin.body));
  assert.equal((await call("/api/auth/code/confirm", "POST", { email: "codes@example.test", purpose: "login", code })).status, 400);

  const secretLink = await call("/api/auth/code/request", "POST", { email: "codes@example.test", purpose: "login", delivery: "link" });
  assert.equal(secretLink.status, 200, JSON.stringify(secretLink.body));
  assert.equal(delivered.at(-1).delivery, "link");
  const linked = lastSecretLink();
  assert.equal(linked.email, "codes@example.test");
  const linkLogin = await call("/api/auth/code/confirm", "POST", { email: linked.email, purpose: "login", code: linked.code });
  assert.equal(linkLogin.status, 200, JSON.stringify(linkLogin.body));
  assert.equal((await call("/api/auth/code/confirm", "POST", { email: linked.email, purpose: "login", code: linked.code })).status, 400);

  delivered.length = 0;
  const resetCode = await call("/api/auth/code/request", "POST", { email: "codes@example.test", purpose: "reset" });
  assert.equal(resetCode.status, 200, JSON.stringify(resetCode.body));
  const reset = await call("/api/auth/code/confirm", "POST", { email: "codes@example.test", purpose: "reset", code: lastCode(), password: "Codes-reset-password-42" });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.notEqual(reset.body.recoveryCode, codeUser.body.recoveryCode);
  assert.equal((await call("/api/auth/me", "GET", undefined, codeUser.cookie)).status, 401);
  assert.equal((await call("/api/auth/login", "POST", { email: "codes@example.test", password: "Test-library-password-42" })).status, 401);
  assert.equal((await call("/api/auth/login", "POST", { email: "codes@example.test", password: "Codes-reset-password-42" })).status, 200);
});
