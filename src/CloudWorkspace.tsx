import { lazy, useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, RefreshCw, Share2, X, Copy, Download, LogIn, BadgeDollarSign, PlusCircle, KeyRound, UsersRound, ShieldCheck, Mail, Send, FileText, ClipboardList, Globe2, ExternalLink } from "lucide-react";
import { AppState, createSeedState } from "./domain";
import { hydrateLibrary } from "./libraryState";
import { CloudError, CloudLibrary, CloudUser, clearAssetCache, cloudRequest } from "./cloudApi";
import { cleanupCloudCache } from "./cloudCache";
import { CloudSync, SyncView } from "./cloudSync";
import type { ConflictChoices } from "./cloudMerge";
import { loadAuthState, login as legacyLogin, activeUser as legacyUser } from "./auth";
import { clearCloudStartup, readCloudStartup, writeCloudStartup } from "./cloudStartup";
import { startCloudExports } from "./cloudExports";
import { recordPublicExportAgreement } from "./exportAttribution";
import { LEGAL_EFFECTIVE_DATE, PRIVACY_POLICY_SECTIONS, TERMS_CONDITIONS_SECTIONS, recordAppLegalAgreement } from "./legalPolicies";
const App = lazy(() => import("./App"));
const CloudDrives = lazy(() => import("./CloudDrives"));
const UpdateCenter = lazy(() => import("./UpdateCenter"));

