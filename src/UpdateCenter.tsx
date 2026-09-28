import { useEffect, useMemo, useState } from "react";
import { Download, FolderOpen, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import { cloudRequest } from "./cloudApi";
import { internalMonthlyUpdateBrief, recordUpdateAgentSignal } from "./updateAgent";
import type { NativeAppInfo, NativeLocalUpdatePackage } from "./nativeStorage";
import type { AppState } from "./domain";
import { buildBackup, downloadBlob } from "./exporters";

type ReleaseFile = {
  id: string;
  version?: string;
  platform: string;
  format: string;
  name: string;
  size: number;
  sha256?: string;
  available: boolean;
  url: string;
  localPath?: string;
};

type LatestRelease = {
  version: string;
  cadence: string;
  cadenceDays: number;
  policy: string;
  notes: string[];
  files: ReleaseFile[];
};

export function compareVersions(a: string, b: string) {
  const left = a.split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
  const right = b.split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function formatSize(bytes: number) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function preferredFiles(files: ReleaseFile[], appInfo: NativeAppInfo | null) {
  const platformFiles = appInfo?.platformLabel ? files.filter(file => file.platform === appInfo.platformLabel) : files;
  const order = appInfo?.platform === "darwin" ? ["pkg", "dmg", "zip"] : appInfo?.platform === "win32" ? ["setup", "exe", "portable", "zip"] : [];
  return [...platformFiles].sort((a, b) => (order.indexOf(a.format) < 0 ? 99 : order.indexOf(a.format)) - (order.indexOf(b.format) < 0 ? 99 : order.indexOf(b.format)));
}

export default function UpdateCenter({ onClose, currentState }: { onClose: () => void; currentState?: AppState | null }) {
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [appInfo, setAppInfo] = useState<NativeAppInfo | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [localPackages, setLocalPackages] = useState<ReleaseFile[]>([]);
  const [betaEnabled, setBetaEnabled] = useState(() => localStorage.getItem("kinforge-beta-preview-channel") === "enabled");
  const files = useMemo(() => localPackages.length ? localPackages : release ? preferredFiles(release.files, appInfo) : [], [appInfo, localPackages, release]);
  const newestLocalVersion = localPackages.length ? localPackages[localPackages.length - 1]?.version : "";
  const latestVersion = newestLocalVersion || release?.version || "";
  const newer = Boolean(localPackages.length || (release && appInfo && compareVersions(release.version, appInfo.version) > 0));
  const upToDate = Boolean(!localPackages.length && release && appInfo && compareVersions(release.version, appInfo.version) <= 0);
  const showPackages = Boolean(!checking && files.length && (!appInfo || newer));
  const betaInviteUrl = `${window.location.origin}${window.location.pathname}?beta=1#/beta-preview`;

  async function check(origin: "manual" | "auto" = "manual") {
    setChecking(true); setMessage("");
    try {
      recordUpdateAgentSignal(origin === "manual" ? "manual-update-check" : "auto-update-check");
      internalMonthlyUpdateBrief();
      const [latest, info, local] = await Promise.all([
        cloudRequest<LatestRelease>("/api/releases/latest"),
        window.kinforgeNative?.getAppInfo?.().catch(() => null) ?? Promise.resolve(null),
        window.kinforgeNative?.listLocalUpdates?.().catch(() => [] as NativeLocalUpdatePackage[]) ?? Promise.resolve([])
      ]);
      const nativePackages = local.map(file => ({ ...file, available: true }));
      setRelease(latest); setAppInfo(info);
      setLocalPackages(nativePackages);
      if (nativePackages.length) {
        const first = nativePackages[0]?.version;
        const last = nativePackages[nativePackages.length - 1]?.version;
        setMessage(`Ready update packages are available locally from ${first} through ${last}. Choose Open beside the package you want to install.`);
      } else if (info && compareVersions(latest.version, info.version) <= 0) setMessage(`KinForge is up to date at version ${info.version}. No app update is available right now.`);
      else if (!info) setMessage("The web app updates automatically when the published site is refreshed. Your library data is not changed by app updates.");
      else setMessage("A newer verified KinForge app package is available. Installing it updates the app, not your library data.");
    } catch (error) {
      recordUpdateAgentSignal("update-check-failed");
      setMessage(error instanceof Error ? error.message : "KinForge could not check for updates.");
    } finally {
      setChecking(false);
    }
  }

  async function download(file: ReleaseFile) {
    setBusy(true); setMessage("");
    try {
      recordUpdateAgentSignal("update-download-started", { platform: file.platform, format: file.format });
      if (window.kinforgeNative?.downloadUpdate) {
        const saved = await window.kinforgeNative.downloadUpdate(file.url);
        setMessage(`App update saved and opened from ${saved.path}. Your library is left unchanged.`);
      } else {
        window.location.assign(file.url);
        setMessage("App download started. Open the installer when it finishes. Your library is left unchanged.");
      }
    } catch (error) {
      recordUpdateAgentSignal("update-download-failed", { platform: file.platform, format: file.format });
      setMessage(error instanceof Error ? error.message : "KinForge could not download this update.");
    } finally {
      setBusy(false);
    }
  }

  async function openOrDownload(file: ReleaseFile) {
    if (file.localPath && window.kinforgeNative?.openLocalUpdate) {
      setBusy(true); setMessage("");
      try {
        recordUpdateAgentSignal("local-update-opened", { version: file.version || "unknown", platform: file.platform, format: file.format });
        const opened = await window.kinforgeNative.openLocalUpdate(file.localPath);
        setMessage(opened.error ? opened.error : `Opened ${file.name}. Your library is left unchanged.`);
      } catch (error) {
        recordUpdateAgentSignal("local-update-open-failed", { version: file.version || "unknown", platform: file.platform, format: file.format });
        setMessage(error instanceof Error ? error.message : "KinForge could not open this local update package.");
      } finally {
        setBusy(false);
      }
      return;
    }
    await download(file);
  }

  function setBetaChannel(enabled: boolean) {
    setBetaEnabled(enabled);
    localStorage.setItem("kinforge-beta-preview-channel", enabled ? "enabled" : "disabled");
    recordUpdateAgentSignal(enabled ? "beta-preview-enabled" : "beta-preview-disabled");
    setMessage(enabled
      ? "Beta Preview is on. KinForge will show beta notices and beta downloads only when a verified beta package is published. Stable libraries stay protected."
      : "Beta Preview is off. KinForge will show only stable release packages.");
  }

  async function downloadBetaSafetyBackup() {
    setBusy(true); setMessage("");
    try {
      recordUpdateAgentSignal("beta-safety-backup-started");
      const body = currentState
        ? buildBackup(currentState)
        : JSON.stringify({
            app: "KinForge Genealogy Studio",
            purpose: "Beta safety note",
            createdAt: new Date().toISOString(),
            message: "Open a cloud library before creating a full beta safety backup. Beta previews should never replace your stable KinForge library without a normal export/backup."
          }, null, 2);
      await downloadBlob(`KinForge-beta-safety-backup-${new Date().toISOString().slice(0, 10)}.json`, body, "application/json");
      setMessage(currentState
        ? "Beta safety backup downloaded. Keep it before installing or testing a beta build."
        : "Beta safety note downloaded. Open your library first to create a full library backup.");
    } catch (error) {
      recordUpdateAgentSignal("beta-safety-backup-failed");
      setMessage(error instanceof Error ? error.message : "KinForge could not create the beta safety backup.");
    } finally {
      setBusy(false);
    }
  }

  async function copyBetaInvite() {
    const text = [
      "Try the KinForge Genealogy Studio beta preview:",
      betaInviteUrl,
      "",
      "Use a KinForge account or guest/demo mode. Beta Preview is designed to test upcoming app features without changing the tester's stable library unless they intentionally save changes."
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      recordUpdateAgentSignal("beta-invite-copied");
      setMessage("Beta invite copied. Send it to a friend who wants to test the next KinForge update safely.");
    } catch {
      setMessage(`Beta invite link: ${betaInviteUrl}`);
    }
  }

  useEffect(() => { void check("manual"); }, []);

  return <div className="cloud-scrim"><section className="cloud-dialog wide update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
    <button className="cloud-close" aria-label="Close updates" onClick={onClose}><X size={20} /></button>
    <h2 id="update-title">KinForge Updates</h2>
    <p className="quiet">KinForge checks monthly for verified app updates. Installing an update changes the KinForge app package and interface, not your library, trees, books, collections, media, or reports.</p>
    <div className="update-summary">
      <div><strong>Installed</strong><span>{appInfo ? `${appInfo.version} · ${appInfo.platformLabel}` : "Web app"}</span></div>
      <div><strong>Latest</strong><span>{latestVersion || "Checking..."}</span></div>
      <div><strong>Status</strong><span>{checking ? "Checking..." : newer ? "Update available" : upToDate ? "Up to date" : "Ready"}</span></div>
    </div>
    <div className="button-row">
      <button className="button secondary" disabled={checking || busy} onClick={() => void check("manual")}><RefreshCw size={16} />Check now</button>
      {showPackages && window.kinforgeNative?.openUpdateDownloads && <button className="button secondary" disabled={busy} onClick={() => void window.kinforgeNative?.openUpdateDownloads?.()}><FolderOpen size={16} />Open update folder</button>}
    </div>
    <section className="beta-preview-panel" aria-labelledby="beta-preview-title">
      <div>
        <h3 id="beta-preview-title"><Sparkles size={17} />Beta Preview for friends</h3>
        <p>Turn this on when you want friends to try the next KinForge update while it is still being built. Beta Preview keeps stable releases separate, encourages a backup first, and uses verified beta packages only when one is published.</p>
      </div>
      <div className="beta-preview-controls">
        <label className="toggle-row beta-toggle"><input type="checkbox" checked={betaEnabled} onChange={(event) => setBetaChannel(event.target.checked)} /> Show beta preview updates</label>
        <button className="button secondary" disabled={busy} onClick={() => void downloadBetaSafetyBackup()}><ShieldCheck size={16} />Download beta safety backup</button>
        <button className="button secondary" disabled={busy} onClick={() => void copyBetaInvite()}><Sparkles size={16} />Copy friend beta invite</button>
      </div>
      <ul className="beta-safety-list">
        <li>Beta testers use their own account, guest mode, or a shared test library instead of overwriting your main records.</li>
        <li>KinForge asks for a backup before beta testing and stores beta preference locally on the device.</li>
        <li>Stable 1.3.8 packages remain the normal update path; beta downloads appear only when a separate verified beta package is published.</li>
      </ul>
    </section>
    {upToDate && <div className="update-files"><p className="quiet"><ShieldCheck size={16} />No newer KinForge app package is published. Download buttons will appear here only when a newer version is available.</p></div>}
    {showPackages && <>
      <h3>Available Update Packages</h3>
      <div className="update-files">
        {files.map(file => <article key={file.id} className="update-file">
          <div><strong>{file.version ? `Version ${file.version} · ` : ""}{file.platform} {file.format.toUpperCase()}</strong><span>{file.name} · {formatSize(file.size)}</span></div>
          <button className="button" disabled={busy || (!file.available && !file.localPath)} onClick={() => void openOrDownload(file)}><Download size={16} />{file.localPath ? "Open" : file.available ? "Download" : "Preparing"}</button>
        </article>)}
        {release && files.length === 0 && <p className="quiet">No package is published for this platform yet. Open the web app while the package is prepared.</p>}
      </div>
      <p className="update-safety"><ShieldCheck size={16} />Desktop downloads are checked against the published checksum before opening. App updates do not edit or migrate library data.</p>
    </>}
    {message && <p role="status" className="drive-message">{message}</p>}
  </section></div>;
}
