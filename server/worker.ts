import { scryptAsync } from "@noble/hashes/scrypt";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { LibraryPrivacyError, libraryAssetHashes, mergeSharedLibraryWrite, sanitizeLibraryVisibility, sharedLibraryView, type LibraryDocument } from "./libraryPrivacy";
import { driveOAuth, driveRoutes, syncLibraryDrives } from "./driveSync";
import { DriveError, type DriveEnv } from "./driveProviders";
import { releaseRoutes, type ReleaseEnv } from "./releases";
import { publicWebsiteRoutes } from "./publicWebsite";

type Env = DriveEnv & ReleaseEnv & {
  ASSETS: Fetcher;
  EMAIL_CODE_ENDPOINT?: string; EMAIL_CODE_TOKEN?: string; EMAIL_CODE_FROM?: string;
  SERENE_RELAY_SUPPORT_ENDPOINT?: string; SERENE_RELAY_SUPPORT_TOKEN?: string; SERENE_RELAY_SUPPORT_TO?: string; SERENE_RELAY_SUPPORT_FROM?: string;
  KINFORGE_OWNER_EMAILS?: string; KINFORGE_ADMIN_EMAILS?: string; OWNER_EMAILS?: string; STRIPE_WEBHOOK_SECRET?: string;
};
type Account = { id: string; email: string; name: string; password: string; recovery_hash: string };
type Library = { id: string; owner_id: string; name: string; revision: number; object_key: string | null; updated_at: number; role: string };
type AuthCodePurpose = "reset" | "login";
const cookieName = "kinforge_session";
const day = 86400000;
const json = (value: unknown, status = 200, headers: HeadersInit = {}) => Response.json(value, {
  status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ...headers }
});
class Problem extends Error { constructor(public status: number, message: string) { super(message); } }
const secret = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async (value: string) => bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
function equal(a: string, b: string) { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }
async function passwordHash(password: string, salt = secret()) {
  const hash = await scryptAsync(password, salt, { N: 32768, r: 8, p: 3, dkLen: 32, maxmem: 48 * 1024 * 1024 });
  return `scrypt-v1:${salt}:${bytesToHex(hash)}`;
}
async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split(":");
  return parts.length === 3 && parts[0] === "scrypt-v1" && equal(await passwordHash(password, parts[1]), encoded);
}
function validPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 12 || value.length > 256) throw new Problem(400, "Use a password between 12 and 256 characters.");
  return value;
}
function emailAddress(value: unknown): string {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Problem(400, "Enter a valid email address.");
  return email;
}
async function readText(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new Problem(413, "This file is too large to sync.");
  if (!request.body) return "";
  const reader = request.body.getReader(); const decoder = new TextDecoder(); let size = 0; let text = "";
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new Problem(413, "This file is too large to sync."); } text += decoder.decode(value, { stream: true }); }
  return text + decoder.decode();
}
async function body(request: Request, limit = 16384): Promise<Record<string, any>> {
  try { const data = JSON.parse(await readText(request, limit)); if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(); return data; }
  catch (error) { if (error instanceof Problem) throw error; throw new Problem(400, "The request could not be read."); }
}
async function rateLimit(env: Env, request: Request, name: string, limit: number, windowMs: number, account = "") {
  const now = Date.now(); const address = request.headers.get("CF-Connecting-IP") || "local";
  for (const scope of [address, ...(account ? [account] : [])]) {
    const key = await digest(`${name}:${scope}:${Math.floor(now / windowMs)}`);
    const row = await env.DB.prepare("INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").bind(key, now + windowMs).first<{ count: number }>();
    if ((row?.count || 0) > limit) throw new Problem(429, "Too many attempts. Please try again later.");
  }
}
function cookie(token: string, request: Request, age = 30 * 86400) {
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
async function sessionToken(env: Env, userId: string) {
  const token = secret();
  await env.DB.prepare("INSERT INTO sessions (hash,user_id,expires_at) VALUES (?,?,?)").bind(await digest(token), userId, Date.now() + 30 * day).run();
  return token;
}
function ownerEmails(env: Env) {
  return String(env.KINFORGE_OWNER_EMAILS || env.KINFORGE_ADMIN_EMAILS || env.OWNER_EMAILS || "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
}
function isOwnerAccount(env: Env, user: Account) {
  const owners = ownerEmails(env);
  return owners.length > 0 && owners.includes(user.email.toLowerCase());
}
const publicAccount = (user: Account, env: Env) => ({ id: user.id, email: user.email, name: user.name, ownerDashboard: isOwnerAccount(env, user) });
function authCodePurpose(value: unknown): AuthCodePurpose {
  if (value === "reset" || value === "login") return value;
  throw new Problem(400, "Choose password reset or email-code login.");
}
function shortCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, byte => String(byte % 10)).join("");
}
function authLink(request: Request, email: string, code: string) {
  const url = new URL(request.url);
  return `${url.origin}/#/email-login?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
}
async function deliverAuthCode(env: Env, request: Request, email: string, purpose: AuthCodePurpose, code: string, delivery: "code" | "link" = "code") {
  if (!env.EMAIL_CODE_ENDPOINT || !env.EMAIL_CODE_TOKEN) return false;
  const link = delivery === "link" && purpose === "login" ? authLink(request, email, code) : "";
  const subject = purpose === "reset" ? "Your KinForge password reset code" : delivery === "link" ? "Your KinForge secret login link" : "Your KinForge login code";
  const text = link
    ? `Open this KinForge secret login link to sign in: ${link}\n\nIt expires in 15 minutes and works once. If you did not request this, ignore this email.`
    : `Your KinForge ${purpose === "reset" ? "password reset" : "login"} code is ${code}. It expires in 15 minutes. If you did not request this, ignore this email.`;
  try {
    const response = await fetch(env.EMAIL_CODE_ENDPOINT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.EMAIL_CODE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: email, from: env.EMAIL_CODE_FROM || "KinForge <no-reply@kinforge.local>", subject, text, purpose, delivery, link })
    });
    return response.ok;
  } catch {
    return false;
  }
}
async function deliverSupportRequest(env: Env, ticket: Record<string, any>) {
  if (!env.SERENE_RELAY_SUPPORT_ENDPOINT || !env.SERENE_RELAY_SUPPORT_TOKEN) return false;
  const subject = `[KinForge Support] ${String(ticket.subject || ticket.type || "Support request").slice(0, 140)}`;
  const text = [
    `Type: ${ticket.type || "Support request"}`,
    `From: ${ticket.name || "Not provided"} <${ticket.email || "not provided"}>`,
    `Permission to reply: ${ticket.permissionToReply ? "yes" : "no"}`,
    `Device/app: ${ticket.device || "Not provided"}`,
    `Tree: ${ticket.treeTitle || "Not provided"}`,
    ticket.proof ? `Permission proof: ${ticket.proof}` : "",
    "",
    "Message:",
    String(ticket.message || ""),
    "",
    ticket.diagnostics ? `Diagnostics:\n${ticket.diagnostics}` : "Diagnostics: not included"
  ].join("\n");
  try {
    const response = await fetch(env.SERENE_RELAY_SUPPORT_ENDPOINT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.SERENE_RELAY_SUPPORT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: env.SERENE_RELAY_SUPPORT_TO || "Serene Relay Support",
        from: env.SERENE_RELAY_SUPPORT_FROM || "KinForge Support <support@kinforge.local>",
        replyTo: ticket.permissionToReply ? ticket.email : "",
        subject,
        text,
        source: "kinforge-support-form",
        ticket
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}
function money(value: unknown) {
  const text = String(value ?? "0").replace(/[^0-9.-]/g, "");
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999999) throw new Problem(400, "Enter a valid payment amount.");
  return Math.round(amount * 100);
}
function currency(value: unknown) {
  const next = String(value || "SGD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(next)) throw new Problem(400, "Use a three-letter currency code.");
  return next;
}
function ownerOnly(env: Env, user: Account) {
  if (!isOwnerAccount(env, user)) throw new Problem(403, "This owner revenue area is private.");
}
function tableMissing(error: unknown) {
  return error instanceof Error && /no such table|payment_events|special_access_codes/i.test(error.message);
}
async function ownerRevenue(env: Env) {
  try {
    const [totals, recent, beta, accounts] = await Promise.all([
      env.DB.prepare("SELECT currency,SUM(amount) AS gross,SUM(fee) AS fees,SUM(net) AS net,COUNT(*) AS payments FROM payment_events WHERE status IN ('paid','succeeded') GROUP BY currency ORDER BY currency").all(),
      env.DB.prepare("SELECT id,provider,source,status,product,tier,customer_email AS customerEmail,customer_name AS customerName,currency,amount,fee,net,paid_at AS paidAt,created_at AS createdAt FROM payment_events ORDER BY paid_at DESC,created_at DESC LIMIT 50").all(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM beta_interests").first<{ count: number }>().catch(() => ({ count: 0 })),
      env.DB.prepare("SELECT COUNT(*) AS count FROM accounts").first<{ count: number }>().catch(() => ({ count: 0 }))
    ]);
    return json({ setupRequired: false, totals: totals.results, recent: recent.results, betaInterestCount: beta?.count || 0, accountCount: accounts?.count || 0 });
  } catch (error) {
    if (tableMissing(error)) return json({ setupRequired: true, totals: [], recent: [], betaInterestCount: 0, accountCount: 0 });
    throw error;
  }
}
async function ownerAccessSummary(env: Env) {
  try {
    const [signups, codes] = await Promise.all([
      env.DB.prepare("SELECT a.id AS accountId,a.email,a.name,a.created_at AS accountCreatedAt,b.plan,b.interval,b.discount_code AS discountCode,b.created_at AS createdAt,b.updated_at AS updatedAt FROM beta_interests b JOIN accounts a ON a.id=b.account_id ORDER BY b.updated_at DESC LIMIT 250").all(),
      env.DB.prepare("SELECT hash,label,recipient_email AS recipientEmail,note,created_at AS createdAt,expires_at AS expiresAt,max_uses AS maxUses,use_count AS useCount,revoked_at AS revokedAt,last_redeemed_at AS lastRedeemedAt,a.email AS lastRedeemedByEmail FROM special_access_codes c LEFT JOIN accounts a ON a.id=c.last_redeemed_by ORDER BY c.created_at DESC LIMIT 250").all()
    ]);
    return json({ setupRequired: false, signups: signups.results, codes: codes.results });
  } catch (error) {
    if (tableMissing(error)) return json({ setupRequired: true, signups: [], codes: [] });
    throw error;
  }
}
async function createSpecialAccessCode(env: Env, request: Request, user: Account) {
  const data = await body(request, 32768);
  const code = String(data.code || secret().slice(0, 16)).trim().replace(/\s+/g, "-");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) throw new Problem(400, "Use 8 to 64 letters, numbers, hyphens, or underscores for the code.");
  const recipient = data.recipientEmail ? emailAddress(data.recipientEmail) : null;
  const maxUses = Math.max(1, Math.min(100, Number(data.maxUses || 1) || 1));
  const expiresAt = data.expiresAt && Number.isFinite(Date.parse(String(data.expiresAt))) ? Date.parse(String(data.expiresAt)) : null;
  await env.DB.prepare("INSERT INTO special_access_codes (hash,label,recipient_email,note,created_by,created_at,expires_at,max_uses,use_count) VALUES (?,?,?,?,?,?,?,?,0)")
    .bind(await digest(`special-access:${code}`), String(data.label || "Special access").trim().slice(0, 120), recipient, String(data.note || "").trim().slice(0, 1000) || null, user.id, Date.now(), expiresAt, maxUses).run();
  return json({ ok: true, code, label: String(data.label || "Special access").trim().slice(0, 120), recipientEmail: recipient, expiresAt, maxUses }, 201);
}
async function revokeSpecialAccessCode(env: Env, hash: string) {
  await env.DB.prepare("UPDATE special_access_codes SET revoked_at=? WHERE hash=?").bind(Date.now(), hash).run();
  return json({ ok: true });
}
async function redeemSpecialAccessCode(env: Env, data: Record<string, any>, user: Account) {
  const code = String(data.code || "").trim();
  const hash = await digest(`special-access:${code}`);
  const record = await env.DB.prepare("SELECT * FROM special_access_codes WHERE hash=?").bind(hash).first<{ recipient_email: string | null; expires_at: number | null; max_uses: number; use_count: number; revoked_at: number | null }>();
  if (!record || record.revoked_at || record.use_count >= record.max_uses || record.expires_at && record.expires_at < Date.now()) throw new Problem(404, "This special access code is invalid, expired, or already used.");
  if (record.recipient_email && record.recipient_email !== user.email) throw new Problem(403, "This special access code was created for a different account email.");
  await env.DB.prepare("UPDATE special_access_codes SET use_count=use_count+1,last_redeemed_by=?,last_redeemed_at=? WHERE hash=? AND revoked_at IS NULL AND use_count<max_uses").bind(user.id, Date.now(), hash).run();
  return json({ ok: true, message: "Special access is linked to this KinForge account." });
}
async function addPaymentEvent(env: Env, request: Request) {
  const data = await body(request, 32768);
  const amount = money(data.amount);
  const fee = money(data.fee || 0);
  const now = Date.now();
  const status = ["paid", "pending", "refunded", "failed"].includes(data.status) ? data.status : "paid";
  const paidAt = Number.isFinite(Date.parse(String(data.paidAt || ""))) ? Date.parse(String(data.paidAt)) : now;
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO payment_events (id,provider,provider_event_id,source,status,product,tier,customer_email,customer_name,currency,amount,fee,net,paid_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, "manual", id, "owner-entry", status, String(data.product || "KinForge payment").trim().slice(0, 160), String(data.tier || "").trim().slice(0, 120) || null, data.customerEmail ? emailAddress(data.customerEmail) : null, String(data.customerName || "").trim().slice(0, 160) || null, currency(data.currency), amount, fee, Math.max(0, amount - fee), paidAt, now).run();
  return json({ ok: true, id }, 201);
}
function stripeSignatureParts(value: string) {
  const parts: Record<string, string[]> = {};
  for (const item of value.split(",")) {
    const [key, part] = item.split("=", 2);
    if (key && part) (parts[key] ||= []).push(part);
  }
  return parts;
}
async function hmacHex(secretKey: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secretKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signed)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function stripeWebhook(request: Request, env: Env) {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new Problem(503, "Stripe webhook signing is not configured.");
  const raw = await readText(request, 1024 * 1024);
  const signature = request.headers.get("stripe-signature") || "";
  const parts = stripeSignatureParts(signature);
  const timestamp = parts.t?.[0] || "";
  if (!timestamp || !parts.v1?.length) throw new Problem(400, "Stripe signature was missing.");
  const expected = await hmacHex(env.STRIPE_WEBHOOK_SECRET, `${timestamp}.${raw}`);
  if (!parts.v1.some(value => equal(value, expected))) throw new Problem(400, "Stripe signature did not match.");
  const event = JSON.parse(raw);
  const object = event?.data?.object || {};
  const metadata = object.metadata || {};
  const amount = Number(object.amount_total ?? object.amount_paid ?? object.amount_received ?? object.amount ?? 0);
  const email = object.customer_details?.email || object.customer_email || object.receipt_email || "";
  const status = ["checkout.session.completed", "invoice.paid", "payment_intent.succeeded", "charge.succeeded"].includes(event.type) ? "paid" : String(object.status || event.type || "pending").slice(0, 40);
  if (amount > 0) {
    await env.DB.prepare("INSERT INTO payment_events (id,provider,provider_event_id,source,status,product,tier,customer_email,customer_name,currency,amount,fee,net,paid_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,provider_event_id) DO UPDATE SET status=excluded.status,customer_email=excluded.customer_email,amount=excluded.amount,net=excluded.net,paid_at=excluded.paid_at")
      .bind(crypto.randomUUID(), "stripe", String(event.id || object.id), "stripe-webhook", status, String(metadata.product || object.description || "KinForge subscription").slice(0, 160), String(metadata.tier || object.mode || "").slice(0, 120) || null, email ? String(email).toLowerCase().slice(0, 254) : null, object.customer_details?.name || null, currency(object.currency || "SGD"), amount, 0, amount, Number(object.created || event.created || 0) * 1000 || Date.now(), Date.now()).run();
  }
  return json({ received: true });
}
async function issueAuthCode(env: Env, request: Request, email: string, purpose: AuthCodePurpose, delivery: "code" | "link" = "code") {
  await rateLimit(env, request, `auth-code-${purpose}`, 5, 60 * 60000, email);
  const user = await env.DB.prepare("SELECT * FROM accounts WHERE email=?").bind(email).first<Account>();
  let delivered = false;
  if (user) {
    const code = shortCode();
    await env.DB.prepare("INSERT INTO auth_codes (hash,account_id,purpose,expires_at,used_at,created_at) VALUES (?,?,?,?,NULL,?)").bind(await digest(`${purpose}:${user.id}:${code}`), user.id, purpose, Date.now() + 15 * 60000, Date.now()).run();
    delivered = await deliverAuthCode(env, request, email, purpose, code, delivery);
  } else if (env.EMAIL_CODE_ENDPOINT && env.EMAIL_CODE_TOKEN) delivered = true;
  return json({
    ok: true,
    deliveryMode: delivery,
    delivery: delivered ? "sent" : "email-not-configured",
    message: delivered
      ? delivery === "link" ? "If that account exists, KinForge sent a short-lived secret login link to its email address." : "If that account exists, KinForge sent a short-lived code to its email address."
      : "Email-code delivery is not configured for this KinForge deployment yet. Use your secret recovery key, or ask the app owner to add an email provider."
  });
}
async function consumeAuthCode(env: Env, user: Account, purpose: AuthCodePurpose, code: unknown) {
  const hash = await digest(`${purpose}:${user.id}:${String(code || "").trim()}`);
  const record = await env.DB.prepare("SELECT hash FROM auth_codes WHERE hash=? AND account_id=? AND purpose=? AND expires_at>? AND used_at IS NULL").bind(hash, user.id, purpose, Date.now()).first<{ hash: string }>();
  if (!record) return false;
  await env.DB.prepare("UPDATE auth_codes SET used_at=? WHERE hash=? AND used_at IS NULL").bind(Date.now(), hash).run();
  return true;
}
function requestToken(request: Request) { return request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || ""; }
async function currentAccount(env: Env, request: Request) {
  const token = requestToken(request);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Problem(401, "Sign in to your KinForge account.");
  const user = await env.DB.prepare("SELECT a.* FROM accounts a JOIN sessions s ON s.user_id=a.id WHERE s.hash=? AND s.expires_at>?").bind(await digest(token), Date.now()).first<Account>();
  if (!user) throw new Problem(401, "Your session has expired. Sign in again; your device changes are kept.");
  return user;
}
async function library(env: Env, id: string, user: Account, edit = false, owner = false) {
  const item = await env.DB.prepare("SELECT l.*,m.role FROM libraries l JOIN library_members m ON m.library_id=l.id WHERE l.id=? AND m.user_id=?").bind(id, user.id).first<Library>();
  if (!item) throw new Problem(404, "This library is unavailable or is no longer shared with you.");
  if ((edit && !["owner", "editor"].includes(item.role)) || (owner && item.role !== "owner")) throw new Problem(403, "Your account does not have permission to make this change.");
  return item;
}
const arrayKeys = ["books", "collections", "trees", "people", "relationships", "families", "events", "places", "placeTemplates", "sources", "sourceTemplates", "media", "todos", "dnaMatches", "records", "ideasJournal", "userFeedback", "reportDrafts", "labels", "customEventTypes", "customFactTypes", "customFactTerms", "customFamilyTypes", "customRelationshipSubtypes", "changes"];
function validateDocument(data: any) {
  if (!data || typeof data !== "object" || arrayKeys.some(key => !Array.isArray(data[key])) || !data.chartConfig || typeof data.chartConfig !== "object") throw new Problem(400, "This library has an unsupported format. Your saved library has not changed.");
  if (data.protectionRecords !== undefined && !Array.isArray(data.protectionRecords)) throw new Problem(400, "The protection records need a list of unique records.");
  for (const key of [...arrayKeys.filter(key => !key.startsWith("custom") && key !== "labels"), ...(data.protectionRecords ? ["protectionRecords"] : [])]) {
    const ids = new Set();
    for (const row of data[key]) { if (!row || typeof row.id !== "string" || !row.id || ids.has(row.id)) throw new Problem(400, `The ${key} records need unique identifiers.`); ids.add(row.id); }
  }
}
async function savedDocument(env: Env, item: Library): Promise<LibraryDocument | null> {
  const saved = item.object_key ? await env.BUCKET.get(item.object_key) : null;
  if (item.object_key && !saved) throw new Problem(503, "Your library is temporarily unavailable. Please retry.");
  return saved ? sanitizeLibraryVisibility(await saved.json<LibraryDocument>()) : null;
}
async function api(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url); const path = url.pathname; const method = request.method;
  const oauth = await driveOAuth(request, env, ctx); if (oauth) return oauth;
  if (path === "/api/stripe/webhook" && method === "POST") return stripeWebhook(request, env);
  if (method !== "GET" && method !== "HEAD") {
    if (request.headers.get("X-KinForge-Client") !== "1" || (request.headers.get("origin") && request.headers.get("origin") !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new Problem(403, "This request must come from KinForge.");
  }
  if (path === "/api/health") return json({ ok: true, version: "1.3.8" });
  if (path === "/api/support" && method === "POST") {
    const data = await body(request, 32768);
    await rateLimit(env, request, "support", 8, 60 * 60000, String(data.email || ""));
    const email = data.email ? emailAddress(data.email) : "";
    const ticket = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      type: String(data.type || "Support request").trim().slice(0, 80),
      subject: String(data.subject || "KinForge support request").trim().slice(0, 160),
      name: String(data.name || "").trim().slice(0, 120),
      email,
      message: String(data.message || "").trim().slice(0, 10000),
      device: String(data.device || "").trim().slice(0, 500),
      treeTitle: String(data.treeTitle || "").trim().slice(0, 200),
      proof: String(data.proof || "").trim().slice(0, 3000),
      permissionToReply: data.permissionToReply !== false,
      diagnostics: String(data.diagnostics || "").trim().slice(0, 5000)
    };
    if (!ticket.message) throw new Problem(400, "Write the support message before sending.");
    const delivered = await deliverSupportRequest(env, ticket);
    return json({
      ok: true,
      id: ticket.id,
      delivery: delivered ? "sent-to-serene-relay" : "serene-relay-not-configured",
      message: delivered ? "Your support request was sent to Serene Relay." : "Serene Relay delivery is not configured yet. Download or save this support request so it is not lost.",
      ticket
    }, delivered ? 201 : 202);
  }
  if (path === "/api/auth/register" && method === "POST") {
    const data = await body(request); const email = emailAddress(data.email); const password = validPassword(data.password);
    if (data.privacyAccepted !== true && data.privacyAccepted !== "on" || data.termsAccepted !== true && data.termsAccepted !== "on") throw new Problem(400, "Agree to both the KinForge Privacy Policy and Terms & Conditions before creating an account.");
    await rateLimit(env, request, "register", 8, day);
    const id = crypto.randomUUID(), libraryId = crypto.randomUUID(), recoveryCode = secret();
    const hash = await passwordHash(password); const recoveryHash = await digest(recoveryCode);
    if (await env.DB.prepare("SELECT id FROM accounts WHERE email=?").bind(email).first()) throw new Problem(409, "This account already exists. Sign in or use your recovery code.");
    await env.DB.batch([
      env.DB.prepare("INSERT INTO accounts (id,email,name,password,recovery_hash,created_at,terms_accepted_at,terms_version,privacy_accepted_at,privacy_version) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, email, String(data.name || email.split("@")[0]).trim().slice(0, 100), hash, recoveryHash, Date.now(), Date.now(), "kinforge-terms-v1", Date.now(), "kinforge-privacy-v1"),
      env.DB.prepare("INSERT INTO libraries (id,owner_id,name,revision,updated_at) VALUES (?,?,?,0,?)").bind(libraryId, id, "My relationship library", Date.now()),
      env.DB.prepare("INSERT INTO library_members (library_id,user_id,role) VALUES (?,?,'owner')").bind(libraryId, id)
    ]);
    const user = await env.DB.prepare("SELECT * FROM accounts WHERE id=?").bind(id).first<Account>();
    return json({ user: publicAccount(user!, env), recoveryCode }, 201, { "Set-Cookie": cookie(await sessionToken(env, id), request) });
  }
  if (path === "/api/auth/login" && method === "POST") {
    const data = await body(request); const email = emailAddress(data.email);
    await rateLimit(env, request, "login", 20, 15 * 60000, email);
    const user = await env.DB.prepare("SELECT * FROM accounts WHERE email=?").bind(email).first<Account>();
    const password = typeof data.password === "string" ? data.password.slice(0, 256) : "";
    const encoded = user?.password || `scrypt-v1:${"0".repeat(64)}:${"0".repeat(64)}`;
    if (!await verifyPassword(password, encoded) || !user) throw new Problem(401, "The email or password did not match.");
    return json({ user: publicAccount(user, env) }, 200, { "Set-Cookie": cookie(await sessionToken(env, user.id), request) });
  }
  if (path === "/api/auth/code/request" && method === "POST") {
    const data = await body(request); const email = emailAddress(data.email); const purpose = authCodePurpose(data.purpose);
    const delivery = data.delivery === "link" && purpose === "login" ? "link" : "code";
    return issueAuthCode(env, request, email, purpose, delivery);
  }
  if (path === "/api/auth/code/confirm" && method === "POST") {
    const data = await body(request); const email = emailAddress(data.email); const purpose = authCodePurpose(data.purpose);
    await rateLimit(env, request, `auth-code-confirm-${purpose}`, 10, 15 * 60000, email);
    const user = await env.DB.prepare("SELECT * FROM accounts WHERE email=?").bind(email).first<Account>();
    if (!user || !await consumeAuthCode(env, user, purpose, data.code)) throw new Problem(400, "The email or code did not match.");
    if (purpose === "reset") {
      const recoveryCode = secret(); const nextHash = await passwordHash(validPassword(data.password));
      await env.DB.batch([
        env.DB.prepare("UPDATE accounts SET password=?,recovery_hash=? WHERE id=?").bind(nextHash, await digest(recoveryCode), user.id),
        env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id),
        env.DB.prepare("UPDATE auth_codes SET used_at=? WHERE account_id=? AND used_at IS NULL").bind(Date.now(), user.id)
      ]);
      return json({ user: publicAccount(user, env), recoveryCode }, 200, { "Set-Cookie": cookie(await sessionToken(env, user.id), request) });
    }
    return json({ user: publicAccount(user, env) }, 200, { "Set-Cookie": cookie(await sessionToken(env, user.id), request) });
  }
  if (path === "/api/auth/recover" && method === "POST") {
    const data = await body(request); const email = emailAddress(data.email); const password = validPassword(data.password);
    await rateLimit(env, request, "recover", 5, 60 * 60000, email);
    const user = await env.DB.prepare("SELECT * FROM accounts WHERE email=?").bind(email).first<Account>();
    if (!user || !equal(await digest(String(data.recoveryCode || "").trim()), user.recovery_hash)) throw new Problem(400, "The email or recovery code did not match.");
    const recoveryCode = secret(); const nextHash = await passwordHash(password);
    await env.DB.batch([
      env.DB.prepare("UPDATE accounts SET password=?,recovery_hash=? WHERE id=?").bind(nextHash, await digest(recoveryCode), user.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id)
    ]);
    return json({ user: publicAccount(user, env), recoveryCode }, 200, { "Set-Cookie": cookie(await sessionToken(env, user.id), request) });
  }
  const user = await currentAccount(env, request);
  if (path === "/api/auth/me" && method === "GET") return json({ user: publicAccount(user, env) });
  if (path === "/api/auth/logout" && method === "POST") {
    await env.DB.prepare("DELETE FROM sessions WHERE hash=?").bind(await digest(requestToken(request))).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", request, 0) });
  }
  if (path === "/api/owner/revenue" && method === "GET") {
    ownerOnly(env, user);
    return ownerRevenue(env);
  }
  if (path === "/api/owner/revenue/events" && method === "POST") {
    ownerOnly(env, user);
    await rateLimit(env, request, "owner-revenue-events", 120, 60 * 60000, user.id);
    return addPaymentEvent(env, request);
  }
  if (path === "/api/owner/access" && method === "GET") {
    ownerOnly(env, user);
    return ownerAccessSummary(env);
  }
  if (path === "/api/owner/special-access-codes" && method === "POST") {
    ownerOnly(env, user);
    await rateLimit(env, request, "owner-special-access", 120, 60 * 60000, user.id);
    return createSpecialAccessCode(env, request, user);
  }
  const specialCode = /^\/api\/owner\/special-access-codes\/([a-f0-9]{64})$/.exec(path);
  if (specialCode && method === "DELETE") {
    ownerOnly(env, user);
    return revokeSpecialAccessCode(env, specialCode[1]);
  }
  if (path === "/api/special-access/redeem" && method === "POST") {
    await rateLimit(env, request, "special-access-redeem", 20, 15 * 60000, user.id);
    return redeemSpecialAccessCode(env, await body(request), user);
  }
  if (path === "/api/beta/interest" && method === "GET") {
    const interest = await env.DB.prepare("SELECT plan,interval,discount_code,created_at,updated_at FROM beta_interests WHERE account_id=?").bind(user.id).first();
    return json({ interest });
  }
  if (path === "/api/beta/interest" && method === "POST") {
    const data = await body(request);
    const plan = "beta";
    const interval = "month";
    if (!data.consent) throw new Problem(400, "Confirm that this is interest registration only.");
    await env.DB.prepare("INSERT INTO beta_interests (account_id,plan,interval,discount_code,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,interval=excluded.interval,discount_code=excluded.discount_code,updated_at=excluded.updated_at")
      .bind(user.id, plan, interval, null, Date.now(), Date.now()).run();
    return json({ ok: true, interest: { plan, interval, discountCode: null } }, 201);
  }
  if (path === "/api/beta/interest" && method === "DELETE") {
    await env.DB.prepare("DELETE FROM beta_interests WHERE account_id=?").bind(user.id).run();
    return json({ ok: true });
  }
  if (path === "/api/libraries" && method === "GET") {
    const result = await env.DB.prepare("SELECT l.id,l.name,l.revision,l.updated_at,m.role,a.email AS owner_email FROM libraries l JOIN library_members m ON m.library_id=l.id JOIN accounts a ON a.id=l.owner_id WHERE m.user_id=? ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END,l.name").bind(user.id).all();
    return json({ libraries: result.results });
  }
  if (path === "/api/invitations/accept" && method === "POST") {
    const data = await body(request); const hash = await digest(String(data.code || "").trim());
    await rateLimit(env, request, "invite", 30, 15 * 60000, user.id);
    const invitation = await env.DB.prepare("SELECT * FROM library_invitations WHERE hash=? AND expires_at>? AND (used_by IS NULL OR used_by=?)").bind(hash, Date.now(), user.id).first<{ library_id: string; role: string }>();
    if (!invitation) throw new Problem(404, "This invitation is invalid, expired, revoked, or already used.");
    await env.DB.batch([
      env.DB.prepare("UPDATE library_invitations SET used_by=? WHERE hash=? AND (used_by IS NULL OR used_by=?)").bind(user.id, hash, user.id),
      env.DB.prepare("INSERT INTO library_members (library_id,user_id,role) SELECT library_id,?,role FROM library_invitations WHERE hash=? AND used_by=? ON CONFLICT(library_id,user_id) DO NOTHING").bind(user.id, hash, user.id)
    ]);
    if (!await env.DB.prepare("SELECT role FROM library_members WHERE library_id=? AND user_id=?").bind(invitation.library_id, user.id).first()) throw new Problem(409, "This invitation was already used.");
    return json({ libraryId: invitation.library_id });
  }
  const match = /^\/api\/libraries\/([a-f0-9-]+)(?:\/(.*))?$/.exec(path);
  if (!match) throw new Problem(404, "This action was not found.");
  const [, id, action = ""] = match;
  const driveAction = action === "drives" || action.startsWith("drives/") || action === "exports" || action.startsWith("exports/");
  const item = await library(env, id, user, method === "PUT", driveAction || action === "sharing" || action.startsWith("members/") || action.startsWith("invitations/"));
  if (driveAction) {
    if (method === "POST" && action.endsWith("/connect")) await rateLimit(env, request, "drive-connect", 20, 3600000, user.id);
    return driveRoutes(request, env, ctx, item, action, await digest(requestToken(request)), limit => body(request, limit), validateDocument);
  }
  if (!action && method === "GET") {
    if (url.searchParams.get("since") === String(item.revision)) return json({ unchanged: true, revision: item.revision });
    const saved = await savedDocument(env, item);
    return json({ revision: item.revision, state: saved && user.id !== item.owner_id ? sharedLibraryView(saved).state : saved, updatedAt: item.updated_at });
  }
  if (!action && method === "PUT") {
    const data = await body(request, 16 * 1024 * 1024); validateDocument(data.state);
    if (!Number.isSafeInteger(data.revision) || data.revision !== item.revision) throw new Problem(409, "Another device saved changes. Refresh and merge before saving.");
    sanitizeLibraryVisibility(data.state);
    if (user.id !== item.owner_id) {
      const saved = await savedDocument(env, item);
      const visibleAssets = libraryAssetHashes(saved ? sharedLibraryView(saved).state : null);
      // A guessed, unreferenced owner asset cannot be made readable by adding its hash.
      for (const hash of libraryAssetHashes(data.state)) if (!visibleAssets.has(hash) &&
        !await env.BUCKET.head(`libraries/${id}/asset-writers/${user.id}/${hash}`)) throw new LibraryPrivacyError();
      data.state = mergeSharedLibraryWrite(saved ?? Object.fromEntries(arrayKeys.map(key => [key, []])), data.state);
    }
    const key = `libraries/${id}/snapshots/${crypto.randomUUID()}.json`;
    await env.BUCKET.put(key, JSON.stringify(data.state), { httpMetadata: { contentType: "application/json" } });
    const updatedAt = Date.now();
    const result = await env.DB.prepare("UPDATE libraries SET revision=revision+1,object_key=?,updated_at=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM library_members WHERE library_id=? AND user_id=? AND role IN ('owner','editor'))").bind(key, updatedAt, id, data.revision, id, user.id).run();
    if (result.meta.changes !== 1) { ctx.waitUntil(env.BUCKET.delete(key)); throw new Problem(409, "Another device saved changes. Refresh and merge before saving."); }
    // Old snapshots are retained so acknowledged versions remain recoverable.
    ctx.waitUntil(syncLibraryDrives(env, id));
    return json({ revision: data.revision + 1, updatedAt });
  }
  const asset = /^assets\/([a-f0-9]{64})$/.exec(action);
  if (asset) {
    const key = `libraries/${id}/assets/${asset[1]}`;
    if (method === "PUT") {
      const text = await readText(request, 50 * 1024 * 1024);
      if (!text.startsWith("data:") || await digest(text) !== asset[1]) throw new Problem(400, "The attachment checksum did not match.");
      await env.BUCKET.put(key, text);
      if (user.id !== item.owner_id) await env.BUCKET.put(`libraries/${id}/asset-writers/${user.id}/${asset[1]}`, "1");
      return json({ ok: true });
    }
    if (method === "GET") {
      if (user.id !== item.owner_id) {
        const saved = await savedDocument(env, item);
        if (!saved || !libraryAssetHashes(sharedLibraryView(saved).state).has(asset[1])) throw new Problem(404, "This attachment is unavailable.");
      }
      const file = await env.BUCKET.get(key);
      if (!file) throw new Problem(404, "This attachment is unavailable.");
      return new Response(file.body, { headers: { "Content-Type": "text/plain", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
  }
  if (action === "sharing" && method === "GET") {
    const members = await env.DB.prepare("SELECT m.user_id,m.role,a.email,a.name FROM library_members m JOIN accounts a ON a.id=m.user_id WHERE m.library_id=?").bind(id).all();
    const invites = await env.DB.prepare("SELECT hash,role,expires_at FROM library_invitations WHERE library_id=? AND used_by IS NULL AND expires_at>?").bind(id, Date.now()).all();
    return json({ members: members.results, invitations: invites.results });
  }
  if (action === "sharing" && method === "POST") {
    const data = await body(request); if (!["viewer", "editor"].includes(data.role)) throw new Problem(400, "Choose view or edit access.");
    const code = secret(); const expiresAt = Date.now() + 7 * day;
    await env.DB.prepare("INSERT INTO library_invitations (hash,library_id,role,expires_at) VALUES (?,?,?,?)").bind(await digest(code), id, data.role, expiresAt).run();
    return json({ code, expiresAt });
  }
  if (action.startsWith("members/") && method === "DELETE") {
    const target = action.slice("members/".length); if (target === item.owner_id) throw new Problem(400, "The library owner cannot be removed.");
    await env.DB.prepare("DELETE FROM library_members WHERE library_id=? AND user_id=?").bind(id, target).run(); return json({ ok: true });
  }
  if (action.startsWith("invitations/") && method === "DELETE") {
    await env.DB.prepare("DELETE FROM library_invitations WHERE library_id=? AND hash=?").bind(id, action.slice("invitations/".length)).run(); return json({ ok: true });
  }
  throw new Problem(405, "This action is not supported.");
}
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const release = await releaseRoutes(request, env); if (release) return release;
    const website = publicWebsiteRoutes(request); if (website) return website;
    if (url.pathname.startsWith("/api/")) {
      try { return await api(request, env, ctx); }
      catch (error) { if (error instanceof Problem || error instanceof DriveError) return json({ error: error.message }, error.status); if (error instanceof LibraryPrivacyError) return json({ error: error.message, code: error.code }, 403); console.error("KinForge API failure", error instanceof Error ? error.message : "Unknown error"); return json({ error: "Cloud storage is temporarily unavailable. Your device changes are kept. Please retry." }, 503); }
    }
    if (url.pathname === "/app" || url.pathname.startsWith("/app/")) { url.pathname = url.pathname.replace(/^\/app\/?/, "/"); return env.ASSETS.fetch(new Request(url, request)); }
    return env.ASSETS.fetch(request);
  }
};