export default function CloudWorkspace() {
  const [startup] = useState(() => readCloudStartup());
  const [user, setUser] = useState<CloudUser | null>(() => startup?.user || null);
  const [checking, setChecking] = useState(() => !startup?.user);
  const [demo, setDemo] = useState<AppState | null>(null);
  const [libraries, setLibraries] = useState<CloudLibrary[]>(() => startup?.libraries || []);
  const [libraryId, setLibraryId] = useState(() => startup?.libraryId || startup?.libraries[0]?.id || "");
  const [view, setView] = useState<SyncView | null>(null);
  const [viewLibraryId, setViewLibraryId] = useState("");
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState("");
  const [sharing, setSharing] = useState(false);
  const [drivesOpen, setDrivesOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [choices, setChoices] = useState<ConflictChoices>({});
  const sync = useRef<CloudSync | null>(null);
  const [retry, setRetry] = useState(0);
  const library = libraries.find(item => item.id === libraryId);
  useEffect(() => {
    const key = "kinforge-cache-housekeeping-v1";
    const run = () => {
      const last = Number(localStorage.getItem(key) || "0");
      if (Date.now() - last < 6 * 60 * 60000) return;
      localStorage.setItem(key, String(Date.now()));
      void cleanupCloudCache(user?.id || "", libraryId).catch(() => {});
    };
    run();
    const timer = window.setInterval(run, 6 * 60 * 60000);
    return () => window.clearInterval(timer);
  }, [user?.id, libraryId]);
  useEffect(() => {
    setDrivesOpen(false); setExportMessage("");
    if (!user || !library || library.role !== "owner" || demo || !view || view.locked) return;
    const stop = startCloudExports(user.id, library.id);
    const tick = () => { if (navigator.onLine) void cloudRequest(`/api/libraries/${library.id}/drives/sync`, "POST", {}).catch(() => {}); };
    const report = (event: Event) => setExportMessage((event as CustomEvent<string>).detail);
    window.addEventListener("kinforge-export-status", report); window.addEventListener("online", tick); window.addEventListener("focus", tick);
    const timer = window.setInterval(tick, 20000); tick();
    return () => { stop(); clearInterval(timer); window.removeEventListener("kinforge-export-status", report); window.removeEventListener("online", tick); window.removeEventListener("focus", tick); };
  }, [user?.id, libraryId, library?.role, !!demo, !!view, view?.locked]);
  useEffect(() => {
    let active = true;
    if (sessionStorage.getItem("kinforge-demo-session") === "true") { setDemo(demoState()); setChecking(false); return; }
    cloudRequest<{ user: CloudUser }>("/api/auth/me").then(data => {
      if (!active) return;
      setUser(data.user); setError("");
    }).catch(error => {
      if (!active) return;
      if (error instanceof CloudError && error.status === 401) {
        clearCloudStartup(); setUser(null); setLibraries([]); setLibraryId(""); setView(null); setViewLibraryId("");
      } else setError("Connect to the internet to refresh your account. Your last cloud library remains available on this device.");
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  async function refreshLibraries(select?: string) {
    const data = await cloudRequest<{ libraries: CloudLibrary[] }>("/api/libraries");
    const nextLibraryId = select || (data.libraries.some(l => l.id === libraryId) ? libraryId : data.libraries[0]?.id || "");
    setLibraries(data.libraries); setLibraryId(nextLibraryId);
    if (user) writeCloudStartup(user, data.libraries, nextLibraryId);
  }
  useEffect(() => { if (user) void refreshLibraries().catch(e => setError(e.message)); else { setLibraries([]); setLibraryId(""); } }, [user?.id]);
  useEffect(() => {
    if (!user || !library) return;
    let active = true; setError(""); setChoices({});
    const controller = new CloudSync(user, library, next => { if (active) { setView(next); setViewLibraryId(library.id); } }); sync.current = controller;
    let failed = false;
    void controller.start().catch(e => { failed = true; if (active) setError(e.message); });
    const retrySync = () => { if (failed) setRetry(n => n + 1); else void controller.sync(); };
    window.addEventListener("online", retrySync); window.addEventListener("focus", retrySync);
    return () => { active = false; void controller.stop(); window.removeEventListener("online", retrySync); window.removeEventListener("focus", retrySync); };
  }, [user?.id, libraryId, retry]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (view?.dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [view?.dirty]);
  useEffect(() => {
    const key = "kinforge-monthly-update-check-v1";
    const last = Number(localStorage.getItem(key) || "0");
    if (Date.now() - last < 30 * 86400000) return;
    localStorage.setItem(key, String(Date.now()));
    void cloudRequest<{ version?: string }>("/api/releases/latest").then(async latest => {
      const info = await window.kinforgeNative?.getAppInfo?.().catch(() => null);
      if (info && latest.version) {
        const { compareVersions } = await import("./UpdateCenter");
        if (compareVersions(latest.version, info.version) > 0) setUpdatesOpen(true);
      }
    }).catch(() => {});
  }, []);
  async function signOut() {
    try {
      await cloudRequest("/api/auth/logout", "POST", {});
      await sync.current?.stop(); sync.current = null; clearAssetCache(); clearCloudStartup(); setUser(null); setView(null); setViewLibraryId(""); setRecovery(""); setSharing(false); setRevenueOpen(false); setAccessOpen(false); setNewsletterOpen(false); setSupportOpen(false); setWebsiteOpen(false); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Reconnect before signing out."); }
  }
  if (demo) return <App cloud={{ state: demo, account: { id: "demo", name: "Guest demo", email: "" }, onChange: state => { setDemo(state); localStorage.setItem("kinforge-demo-v1", JSON.stringify(state)); }, onSave: state => { setDemo(state); localStorage.setItem("kinforge-demo-v1", JSON.stringify(state)); }, toolbar: <span className="cloud-status">Demo - saved on this device</span>, onSignOut: () => { setDemo(null); sessionStorage.removeItem("kinforge-demo-session"); }, readOnly: false, saved: true, demo: true, canManagePrivacy: true }} />;
  if (checking) return <div className="cloud-loading" role="status">Connecting to your KinForge account...</div>;
  if (!user) return <CloudSignIn error={error} onSignedIn={(account, code) => { setUser(account); setRecovery(code || ""); setError(""); }} onDemo={() => { const state = demoState(); localStorage.setItem("kinforge-demo-v1", JSON.stringify(state)); setDemo(state); sessionStorage.setItem("kinforge-demo-session", "true"); setError(""); }} />;
  const toolbar = <div className="cloud-toolbar"><button className={`cloud-status ${view?.error ? "cloud-warning" : ""}`} onClick={() => void sync.current?.sync()} title={view?.lastSaved ? `Last saved ${new Date(view.lastSaved).toLocaleString()}` : "Sync now"} aria-label={`Cloud sync: ${view?.status || "Connecting"}`}>
    {view?.error ? <CloudOff size={17} /> : <Cloud size={17} />}<span>{view?.status || "Connecting"}</span></button>{library?.role === "owner" && <button className="button secondary" onClick={() => setDrivesOpen(true)}><Cloud size={16} />Cloud drives</button>}{user.ownerDashboard && <button className="button secondary owner-tool-button" onClick={() => setRevenueOpen(true)}><BadgeDollarSign size={16} />Payments</button>}{user.ownerDashboard && <button className="button secondary owner-tool-button" onClick={() => setAccessOpen(true)}><KeyRound size={16} />Accounts & access</button>}{user.ownerDashboard && <button className="button secondary owner-tool-button" onClick={() => setNewsletterOpen(true)}><Mail size={16} />Newsletters</button>}{user.ownerDashboard && <button className="button secondary owner-tool-button" onClick={() => setSupportOpen(true)}><ClipboardList size={16} />Support tickets</button>}{user.ownerDashboard && <button className="button secondary owner-tool-button" onClick={() => setWebsiteOpen(true)}><Globe2 size={16} />Websites</button>}<button className="button secondary" onClick={() => setUpdatesOpen(true)}><RefreshCw size={16} />Updates</button><button className="button secondary" onClick={() => setSharing(true)} title="Account, libraries and sharing"><Share2 size={16} />Account & sharing</button></div>;
  return <>
    {view && viewLibraryId === libraryId ? <div style={{ display: "contents" }} {...(view.preview ? { inert: "" } : {})}><App key={`${user.id}:${libraryId}`} cloud={{ state: view.state, account: user, onChange: state => sync.current?.change(state), onSave: async state => { sync.current?.change(state); await sync.current?.sync(); }, onSignOut: signOut, toolbar, readOnly: library?.role === "viewer" || view.locked || view.conflicts.length > 0, saved: !view.dirty && !view.error, demo: false, canManagePrivacy: library?.role === "owner" }} /></div> : <div className="cloud-loading"><p role="status">Opening your cloud library...</p><button className="button secondary" onClick={() => { if (!library) void refreshLibraries().catch(e => setError(e.message)); else setRetry(n => n + 1); }}><RefreshCw size={16} />Retry</button><button className="button ghost" onClick={signOut}>Sign out</button></div>}
    {view?.preview && <div className="cloud-notice" role="status">Opening the full saved library. Editing and downloads will be available when it is ready.</div>}
    {(error || view?.error) && <div className="cloud-notice" role="alert"><span>{error || view?.error}</span><button onClick={() => error || !view || view.locked ? setRetry(n => n + 1) : void sync.current?.sync()}>Retry</button></div>}
    {recovery && <RecoveryDialog email={user.email} code={recovery} onSaved={() => setRecovery("")} />}
    {sharing && library && <SharingDialog user={user} libraries={libraries} selected={library} onClose={() => setSharing(false)} onSelect={id => { setLibraryId(id); setSharing(false); }} onJoined={async id => { await refreshLibraries(id); setSharing(false); }} />}
    {drivesOpen && library?.role === "owner" && <CloudDrives library={library} onClose={() => setDrivesOpen(false)} />}
    {revenueOpen && user.ownerDashboard && <OwnerRevenueDialog onClose={() => setRevenueOpen(false)} />}
    {accessOpen && user.ownerDashboard && <OwnerAccessDialog onClose={() => setAccessOpen(false)} />}
    {newsletterOpen && user.ownerDashboard && <OwnerNewsletterDialog onClose={() => setNewsletterOpen(false)} />}
    {supportOpen && user.ownerDashboard && <OwnerSupportDialog onClose={() => setSupportOpen(false)} />}
    {websiteOpen && user.ownerDashboard && <OwnerWebsiteControlDialog onClose={() => setWebsiteOpen(false)} />}
    {updatesOpen && <UpdateCenter currentState={view?.state ?? null} onClose={() => setUpdatesOpen(false)} />}
    {exportMessage && !recovery && <div className="cloud-export-notice" role="status"><span>{exportMessage}</span><button aria-label="Dismiss export message" onClick={() => setExportMessage("")}><X size={16} /></button></div>}
    {!!view?.conflicts.length && !recovery && <div className="cloud-scrim"><section className="cloud-dialog wide" role="dialog" aria-modal="true" aria-labelledby="conflict-title"><h2 id="conflict-title">Changes need your choice</h2><p>Two devices changed the same information. Choose which version to keep for each item.</p>{view.conflicts.map(conflict => <fieldset className="sync-conflict" key={conflict.path}><legend>{conflict.path}</legend>{(["local", "remote"] as const).map(side => <label key={side}><input type="radio" name={conflict.path} checked={choices[conflict.path] === side} onChange={() => setChoices(previous => ({ ...previous, [conflict.path]: side }))} /><strong>{side === "local" ? "This device" : "Cloud version"}</strong><pre>{formatValue(conflict[side])}</pre></label>)}</fieldset>)}<button className="button" disabled={view.conflicts.some(c => !choices[c.path])} onClick={() => void sync.current?.resolve(choices).catch(e => setError(e.message))}>Save my choices</button></section></div>}
  </>;
}
function RecoveryDialog({ email, code, onSaved }: { email: string; code: string; onSaved: () => void }) {
  const [busy, setBusy] = useState<"download" | "copy" | null>(null);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const copyField = useRef<HTMLTextAreaElement>(null);
  const details = `KinForge account: ${email}\nRecovery code: ${code}\nKeep this private. A new password reset replaces this code.\n`;
  useEffect(() => { if (manualCopy) { copyField.current?.focus(); copyField.current?.select(); } }, [manualCopy]);

  async function download() {
    setBusy("download"); setMessage(null);
    try {
      const { downloadBlob } = await import("./exporters");
      const result = await downloadBlob("KinForge-account-recovery.txt", details, "text/plain;charset=utf-8", undefined, { localOnly: true });
      setMessage({ failed: false, text: result.status === "native-saved"
        ? result.path ? `Recovery file saved to ${result.path}` : "Recovery file saved by the desktop app."
        : "Download started. Check your downloads for KinForge-account-recovery.txt. This browser cannot confirm that the file was saved. If no file appears, copy the recovery details below." });
    } catch {
      setMessage({ failed: true, text: "The recovery file could not be downloaded. Try again or copy the recovery details below." });
    } finally { setBusy(null); }
  }
  async function copy() {
    setBusy("copy"); setMessage(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(details);
      setManualCopy(false);
      setMessage({ failed: false, text: "Recovery details copied, including your account email. Keep them somewhere private before confirming you have saved them." });
    } catch {
      setManualCopy(true);
      copyField.current?.focus(); copyField.current?.select();
      setMessage({ failed: true, text: "Clipboard access is unavailable. Copy the selected recovery details below and keep them somewhere private." });
    } finally { setBusy(null); }
  }

  return <div className="cloud-scrim"><section className="cloud-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
    <h2 id="recovery-title">Your account recovery code</h2>
    <p>Keep this code somewhere safe. You will need it to reset your password if you forget it.</p>
    <p style={{ overflowWrap: "anywhere" }}>{email}</p><code className="recovery-code">{code}</code>
    <div className="button-row">
      <button className="button" disabled={busy !== null} onClick={() => void download()}><Download size={16} />{busy === "download" ? "Preparing download..." : "Download recovery code"}</button>
      <button className="button secondary" disabled={busy !== null} onClick={() => void copy()}><Copy size={16} />{busy === "copy" ? "Copying..." : "Copy recovery details"}</button>
      <button className="button secondary" disabled={busy !== null} onClick={onSaved}>I have saved it</button>
    </div>
    {message && <p role={message.failed ? "alert" : "status"} style={{ overflowWrap: "anywhere" }}>{message.text}</p>}
    {manualCopy && <textarea ref={copyField} className="control" aria-label="Recovery details for manual copy" value={details} readOnly rows={6} spellCheck={false} onFocus={event => event.currentTarget.select()} style={{ width: "100%", boxSizing: "border-box" }} />}
  </section></div>;
}
function demoState() { try { const value = localStorage.getItem("kinforge-demo-v1"); if (value) return hydrateLibrary(JSON.parse(value) as AppState); } catch { /* A demo can always start fresh. */ } return createSeedState(); }
function formatValue(value: unknown) { if (value === undefined) return "Deleted"; if (typeof value === "string") return value.startsWith("data:") ? "Attached file" : value; return JSON.stringify(value, (_key, v) => typeof v === "string" && v.startsWith("data:") ? "Attached file" : v, 2); }
type RevenueTotal = { currency: string; gross: number; fees: number; net: number; payments: number };
type RevenueEvent = { id: string; provider: string; source: string; status: string; product: string; tier?: string; customerEmail?: string; customerName?: string; currency: string; amount: number; fee: number; net: number; paidAt: number; createdAt: number };
type RevenueSummary = { setupRequired: boolean; totals: RevenueTotal[]; recent: RevenueEvent[]; betaInterestCount: number; accountCount: number };
type OwnerAccount = { id: string; email: string; name: string; createdAt: number };
type BetaSignup = { accountId: string; email: string; name: string; accountCreatedAt: number; plan: string; interval: string; discountCode?: string; createdAt: number; updatedAt: number };
type NewsletterSubscriber = { accountId: string; email: string; name: string; status: string; source: string; createdAt?: number; updatedAt: number };
type NewsletterRelease = { id: string; title: string; subject: string; summary?: string; status: string; objectKey: string; attachmentCount: number; size: number; createdAt: number; releasedAt?: number; recipientCount: number; deliveryStatus: string };
type SpecialAccessCode = { hash: string; label: string; recipientEmail?: string; note?: string; createdAt: number; expiresAt?: number; maxUses: number; useCount: number; revokedAt?: number; lastRedeemedAt?: number; lastRedeemedByEmail?: string };
type OwnerAccessSummary = { setupRequired: boolean; accounts: OwnerAccount[]; signups: BetaSignup[]; subscribers: NewsletterSubscriber[]; codes: SpecialAccessCode[] };
type OwnerNewsletterSummary = { setupRequired: boolean; subscribers: NewsletterSubscriber[]; releases: NewsletterRelease[] };
type SupportTicket = { id: string; type: string; subject: string; name?: string; email?: string; message: string; device?: string; treeTitle?: string; proof?: string; permissionToReply: number | boolean; diagnostics?: string; status: string; priority: string; deliveryStatus: string; createdAt: number; updatedAt: number; lastReplyAt?: number };
type SupportReply = { id: string; ticketId: string; authorEmail: string; message: string; deliveryStatus: string; createdAt: number };
type OwnerSupportSummary = { setupRequired: boolean; tickets: SupportTicket[]; replies: SupportReply[]; counts: { status: string; count: number }[] };
const currencies = ["SGD", "USD", "EUR", "GBP", "AUD", "CAD", "MYR", "IDR", "JPY", "KRW", "CNY", "INR"];
const ticketStatuses = ["open", "in-progress", "waiting-customer", "resolved", "closed"];
const ticketPriorities = ["low", "normal", "high", "urgent"];
function formatMoney(currencyCode: string, cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format((cents || 0) / 100);
}
function OwnerRevenueDialog({ onClose }: { onClose: () => void }) {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ customerEmail: "", customerName: "", product: "KinForge subscription", tier: "Beta program", currency: "SGD", amount: "", fee: "", status: "paid", paidAt: new Date().toISOString().slice(0, 10) });
  async function refresh() {
    setMessage("");
    const data = await cloudRequest<RevenueSummary>("/api/owner/revenue");
    setSummary(data);
  }
  useEffect(() => { void refresh().catch(error => setMessage(error instanceof Error ? error.message : "Could not load revenue.")); }, []);
  async function addEvent() {
    setBusy(true); setMessage("");
    try {
      await cloudRequest("/api/owner/revenue/events", "POST", form);
      setForm(previous => ({ ...previous, amount: "", fee: "", customerEmail: "", customerName: "" }));
      await refresh();
      setMessage("Payment recorded in the owner ledger.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the payment.");
    } finally { setBusy(false); }
  }
  return <div className="cloud-scrim"><section className="cloud-dialog wide owner-revenue" role="dialog" aria-modal="true" aria-labelledby="owner-revenue-title">
    <button className="cloud-close" aria-label="Close owner revenue" onClick={onClose}><X size={20} /></button>
    <h2 id="owner-revenue-title">Owner revenue</h2>
    <p className="quiet">Private owner view for Stripe payments, subscription income, paid beta revenue, coupon/discount outcomes, and manual owner entries. Guests and ordinary customer accounts cannot open this area.</p>
    {summary?.setupRequired && <p className="auth-message bad" role="alert">The payment ledger table is not active on this deployment yet. Publish the latest cloud build or run the new database migration before live Stripe events can appear.</p>}
    <div className="revenue-metrics">
      {summary?.totals.length ? summary.totals.map(total => <article key={total.currency}>
        <span>{total.currency}</span><strong>{formatMoney(total.currency, total.net)}</strong><small>{total.payments} payments · gross {formatMoney(total.currency, total.gross)} · fees {formatMoney(total.currency, total.fees)}</small>
      </article>) : <article><span>Total earnings</span><strong>{summary ? "No payments yet" : "Loading..."}</strong><small>Signed Stripe webhook payments and owner entries will appear here.</small></article>}
      <article><span>Accounts</span><strong>{summary?.accountCount ?? "..."}</strong><small>Signed-in KinForge accounts</small></article>
      <article><span>Beta interest</span><strong>{summary?.betaInterestCount ?? "..."}</strong><small>People who joined the beta list</small></article>
    </div>
    <section className="owner-revenue-entry" aria-labelledby="owner-revenue-entry-title">
      <h3 id="owner-revenue-entry-title">Record a manual payment or adjustment</h3>
      <div className="revenue-form-grid">
        <label className="field"><span>Customer email</span><input className="control" type="email" value={form.customerEmail} onChange={event => setForm({ ...form, customerEmail: event.target.value })} /></label>
        <label className="field"><span>Customer name</span><input className="control" value={form.customerName} onChange={event => setForm({ ...form, customerName: event.target.value })} /></label>
        <label className="field"><span>Product</span><input className="control" value={form.product} onChange={event => setForm({ ...form, product: event.target.value })} /></label>
        <label className="field"><span>Tier</span><input className="control" value={form.tier} onChange={event => setForm({ ...form, tier: event.target.value })} /></label>
        <label className="field"><span>Currency</span><select className="control" value={form.currency} onChange={event => setForm({ ...form, currency: event.target.value })}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label>
        <label className="field"><span>Amount</span><input className="control" inputMode="decimal" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} placeholder="20.00" /></label>
        <label className="field"><span>Fees</span><input className="control" inputMode="decimal" value={form.fee} onChange={event => setForm({ ...form, fee: event.target.value })} placeholder="0.00" /></label>
        <label className="field"><span>Status</span><select className="control" value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="paid">Paid</option><option value="pending">Pending</option><option value="refunded">Refunded</option><option value="failed">Failed</option></select></label>
        <label className="field"><span>Paid date</span><input className="control" type="date" value={form.paidAt} onChange={event => setForm({ ...form, paidAt: event.target.value })} /></label>
      </div>
      <div className="button-row"><button className="button" disabled={busy || !form.amount.trim()} onClick={() => void addEvent()}><PlusCircle size={16} />{busy ? "Saving..." : "Save payment"}</button><button className="button secondary" disabled={busy} onClick={() => void refresh().catch(error => setMessage(error instanceof Error ? error.message : "Could not refresh."))}><RefreshCw size={16} />Refresh revenue</button></div>
    </section>
    <h3>Recent Stripe payments and owner entries</h3>
    <div className="revenue-list">
      {summary?.recent.length ? summary.recent.map(event => <div className="cloud-member" key={event.id}><span><strong>{formatMoney(event.currency, event.net)} · {event.product}</strong><small>{event.customerEmail || event.customerName || "No customer"} · {event.provider} · {event.status} · {new Date(event.paidAt).toLocaleDateString()}</small></span></div>) : <p className="quiet">No payment events have been recorded yet.</p>}
    </div>
    {message && <p role="status">{message}</p>}
  </section></div>;
}
function suggestedAccessCode(label: string, email: string) {
  const base = `${label || "special"}-${email.split("@")[0] || "guest"}`.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 34);
  const random = Math.random().toString(36).slice(2, 8);
  return `${base || "special-access"}-${random}`;
}
function OwnerAccessDialog({ onClose }: { onClose: () => void }) {
  const [summary, setSummary] = useState<OwnerAccessSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [form, setForm] = useState({ label: "Special access edition", recipientEmail: "", code: "", maxUses: "1", expiresAt: "", note: "" });
  async function refresh() {
    setMessage("");
    const data = await cloudRequest<OwnerAccessSummary>("/api/owner/access");
    setSummary(data);
  }
  useEffect(() => { void refresh().catch(error => setMessage(error instanceof Error ? error.message : "Could not load special access.")); }, []);
  async function createCode() {
    setBusy(true); setMessage(""); setCreatedCode("");
    try {
      const code = form.code.trim() || suggestedAccessCode(form.label, form.recipientEmail);
      const result = await cloudRequest<{ code: string }>("/api/owner/special-access-codes", "POST", { ...form, code, maxUses: Number(form.maxUses) || 1 });
      setCreatedCode(result.code);
      setForm(previous => ({ ...previous, code: "", recipientEmail: "", note: "" }));
      await refresh();
      setMessage("Special access code created. Give the code only to the person you choose.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create the code.");
    } finally { setBusy(false); }
  }
  async function revoke(hash: string) {
    setBusy(true); setMessage("");
    try {
      await cloudRequest(`/api/owner/special-access-codes/${hash}`, "DELETE", {});
      await refresh();
      setMessage("Special access code revoked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not revoke the code.");
    } finally { setBusy(false); }
  }
  async function copyCode() {
    if (!createdCode) return;
    try { await navigator.clipboard.writeText(createdCode); setMessage("Special access code copied."); }
    catch { setMessage(`Copy this special access code: ${createdCode}`); }
  }
  async function copyInviteMessage() {
    if (!createdCode) return;
    const appLink = `${window.location.origin}${window.location.pathname}`;
    const recipient = form.recipientEmail ? ` for ${form.recipientEmail}` : "";
    const text = [
      `You have Special Access to KinForge Genealogy Studio Supreme Suite${recipient}.`,
      "",
      `Special access code: ${createdCode}`,
      `Open KinForge: ${appLink}`,
      "",
      "Create or sign in to your KinForge account, open Accounts & sharing or Private Access, then redeem this code. Please keep the code private because it unlocks the Special Access edition for the intended account."
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Special access invite message copied for your friend.");
    } catch {
      setMessage(text);
    }
  }
  return <div className="cloud-scrim"><section className="cloud-dialog wide owner-access" role="dialog" aria-modal="true" aria-labelledby="owner-access-title">
    <button className="cloud-close" aria-label="Close special access" onClick={onClose}><X size={20} /></button>
    <h2 id="owner-access-title">Signups & special access</h2>
    <p className="quiet">Private owner view. This syncs with the same cloud account database used by the public beta page and special-access redemption flow, so the Special Access version can be managed from inside your owner app.</p>
    {summary?.setupRequired && <p className="auth-message bad" role="alert">The special-access table is not active on this deployment yet. Publish the latest build or run the database migration.</p>}
    <div className="revenue-metrics">
      <article><span>Accounts</span><strong>{summary?.accounts.length ?? "..."}</strong><small>All KinForge accounts in this cloud database</small></article>
      <article><span>Public signups</span><strong>{summary?.signups.length ?? "..."}</strong><small>KinForge accounts that registered beta interest</small></article>
      <article><span>Subscribers</span><strong>{summary?.subscribers.length ?? "..."}</strong><small>Accounts included in owner newsletter releases</small></article>
      <article><span>Access codes</span><strong>{summary?.codes.length ?? "..."}</strong><small>Manual owner-created special access codes</small></article>
      <article><span>Redeemed</span><strong>{summary ? summary.codes.filter(code => code.useCount > 0).length : "..."}</strong><small>Codes already used by signed-in accounts</small></article>
    </div>
    <section className="owner-special-sync" aria-labelledby="special-sync-title">
      <h3 id="special-sync-title"><ShieldCheck size={17} />Special Access project sync</h3>
      <p>The owner app is the control room for the Special Access version: create a code, optionally lock it to a friend's email, track whether it was redeemed, revoke access codes, and copy a ready-to-send invite message without exposing the owner dashboard to ordinary users.</p>
    </section>
    <section className="owner-revenue-entry" aria-labelledby="create-access-title">
      <h3 id="create-access-title"><KeyRound size={17} />Create special access code</h3>
      <div className="revenue-form-grid">
        <label className="field"><span>Label</span><input className="control" value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} /></label>
        <label className="field"><span>Recipient email</span><input className="control" type="email" value={form.recipientEmail} onChange={event => setForm({ ...form, recipientEmail: event.target.value })} placeholder="optional, locks code to this email" /></label>
        <label className="field"><span>Custom code</span><input className="control" value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} placeholder="optional" /></label>
        <label className="field"><span>Max uses</span><input className="control" inputMode="numeric" value={form.maxUses} onChange={event => setForm({ ...form, maxUses: event.target.value })} /></label>
        <label className="field"><span>Expires on</span><input className="control" type="date" value={form.expiresAt} onChange={event => setForm({ ...form, expiresAt: event.target.value })} /></label>
        <label className="field"><span>Owner note</span><input className="control" value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} /></label>
      </div>
      <div className="button-row"><button className="button" disabled={busy || !form.label.trim()} onClick={() => void createCode()}><PlusCircle size={16} />Create code</button>{createdCode && <button className="button secondary" onClick={() => void copyCode()}><Copy size={16} />Copy code</button>}{createdCode && <button className="button secondary" onClick={() => void copyInviteMessage()}><Send size={16} />Copy friend invite</button>}<button className="button secondary" disabled={busy} onClick={() => void refresh().catch(error => setMessage(error instanceof Error ? error.message : "Could not refresh."))}><RefreshCw size={16} />Refresh</button></div>
      {createdCode && <p className="invitation-code"><code>{createdCode}</code><span>Give this to the person you choose. If you entered a recipient email, only that email can redeem it.</span></p>}
    </section>
    <section className="owner-access-columns">
      <div>
        <h3><UsersRound size={17} />Accounts</h3>
        <div className="revenue-list owner-access-list">{summary?.accounts.length ? summary.accounts.map(account => <div className="cloud-member" key={account.id}><span><strong>{account.name || account.email}</strong><small>{account.email} · joined {new Date(account.createdAt).toLocaleString()}</small></span></div>) : <p className="quiet">No accounts have signed up yet.</p>}</div>
      </div>
      <div>
        <h3><Mail size={17} />Newsletter subscribers</h3>
        <div className="revenue-list owner-access-list">{summary?.subscribers.length ? summary.subscribers.map(subscriber => <div className="cloud-member" key={subscriber.accountId}><span><strong>{subscriber.name || subscriber.email}</strong><small>{subscriber.email} · {subscriber.source} · {subscriber.status}</small></span></div>) : <p className="quiet">No newsletter subscribers yet.</p>}</div>
      </div>
      <div>
        <h3><UsersRound size={17} />Public signups</h3>
        <div className="revenue-list owner-access-list">{summary?.signups.length ? summary.signups.map(signup => <div className="cloud-member" key={signup.accountId}><span><strong>{signup.name || signup.email}</strong><small>{signup.email} · {signup.plan} · {new Date(signup.updatedAt).toLocaleString()}</small></span></div>) : <p className="quiet">No public beta signups yet.</p>}</div>
      </div>
      <div>
        <h3><ShieldCheck size={17} />Special access codes</h3>
        <div className="revenue-list owner-access-list">{summary?.codes.length ? summary.codes.map(code => <div className="cloud-member" key={code.hash}><span><strong>{code.label}{code.revokedAt ? " · revoked" : ""}</strong><small>{code.recipientEmail || "Any signed-in account"} · {code.useCount}/{code.maxUses} used{code.lastRedeemedByEmail ? ` · last ${code.lastRedeemedByEmail}` : ""}</small></span>{!code.revokedAt && <button className="button ghost" disabled={busy} onClick={() => void revoke(code.hash)}>Revoke</button>}</div>) : <p className="quiet">No special access codes yet.</p>}</div>
      </div>
    </section>
    {message && <p role="status">{message}</p>}
  </section></div>;
}

