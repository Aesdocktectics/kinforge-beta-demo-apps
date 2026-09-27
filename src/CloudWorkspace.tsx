import { lazy, useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, RefreshCw, Share2, X, Copy, Download, LogIn, BadgeDollarSign, PlusCircle } from "lucide-react";
import { AppState, createSeedState } from "./domain";
import { hydrateLibrary } from "./libraryState";
import { CloudError, CloudLibrary, CloudUser, clearAssetCache, cloudRequest } from "./cloudApi";
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
  const [exportMessage, setExportMessage] = useState("");
  const [choices, setChoices] = useState<ConflictChoices>({});
  const sync = useRef<CloudSync | null>(null);
  const [retry, setRetry] = useState(0);
  const library = libraries.find(item => item.id === libraryId);
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
      await sync.current?.stop(); sync.current = null; clearAssetCache(); clearCloudStartup(); setUser(null); setView(null); setViewLibraryId(""); setRecovery(""); setSharing(false); setRevenueOpen(false); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Reconnect before signing out."); }
  }
  if (demo) return <App cloud={{ state: demo, account: { id: "demo", name: "Guest demo", email: "" }, onChange: state => { setDemo(state); localStorage.setItem("kinforge-demo-v1", JSON.stringify(state)); }, onSave: state => { setDemo(state); localStorage.setItem("kinforge-demo-v1", JSON.stringify(state)); }, toolbar: <span className="cloud-status">Demo - saved on this device</span>, onSignOut: () => { setDemo(null); sessionStorage.removeItem("kinforge-demo-session"); }, readOnly: false, saved: true, demo: true, canManagePrivacy: true }} />;
  if (checking) return <div className="cloud-loading" role="status">Connecting to your KinForge account...</div>;
  if (!user) return <CloudSignIn error={error} onSignedIn={(account, code) => { setUser(account); setRecovery(code || ""); setError(""); }} onDemo={() => { const state = demoState(); localStorage.setItem("kinforge-demo-v1", JSON.stringify(state)); setDemo(state); sessionStorage.setItem("kinforge-demo-session", "true"); setError(""); }} />;
  const toolbar = <div className="cloud-toolbar"><button className={`cloud-status ${view?.error ? "cloud-warning" : ""}`} onClick={() => void sync.current?.sync()} title={view?.lastSaved ? `Last saved ${new Date(view.lastSaved).toLocaleString()}` : "Sync now"} aria-label={`Cloud sync: ${view?.status || "Connecting"}`}>
    {view?.error ? <CloudOff size={17} /> : <Cloud size={17} />}<span>{view?.status || "Connecting"}</span></button>{library?.role === "owner" && <button className="button secondary" onClick={() => setDrivesOpen(true)}><Cloud size={16} />Cloud drives</button>}{user.ownerDashboard && <button className="button secondary" onClick={() => setRevenueOpen(true)}><BadgeDollarSign size={16} />Owner revenue</button>}<button className="button secondary" onClick={() => setUpdatesOpen(true)}><RefreshCw size={16} />Updates</button><button className="button secondary" onClick={() => setSharing(true)} title="Account, libraries and sharing"><Share2 size={16} />Account & sharing</button></div>;
  return <>
    {view && viewLibraryId === libraryId ? <div style={{ display: "contents" }} {...(view.preview ? { inert: "" } : {})}><App key={`${user.id}:${libraryId}`} cloud={{ state: view.state, account: user, onChange: state => sync.current?.change(state), onSave: async state => { sync.current?.change(state); await sync.current?.sync(); }, onSignOut: signOut, toolbar, readOnly: library?.role === "viewer" || view.locked || view.conflicts.length > 0, saved: !view.dirty && !view.error, demo: false, canManagePrivacy: library?.role === "owner" }} /></div> : <div className="cloud-loading"><p role="status">Opening your cloud library...</p><button className="button secondary" onClick={() => { if (!library) void refreshLibraries().catch(e => setError(e.message)); else setRetry(n => n + 1); }}><RefreshCw size={16} />Retry</button><button className="button ghost" onClick={signOut}>Sign out</button></div>}
    {view?.preview && <div className="cloud-notice" role="status">Opening the full saved library. Editing and downloads will be available when it is ready.</div>}
    {(error || view?.error) && <div className="cloud-notice" role="alert"><span>{error || view?.error}</span><button onClick={() => error || !view || view.locked ? setRetry(n => n + 1) : void sync.current?.sync()}>Retry</button></div>}
    {recovery && <RecoveryDialog email={user.email} code={recovery} onSaved={() => setRecovery("")} />}
    {sharing && library && <SharingDialog user={user} libraries={libraries} selected={library} onClose={() => setSharing(false)} onSelect={id => { setLibraryId(id); setSharing(false); }} onJoined={async id => { await refreshLibraries(id); setSharing(false); }} />}
    {drivesOpen && library?.role === "owner" && <CloudDrives library={library} onClose={() => setDrivesOpen(false)} />}
    {revenueOpen && user.ownerDashboard && <OwnerRevenueDialog onClose={() => setRevenueOpen(false)} />}
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
const currencies = ["SGD", "USD", "EUR", "GBP", "AUD", "CAD", "MYR", "IDR", "JPY", "KRW", "CNY", "INR"];
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
    <p className="quiet">Private owner view for payments, subscription income and beta-program revenue. Guests and ordinary customer accounts cannot open this area.</p>
    {summary?.setupRequired && <p className="auth-message bad" role="alert">The payment ledger table is not active on this deployment yet. Publish the latest cloud build or run the new database migration before live Stripe events can appear.</p>}
    <div className="revenue-metrics">
      {summary?.totals.length ? summary.totals.map(total => <article key={total.currency}>
        <span>{total.currency}</span><strong>{formatMoney(total.currency, total.net)}</strong><small>{total.payments} payments · gross {formatMoney(total.currency, total.gross)} · fees {formatMoney(total.currency, total.fees)}</small>
      </article>) : <article><span>Total earnings</span><strong>{summary ? "No payments yet" : "Loading..."}</strong><small>Stripe payments and owner entries will appear here.</small></article>}
      <article><span>Accounts</span><strong>{summary?.accountCount ?? "..."}</strong><small>Signed-in KinForge accounts</small></article>
      <article><span>Beta interest</span><strong>{summary?.betaInterestCount ?? "..."}</strong><small>People who joined the beta list</small></article>
    </div>
    <section className="owner-revenue-entry" aria-labelledby="owner-revenue-entry-title">
      <h3 id="owner-revenue-entry-title">Record a payment</h3>
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
    <h3>Recent payments</h3>
    <div className="revenue-list">
      {summary?.recent.length ? summary.recent.map(event => <div className="cloud-member" key={event.id}><span><strong>{formatMoney(event.currency, event.net)} · {event.product}</strong><small>{event.customerEmail || event.customerName || "No customer"} · {event.provider} · {event.status} · {new Date(event.paidAt).toLocaleDateString()}</small></span></div>) : <p className="quiet">No payment events have been recorded yet.</p>}
    </div>
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