function fileToDataUrl(file: File) {
  return new Promise<{ name: string; mime: string; dataUrl: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve({ name: file.name, mime: file.type || "application/octet-stream", dataUrl: String(reader.result || "") });
    reader.readAsDataURL(file);
  });
}
function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size, index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
function OwnerNewsletterDialog({ onClose }: { onClose: () => void }) {
  const [summary, setSummary] = useState<OwnerNewsletterSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; mime: string; dataUrl: string }[]>([]);
  const [form, setForm] = useState({
    title: "KinForge Studio Update",
    subject: "KinForge Genealogy Studio Supreme Suite update",
    summary: "",
    content: ""
  });
  async function refresh() {
    setMessage("");
    const data = await cloudRequest<OwnerNewsletterSummary>("/api/owner/newsletters");
    setSummary(data);
  }
  useEffect(() => { void refresh().catch(error => setMessage(error instanceof Error ? error.message : "Could not load newsletters.")); }, []);
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMessage("");
    try {
      const next = await Promise.all(Array.from(files).map(fileToDataUrl));
      setAttachments(previous => [...previous, ...next]);
      setMessage(`${next.length} file${next.length === 1 ? "" : "s"} attached to this release.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not attach those files.");
    } finally { setBusy(false); }
  }
  async function release() {
    setBusy(true); setMessage("");
    try {
      const result = await cloudRequest<{ deliveryStatus: string; recipientCount: number; attachmentCount: number }>("/api/owner/newsletters", "POST", { ...form, attachments });
      setForm(previous => ({ ...previous, summary: "", content: "" }));
      setAttachments([]);
      await refresh();
      const delivered = result.deliveryStatus === "sent" || result.deliveryStatus === "sent-to-kinforge-support" || result.deliveryStatus === "sent-to-serene-relay";
      setMessage(delivered
        ? `Newsletter released to ${result.recipientCount} subscriber${result.recipientCount === 1 ? "" : "s"} with ${result.attachmentCount} attachment${result.attachmentCount === 1 ? "" : "s"}.`
        : `Newsletter published for ${result.recipientCount} subscriber${result.recipientCount === 1 ? "" : "s"}. Email delivery needs a newsletter endpoint before it can send automatically.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not release this newsletter.");
    } finally { setBusy(false); }
  }
  return <div className="cloud-scrim"><section className="cloud-dialog wide owner-access" role="dialog" aria-modal="true" aria-labelledby="owner-newsletters-title">
    <button className="cloud-close" aria-label="Close newsletters" onClick={onClose}><X size={20} /></button>
    <h2 id="owner-newsletters-title">Owner newsletters</h2>
    <p className="quiet">Create and release newsletters to signed-up KinForge accounts and subscribers. Attachments are stored in KinForge cloud storage with the release record.</p>
    {summary?.setupRequired && <p className="auth-message bad" role="alert">The newsletter tables are not active on this deployment yet. Publish the latest cloud build or run the new database migration.</p>}
    <div className="revenue-metrics">
      <article><span>Subscribers</span><strong>{summary?.subscribers.length ?? "..."}</strong><small>Signed-up accounts included in releases</small></article>
      <article><span>Released newsletters</span><strong>{summary?.releases.length ?? "..."}</strong><small>Stored in the owner newsletter archive</small></article>
      <article><span>Latest delivery</span><strong>{summary?.releases[0]?.deliveryStatus || "..."}</strong><small>Uses the configured KinForge newsletter email endpoint</small></article>
    </div>
    <section className="owner-revenue-entry" aria-labelledby="newsletter-composer-title">
      <h3 id="newsletter-composer-title"><Mail size={17} />Release newsletter</h3>
      <div className="revenue-form-grid">
        <label className="field"><span>Title</span><input className="control" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
        <label className="field"><span>Email subject</span><input className="control" value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} /></label>
        <label className="field"><span>Short summary</span><input className="control" value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })} /></label>
        <label className="field"><span>Attachments</span><input className="control" type="file" multiple onChange={event => void addFiles(event.target.files)} /></label>
      </div>
      <label className="field"><span>Newsletter body</span><textarea className="control" rows={10} value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} placeholder="Write the newsletter, update notes, release announcement, download links, or customer message here." /></label>
      {!!attachments.length && <div className="revenue-list owner-access-list">{attachments.map((file, index) => <div className="cloud-member" key={`${file.name}-${index}`}><span><strong><FileText size={15} /> {file.name}</strong><small>{file.mime} · {formatBytes(file.dataUrl.length)}</small></span><button className="button ghost" disabled={busy} onClick={() => setAttachments(previous => previous.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div>}
      <div className="button-row"><button className="button" disabled={busy || !form.title.trim() || !form.subject.trim() || !form.content.trim()} onClick={() => void release()}><Send size={16} />{busy ? "Releasing..." : "Release to subscribers"}</button><button className="button secondary" disabled={busy} onClick={() => void refresh().catch(error => setMessage(error instanceof Error ? error.message : "Could not refresh."))}><RefreshCw size={16} />Refresh</button></div>
    </section>
    <section className="owner-access-columns">
      <div>
        <h3><Mail size={17} />Subscribers</h3>
        <div className="revenue-list owner-access-list">{summary?.subscribers.length ? summary.subscribers.map(subscriber => <div className="cloud-member" key={subscriber.accountId}><span><strong>{subscriber.name || subscriber.email}</strong><small>{subscriber.email} · {subscriber.source} · {subscriber.status}</small></span></div>) : <p className="quiet">No subscribers yet.</p>}</div>
      </div>
      <div>
        <h3><FileText size={17} />Released archive</h3>
        <div className="revenue-list owner-access-list">{summary?.releases.length ? summary.releases.map(release => <div className="cloud-member" key={release.id}><span><strong>{release.title}</strong><small>{release.recipientCount} recipients · {release.attachmentCount} attachments · {formatBytes(release.size)} · {release.deliveryStatus}</small></span></div>) : <p className="quiet">No newsletters have been released yet.</p>}</div>
      </div>
    </section>
    {message && <p role="status">{message}</p>}
  </section></div>;
}

function OwnerSupportDialog({ onClose }: { onClose: () => void }) {
  const [summary, setSummary] = useState<OwnerSupportSummary | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [filter, setFilter] = useState("active");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh(keepSelected = true) {
    setMessage("");
    const data = await cloudRequest<OwnerSupportSummary>("/api/owner/support");
    setSummary(data);
    if (!keepSelected || !data.tickets.some(ticket => ticket.id === selectedId)) setSelectedId(data.tickets[0]?.id || "");
  }
  useEffect(() => { void refresh(false).catch(error => setMessage(error instanceof Error ? error.message : "Could not load support tickets.")); }, []);
  const filtered = (summary?.tickets || []).filter(ticket => filter === "all" ? true : filter === "active" ? !["resolved", "closed"].includes(ticket.status) : ticket.status === filter);
  const selected = (summary?.tickets || []).find(ticket => ticket.id === selectedId) || filtered[0] || null;
  const replies = (summary?.replies || []).filter(item => item.ticketId === selected?.id).sort((a, b) => a.createdAt - b.createdAt);
  const counts = Object.fromEntries((summary?.counts || []).map(row => [row.status, row.count]));
  async function updateTicket(ticketId: string, updates: { status?: string; priority?: string }) {
    setBusy(true); setMessage("");
    try {
      await cloudRequest(`/api/owner/support/${ticketId}`, "POST", updates);
      await refresh();
      setMessage(updates.status ? `Ticket marked ${updates.status}.` : "Ticket priority updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update this ticket.");
    } finally { setBusy(false); }
  }
  async function sendReply() {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const result = await cloudRequest<{ deliveryStatus: string }>(`/api/owner/support/${selected.id}/replies`, "POST", { message: reply });
      setReply("");
      await refresh();
      setMessage(result.deliveryStatus === "sent-to-kinforge-support" || result.deliveryStatus === "sent-to-serene-relay"
        ? "Reply saved and sent through KinForge Support."
        : result.deliveryStatus === "stored-only"
          ? "Reply saved. Email delivery is unavailable or the customer did not allow replies."
          : "Reply saved, but email delivery reported a problem.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send this reply.");
    } finally { setBusy(false); }
  }
  return <div className="cloud-scrim"><section className="cloud-dialog wide owner-support" role="dialog" aria-modal="true" aria-labelledby="owner-support-title">
    <button className="cloud-close" aria-label="Close support tickets" onClick={onClose}><X size={20} /></button>
    <h2 id="owner-support-title">Owner support tickets</h2>
    <p className="quiet">Private owner helpdesk. Public support, Stripe quote requests, discount requests, subsidised pricing requests, accessibility-discount requests and KinForge Support enquiries are saved here, can be answered from KinForge, and can be opened, prioritised, resolved or closed.</p>
    {summary?.setupRequired && <p className="auth-message bad" role="alert">The support ticket tables are not active on this deployment yet. Publish the latest cloud build or run the new database migration.</p>}
    <div className="revenue-metrics">
      <article><span>Open</span><strong>{counts.open || 0}</strong><small>New tickets needing action</small></article>
      <article><span>In progress</span><strong>{counts["in-progress"] || 0}</strong><small>Owner is working on these</small></article>
      <article><span>Waiting customer</span><strong>{counts["waiting-customer"] || 0}</strong><small>Replies have been sent</small></article>
      <article><span>Closed</span><strong>{(counts.resolved || 0) + (counts.closed || 0)}</strong><small>Resolved or closed tickets</small></article>
    </div>
    <div className="button-row owner-support-filters">
      <label className="field inline"><span>Show</span><select className="control" value={filter} onChange={event => setFilter(event.target.value)}><option value="active">Active tickets</option><option value="all">All tickets</option>{ticketStatuses.map(status => <option value={status} key={status}>{status}</option>)}</select></label>
      <button className="button secondary" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16} />Refresh tickets</button>
    </div>
    <section className="owner-support-layout">
      <div className="owner-ticket-list" aria-label="Support tickets">
        {filtered.length ? filtered.map(ticket => <button key={ticket.id} className={`owner-ticket-row ${selected?.id === ticket.id ? "selected" : ""}`} onClick={() => setSelectedId(ticket.id)}>
          <strong>{ticket.subject}</strong>
          <span>{ticket.email || "No email"} · {ticket.status} · {ticket.priority}</span>
          <small>{new Date(ticket.updatedAt).toLocaleString()}</small>
        </button>) : <p className="quiet">No tickets match this filter.</p>}
      </div>
      <div className="owner-ticket-detail">
        {selected ? <>
          <div className="owner-ticket-heading">
            <div><h3>{selected.subject}</h3><p className="quiet">{selected.type} · from {selected.name || "Unknown"} {selected.email ? `<${selected.email}>` : ""}</p></div>
            <span className={`ticket-status ${selected.status}`}>{selected.status}</span>
          </div>
          <div className="button-row">
            <label className="field inline"><span>Status</span><select className="control" value={selected.status} disabled={busy} onChange={event => void updateTicket(selected.id, { status: event.target.value })}>{ticketStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
            <label className="field inline"><span>Priority</span><select className="control" value={selected.priority} disabled={busy} onChange={event => void updateTicket(selected.id, { priority: event.target.value })}>{ticketPriorities.map(priority => <option key={priority}>{priority}</option>)}</select></label>
            <button className="button secondary" disabled={busy} onClick={() => void updateTicket(selected.id, { status: "open" })}>Reopen</button>
            <button className="button secondary" disabled={busy} onClick={() => void updateTicket(selected.id, { status: "resolved" })}>Resolve</button>
            <button className="button secondary" disabled={busy} onClick={() => void updateTicket(selected.id, { status: "closed" })}>Close</button>
          </div>
          <article className="support-message">
            <strong>Customer message</strong>
            <p>{selected.message}</p>
            <small>Permission to reply: {selected.permissionToReply ? "yes" : "no"} · delivery: {selected.deliveryStatus} · created {new Date(selected.createdAt).toLocaleString()}</small>
            {(selected.device || selected.treeTitle || selected.proof || selected.diagnostics) && <details><summary>Details and diagnostics</summary><dl><dt>Device/app</dt><dd>{selected.device || "Not provided"}</dd><dt>Tree</dt><dd>{selected.treeTitle || "Not provided"}</dd><dt>Proof</dt><dd>{selected.proof || "Not provided"}</dd><dt>Diagnostics</dt><dd><pre>{selected.diagnostics || "Not included"}</pre></dd></dl></details>}
          </article>
          <div className="support-thread">
            <h3>Replies</h3>
            {replies.length ? replies.map(item => <article className="support-reply" key={item.id}><strong>{item.authorEmail}</strong><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()} · {item.deliveryStatus}</small></article>) : <p className="quiet">No replies yet.</p>}
          </div>
          <label className="field"><span>Reply to customer</span><textarea className="control" rows={7} value={reply} onChange={event => setReply(event.target.value)} placeholder={selected.permissionToReply ? "Write a reply that will be stored and sent through the configured email route." : "This customer did not allow replies; your note will be stored only."} /></label>
          <div className="button-row"><button className="button" disabled={busy || !reply.trim()} onClick={() => void sendReply()}><Send size={16} />{busy ? "Sending..." : "Save and send reply"}</button></div>
        </> : <p className="quiet">Choose a ticket to review.</p>}
      </div>
    </section>
    {message && <p role="status">{message}</p>}
  </section></div>;
}

const websiteEditions = [
  { id: "public", label: "Public site", url: "https://kinforge-genealogy-studio-public.marianneleong3.chatgpt.site/website/", note: "Customer-facing landing page, downloads, pricing, About Us, support, releases and free-account entry." },
  { id: "special", label: "Special Access site", url: "https://kinforge-genealogy-special-access-edition.marianneleong3.chatgpt.site/", note: "Code-protected edition with its own downloads and approved Special Access account flow." },
  { id: "owner", label: "Owner site", url: "https://kinforge-genealogy-studio.marianneleong3.chatgpt.site/", note: "Private owner version for payments, accounts, newsletters, support tickets and app release control." }
];
const websitePages = ["Landing page", "Downloads", "About Us", "Founding Story", "Mission", "Vision", "Values", "Plans & pricing", "Discount roles", "Support", "Privacy Policy", "Terms & Conditions", "Releases", "Special Access gate"];
const websiteUpdateTypes = ["Text/copy update", "Pricing or discount update", "Download/package update", "Legal policy update", "Design/layout update", "Chart/infographic update", "Feature announcement", "Bug fix"];
function OwnerWebsiteControlDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ edition: "public", page: "Landing page", type: "Text/copy update", title: "", message: "", releaseVersion: "1.5.0", publishNote: "" });
  const [message, setMessage] = useState("");
  const edition = websiteEditions.find(item => item.id === form.edition) || websiteEditions[0];
  const brief = [
    "KinForge owner website update brief",
    `Created: ${new Date().toLocaleString()}`,
    `Edition: ${edition.label}`,
    `Page: ${form.page}`,
    `Update type: ${form.type}`,
    `Release version: ${form.releaseVersion || "Not specified"}`,
    "",
    `Title: ${form.title || "Untitled website update"}`,
    "",
    "Requested change:",
    form.message || "No detailed change has been written yet.",
    "",
    "Publish note:",
    form.publishNote || "No publish note entered.",
    "",
    "Live link:",
    edition.url,
    "",
    "Owner checklist:",
    "- Keep the public homepage dynamic, not a sign-in page.",
    "- Keep About Us submenu pages connected: About Us, Founding Story, Mission, Vision and Values.",
    "- Keep Privacy Policy and Terms & Conditions visible in the navigation.",
    "- Keep public, paid/free, beta, owner and Special Access editions aligned while preserving the Special Access code gate.",
    "- Put new app packages on the downloads/updates page before publishing the release."
  ].join("\n");
  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(brief);
      setMessage("Website update brief copied.");
    } catch {
      setMessage("Copy is unavailable. Use Download brief instead.");
    }
  }
  async function downloadBrief() {
    try {
      const { downloadBlob } = await import("./exporters");
      const name = `KinForge-website-update-${form.edition}-${Date.now()}.txt`;
      await downloadBlob(name, brief, "text/plain;charset=utf-8", undefined, { localOnly: true });
      setMessage("Website update brief downloaded.");
    } catch {
      setMessage("The brief could not be downloaded. You can still copy it.");
    }
  }
  return <div className="cloud-scrim"><section className="cloud-dialog wide owner-access owner-website" role="dialog" aria-modal="true" aria-labelledby="owner-websites-title">
    <button className="cloud-close" aria-label="Close website control center" onClick={onClose}><X size={20} /></button>
    <h2 id="owner-websites-title">Owner website control center</h2>
    <p className="quiet">Private owner workspace for reviewing, drafting and preparing changes across the public, owner and Special Access KinForge sites. Ordinary public, paid, free, beta and Special Access accounts cannot open this area.</p>
    <div className="revenue-metrics">
      {websiteEditions.map(item => <article key={item.id}>
        <span>{item.label}</span><strong>{item.id === "special" ? "Code gated" : item.id === "owner" ? "Owner only" : "Public"}</strong><small>{item.note}</small>
      </article>)}
    </div>
    <section className="owner-revenue-entry" aria-labelledby="website-quick-links-title">
      <h3 id="website-quick-links-title"><Globe2 size={17} />Live website links</h3>
      <div className="owner-website-links">
        {websiteEditions.map(item => <a className="button secondary" key={item.id} href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open {item.label}</a>)}
      </div>
    </section>
    <section className="owner-revenue-entry" aria-labelledby="website-update-title">
      <h3 id="website-update-title"><FileText size={17} />Draft a website update</h3>
      <div className="revenue-form-grid">
        <label className="field"><span>Edition</span><select className="control" value={form.edition} onChange={event => setForm({ ...form, edition: event.target.value })}>{websiteEditions.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <label className="field"><span>Page</span><select className="control" value={form.page} onChange={event => setForm({ ...form, page: event.target.value })}>{websitePages.map(page => <option key={page}>{page}</option>)}</select></label>
        <label className="field"><span>Change type</span><select className="control" value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>{websiteUpdateTypes.map(type => <option key={type}>{type}</option>)}</select></label>
        <label className="field"><span>Release version</span><input className="control" value={form.releaseVersion} onChange={event => setForm({ ...form, releaseVersion: event.target.value })} /></label>
      </div>
      <label className="field"><span>Update title</span><input className="control" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Example: Refresh public landing page downloads and Special Access prompt" /></label>
      <label className="field"><span>What should change?</span><textarea className="control" rows={7} value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} placeholder="Write the website change, new wording, download replacement, pricing detail, legal wording, chart update, or page behavior here." /></label>
      <label className="field"><span>Publish note</span><textarea className="control" rows={4} value={form.publishNote} onChange={event => setForm({ ...form, publishNote: event.target.value })} placeholder="What should be checked after publishing? Example: public home should not flash sign-in, Special Access must ask for code first." /></label>
      <div className="button-row"><button className="button" onClick={() => void copyBrief()}><Copy size={16} />Copy update brief</button><button className="button secondary" onClick={() => void downloadBrief()}><Download size={16} />Download brief</button><a className="button secondary" href={edition.url} target="_blank" rel="noreferrer"><ExternalLink size={16} />Review selected site</a></div>
    </section>
    <section className="owner-special-sync" aria-labelledby="website-sync-title">
      <h3 id="website-sync-title"><ShieldCheck size={17} />Dynamic-site rules</h3>
      <p>KinForge websites should stay dynamic: public pages open to downloads and product information, sign-in appears only after the user chooses an account action, Special Access opens with the access-code gate, and the owner site keeps payments, support, account access, newsletters and website update work private.</p>
    </section>
    {message && <p role="status">{message}</p>}
  </section></div>;
}

function LegalAgreementBox({ privacyAccepted, termsAccepted, onPrivacyAccepted, onTermsAccepted }: { privacyAccepted: boolean; termsAccepted: boolean; onPrivacyAccepted: (accepted: boolean) => void; onTermsAccepted: (accepted: boolean) => void }) {
  return <section className="legal-agreement" aria-labelledby="cloud-legal-agreement-title">
    <h2 id="cloud-legal-agreement-title">Privacy Policy and Terms & Conditions</h2>
    <p className="quiet">Effective {LEGAL_EFFECTIVE_DATE}. These rules apply before using the app, creating an account, signing in, recovering an account, checking updates, trying the separate demo, exporting, or downloading files.</p>
    <details open>
      <summary>Privacy Policy</summary>
      {PRIVACY_POLICY_SECTIONS.map(section => <article key={section.title}><h3>{section.title}</h3><p>{section.body}</p></article>)}
    </details>
    <details open>
      <summary>Terms & Conditions</summary>
      {TERMS_CONDITIONS_SECTIONS.map(section => <article key={section.title}><h3>{section.title}</h3><p>{section.body}</p></article>)}
    </details>
    <div className="legal-checks">
      <label className="check-row"><input type="checkbox" checked={privacyAccepted} onChange={event => onPrivacyAccepted(event.target.checked)} />I accept and agree to follow the KinForge Privacy Policy.</label>
      <label className="check-row"><input type="checkbox" checked={termsAccepted} onChange={event => onTermsAccepted(event.target.checked)} />I accept and agree to follow the KinForge Terms & Conditions, including the export and download copyright rules.</label>
    </div>
  </section>;
}

function CloudSignIn({ error: initialError, onSignedIn, onDemo }: { error: string; onSignedIn: (user: CloudUser, code?: string) => void; onDemo: () => void }) {
  const [mode, setMode] = useState<"login" | "create" | "forgot">("login"); const [error, setError] = useState(""); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const [recoveryMethod, setRecoveryMethod] = useState<"secret" | "reset-code" | "login-code" | "login-link">("secret"); const [codeRequested, setCodeRequested] = useState(false); const [updatesOpen, setUpdatesOpen] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [recoveryCode, setRecoveryCode] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const linkAttempted = useRef(false);
  const requireAgreement = () => {
    if (privacyAccepted && termsAccepted) return true;
    setError("Click both I accept checkboxes to follow the KinForge Privacy Policy and Terms & Conditions before using the app.");
    return false;
  };
  useEffect(() => { setCodeRequested(false); setRecoveryCode(""); setStatus(""); }, [mode, recoveryMethod, email]);
  useEffect(() => {
    if (linkAttempted.current || !window.location.hash.startsWith("#/email-login")) return;
    const query = new URLSearchParams(window.location.hash.includes("?") ? window.location.hash.slice(window.location.hash.indexOf("?") + 1) : "");
    const linkEmail = query.get("email") || "", linkCode = query.get("code") || "";
    if (!linkEmail || !linkCode) return;
    linkAttempted.current = true; setMode("forgot"); setRecoveryMethod("login-code"); setCodeRequested(true); setEmail(linkEmail); setRecoveryCode(linkCode); setStatus("Click both I accept checkboxes, then sign in with the code from your email link.");
  }, [onSignedIn]);
  const showPassword = mode !== "forgot" || recoveryMethod === "secret" || (recoveryMethod === "reset-code" && codeRequested);
  const showRecoveryCode = mode === "forgot" && (recoveryMethod === "secret" || (codeRequested && recoveryMethod !== "login-link"));
  const actionText = mode === "create" ? "Create account" : mode === "login" ? "Sign in" : recoveryMethod === "secret" ? "Reset password" : !codeRequested ? recoveryMethod === "login-link" ? "Send login link" : "Send code" : recoveryMethod === "login-code" ? "Sign in with code" : recoveryMethod === "login-link" ? "Send another link" : "Reset password";
  return <div className="auth-shell"><form className="auth-panel" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(""); setStatus("");
    try {
      let result: { user: CloudUser; recoveryCode?: string };
      if (!privacyAccepted || !termsAccepted) throw new Error("Click both I accept checkboxes to follow the KinForge Privacy Policy and Terms & Conditions before using the app.");
      if (mode === "forgot" && recoveryMethod !== "secret") {
        const purpose = recoveryMethod === "login-code" || recoveryMethod === "login-link" ? "login" : "reset";
        if (!codeRequested) {
          const sent = await cloudRequest<{ message: string }>("/api/auth/code/request", "POST", { email, purpose, delivery: recoveryMethod === "login-link" ? "link" : "code" });
          setCodeRequested(true); setStatus(sent.message || "If that account exists, KinForge sent a short-lived code to its email address."); return;
        }
        if (recoveryMethod === "login-link") {
          const sent = await cloudRequest<{ message: string }>("/api/auth/code/request", "POST", { email, purpose, delivery: "link" });
          setStatus(sent.message || "If that account exists, KinForge sent a short-lived secret login link to its email address."); return;
        }
        result = await cloudRequest("/api/auth/code/confirm", "POST", { email, purpose, code: recoveryCode, password });
        onSignedIn(result.user, result.recoveryCode); return;
      }
      try { result = await cloudRequest(`/api/auth/${mode === "create" ? "register" : mode === "forgot" ? "recover" : "login"}`, "POST", { name, email, password, recoveryCode, privacyAccepted, termsAccepted }); }
      catch (error) {
        const local = legacyLogin(loadAuthState(), email, password);
        if (mode !== "login" || !(error instanceof CloudError) || error.status !== 401 || local.error) throw error;
        if (password.length < 12) throw new Error("Your existing account is stored on this device. Create its cloud account with the same email and a password of at least 12 characters. Your data will sync automatically.");
        result = await cloudRequest("/api/auth/register", "POST", { email, password, name: legacyUser(local.state)?.name || name, privacyAccepted, termsAccepted });
      }
      recordAppLegalAgreement();
      recordPublicExportAgreement();
      onSignedIn(result.user, result.recoveryCode);
    }
    catch (e) { setError(e instanceof Error ? e.message : "Could not connect. Please retry."); } finally { setBusy(false); }
  }}><div className="brand auth-brand"><span className="brand-mark"><img src="./icon.svg" alt="" /></span><div><strong>KinForge</strong><small>Product of Dreams of Serene Landscapes</small></div></div><h1>{mode === "create" ? "Create your cloud account" : mode === "forgot" ? "Recover your account" : "Sign in to KinForge"}</h1><p className="quiet">Relationship maps, family trees, social-work genograms, character networks, history projects and RPG worlds on every device.</p>
    {mode === "create" && <label className="field"><span>Name</span><input className="control" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required maxLength={100} /></label>}
    <label className="field"><span>Email</span><input className="control" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></label>
    {mode === "forgot" && <label className="field"><span>Recovery option</span><select className="control" value={recoveryMethod} onChange={e => setRecoveryMethod(e.target.value as "secret" | "reset-code" | "login-code" | "login-link")}><option value="secret">Secret recovery key</option><option value="reset-code">Email password reset code</option><option value="login-code">Email code login</option><option value="login-link">Email secret login link</option></select></label>}
    {showRecoveryCode && <label className="field"><span>{recoveryMethod === "secret" ? "Secret recovery key" : "Email code"}</span><input className="control" value={recoveryCode} onChange={e => setRecoveryCode(e.target.value)} autoComplete="one-time-code" required /></label>}
    {showPassword && <label className="field"><span>{mode === "forgot" ? "New password" : "Password"}</span><input className="control" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 12} maxLength={256} /></label>}
    {showPassword && mode !== "login" && <p className="quiet">Use at least 12 characters.</p>}
    {(error || initialError) && <p className="auth-message bad" role="alert">{error || initialError}</p>}
    {status && <p className="auth-message" role="status">{status}</p>}
    <button className="button" type="submit" disabled={busy}><LogIn size={16} />{busy ? "Connecting..." : actionText}</button>
    <div className="auth-links"><button type="button" onClick={() => { setMode("login"); setError(""); }}>Login</button><button type="button" onClick={() => { setMode("create"); setError(""); }}>Create account</button><button type="button" onClick={() => { setMode("forgot"); setError(""); }}>Forgot password</button><button type="button" onClick={() => { if (requireAgreement()) setUpdatesOpen(true); }}>Updates</button><button type="button" aria-label="Continue as guest" onClick={() => { if (!requireAgreement()) return; recordAppLegalAgreement(); recordPublicExportAgreement(); onDemo(); }}>Try a separate demo</button></div>
    <LegalAgreementBox privacyAccepted={privacyAccepted} termsAccepted={termsAccepted} onPrivacyAccepted={setPrivacyAccepted} onTermsAccepted={setTermsAccepted} />
    {mode === "create" && <p className="quiet">Existing work on this device will sync automatically to this account.</p>}
  </form>{updatesOpen && <UpdateCenter onClose={() => setUpdatesOpen(false)} />}</div>;
}
function SharingDialog({ user, libraries, selected, onClose, onSelect, onJoined }: { user: CloudUser; libraries: CloudLibrary[]; selected: CloudLibrary; onClose: () => void; onSelect: (id: string) => void; onJoined: (id: string) => Promise<void> }) {
  const [role, setRole] = useState("viewer"); const [code, setCode] = useState(""); const [join, setJoin] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<{ user_id: string; name: string; email: string; role: string }[]>([]);
  const [invites, setInvites] = useState<{ hash: string; role: string; expires_at: number }[]>([]);
  async function refresh() { if (selected.role === "owner") { const data = await cloudRequest(`/api/libraries/${selected.id}/sharing`); setMembers(data.members); setInvites(data.invitations); } }
  useEffect(() => { void refresh().catch(e => setMessage(e.message)); }, [selected.id]);
  async function act(work: () => Promise<void>) { setBusy(true); setMessage(""); try { await work(); } catch (e) { setMessage(e instanceof Error ? e.message : "Please retry."); } finally { setBusy(false); } }
  return <div className="cloud-scrim"><section className="cloud-dialog" role="dialog" aria-modal="true" aria-labelledby="sharing-title"><button className="cloud-close" aria-label="Close sharing" onClick={onClose}><X size={20} /></button><h2 id="sharing-title">Account & sharing</h2><p><strong>{user.name}</strong><br />{user.email}</p><label className="field"><span>Cloud library</span><select className="control" value={selected.id} onChange={e => onSelect(e.target.value)}>{libraries.map(l => <option key={l.id} value={l.id}>{l.name} - {l.owner_email} ({l.role})</option>)}</select></label>
    {selected.role === "owner" && <><h3>Share this library</h3><p className="quiet">Invited accounts can access this library's trees, books and collections. Sensitive details, files and reports marked private remain owner-only. Shared details require a signed-in invited account; guest visitors have no access. Removing access cannot erase files already downloaded. Give the invitation code only to the person you choose.</p><label className="field"><span>Permission</span><select className="control" value={role} onChange={e => setRole(e.target.value)}><option value="viewer">Can view</option><option value="editor">Can edit</option></select></label><button className="button" disabled={busy} onClick={() => void act(async () => { const result = await cloudRequest(`/api/libraries/${selected.id}/sharing`, "POST", { role }); setCode(result.code); await refresh(); })}><Share2 size={16} />Create invitation</button>{code && <div className="invitation-code"><code>{code}</code><button title="Copy invitation code" aria-label="Copy invitation code" onClick={() => void act(async () => { await navigator.clipboard.writeText(code); setMessage("Invitation copied. It can be used once within seven days."); })}><Copy size={16} /></button></div>}<h3>People with access</h3>{members.map(member => <div className="cloud-member" key={member.user_id}><span>{member.email}<small>{member.role}</small></span>{member.role !== "owner" && <button className="button ghost" disabled={busy} onClick={() => void act(async () => { await cloudRequest(`/api/libraries/${selected.id}/members/${member.user_id}`, "DELETE"); await refresh(); })}>Remove access</button>}</div>)}{invites.map(invite => <div className="cloud-member" key={invite.hash}><span>Unused {invite.role} invitation<small>Expires {new Date(invite.expires_at).toLocaleDateString()}</small></span><button disabled={busy} onClick={() => void act(async () => { await cloudRequest(`/api/libraries/${selected.id}/invitations/${invite.hash}`, "DELETE"); setCode(""); await refresh(); })}>Revoke</button></div>)}</>}
    <h3>Open a shared library</h3><label className="field"><span>Invitation code</span><input className="control" value={join} onChange={e => setJoin(e.target.value)} autoComplete="off" /></label><button className="button secondary" disabled={busy || !join.trim()} onClick={() => void act(async () => { const result = await cloudRequest("/api/invitations/accept", "POST", { code: join.trim() }); await onJoined(result.libraryId); })}>Accept invitation</button>{message && <p role="status">{message}</p>}
  </section></div>;
}
