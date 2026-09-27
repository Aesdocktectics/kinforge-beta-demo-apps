const { app, BrowserWindow, session, dialog, ipcMain, shell, safeStorage, net } = require("electron");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pathToFileURL } = require("url");
const entry = path.join(__dirname, "..", "dist", "client", "index.html");
const cloudOrigin = !app.isPackaged && /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.KINFORGE_TEST_CLOUD_URL || "") ? process.env.KINFORGE_TEST_CLOUD_URL : "https://kinforge-genealogy-studio.marianneleong3.chatgpt.site";
let cloudCookie = "";
let sessionRestored = false;
function restoreSession() {
  if (sessionRestored) return;
  sessionRestored = true;
  try { if (fs.existsSync(sessionFile()) && safeStorage.isEncryptionAvailable()) cloudCookie = safeStorage.decryptString(fs.readFileSync(sessionFile())); } catch { cloudCookie = ""; }
}
function trustedSender(event) {
  if (event.senderFrame?.url.split("#")[0] !== pathToFileURL(entry).href) throw new Error("Untrusted application frame.");
}
function sessionFile() { return path.join(app.getPath("userData"), "cloud-session.enc"); }
function privateAccessTarget(input) {
  const access = input && typeof input.privateAccess === "object" ? input.privateAccess : {};
  const mode = access.mode || "Direct";
  if (mode === "Offline only") throw new Error("Private Access offline-only mode is active. KinForge opened the cached library and blocked network requests.");
  const service = String(input.path || "").includes("/api/terms/") ? "research" : "cloud";
  const shouldRoute = service === "research" ? access.routeResearch !== false : access.routeCloudSync !== false;
  if (mode !== "Custom HTTPS relay" || !shouldRoute) return new URL(input.path, cloudOrigin);
  const relay = String(access.relayUrl || "").trim();
  if (!relay) {
    if (access.killSwitch !== false) throw new Error("Private Access custom relay is selected, but no relay URL is saved.");
    return new URL(input.path, cloudOrigin);
  }
  const base = new URL(relay);
  if (base.protocol !== "https:") throw new Error("Private Access relay URLs must use HTTPS.");
  return new URL(String(input.path).replace(/^\//, ""), base.href.endsWith("/") ? base.href : `${base.href}/`);
}
ipcMain.handle("kinforge:open-drive-auth", async (event, value) => {
  trustedSender(event);
  const url = new URL(value);
  if (url.origin !== cloudOrigin || !/^\/api\/drive-oauth\/(google|onedrive)\/start$/.test(url.pathname) || !/^[a-f0-9]{64}$/.test(url.searchParams.get("ticket") || "") || [...url.searchParams.keys()].some(key => key !== "ticket")) throw new Error("Unsupported drive sign-in address.");
  await shell.openExternal(url.href);
});
ipcMain.handle("kinforge:cloud-request", async (event, input) => {
  trustedSender(event);
  if (!input || !/^\/api\/[a-zA-Z0-9/?=&_-]+$/.test(input.path) || !["GET", "POST", "PUT", "DELETE"].includes(input.method)) throw new Error("Unsupported cloud request.");
  restoreSession();
  const target = privateAccessTarget(input);
  const response = await net.fetch(target.href, { method: input.method, body: input.body, credentials: "omit", redirect: "error", headers: { "Content-Type": input.path.includes("/assets/") ? "text/plain" : "application/json", "X-KinForge-Client": "1", "X-KinForge-Private-Access": input.privateAccess?.mode || "Direct", "Origin": cloudOrigin, ...(cloudCookie ? { Cookie: cloudCookie } : {}) }, signal: AbortSignal.timeout(45000) });
  const cookie = response.headers.get("set-cookie")?.match(/(?:^|[;,]\s*)kinforge_session=([a-f0-9]*)/);
  if (cookie) {
    cloudCookie = cookie[1] ? `kinforge_session=${cookie[1]}` : "";
    if (cloudCookie && safeStorage.isEncryptionAvailable()) fs.writeFileSync(sessionFile(), safeStorage.encryptString(cloudCookie), { mode: 0o600 });
    else if (fs.existsSync(sessionFile())) fs.unlinkSync(sessionFile());
  }
  return { status: response.status, body: await response.text() };
});
const APP_FOLDER_NAME = "KinForge Genealogy Studio Supreme Suite";
const EXPORT_FOLDERS = ["Reports", "Backups", "Websites", "Exports", "Media", "GEDCOM", "Charts"];
const APP_INTERNAL_FOLDERS = ["Data", "Drafts", "Media", "Settings", "Logs"];

function safeFileName(value) {
  const leaf = String(value || "").replace(/\\/g, "/").split("/").filter(Boolean).pop() || "KinForge-export";
  let safe = leaf.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "-").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  if (!safe || safe === "." || safe === "..") safe = "KinForge-export";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(safe)) safe = `KinForge-${safe}`;
  if (safe.length <= 140) return safe;
  const parsed = path.parse(safe);
  if (parsed.ext && parsed.ext.length < 14) return `${parsed.name.slice(0, Math.max(1, 140 - parsed.ext.length))}${parsed.ext}`;
  return safe.slice(0, 140);
}

function safeCategory(value) {
  return EXPORT_FOLDERS.includes(value) ? value : "Exports";
}

function uniqueFilePath(directory, fileName) {
  const safe = safeFileName(fileName);
  const parsed = path.parse(safe);
  let candidate = path.join(directory, safe);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${parsed.name} ${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function writeReadme(filePath, body) {
  try {
    fs.writeFileSync(filePath, body, { flag: "wx" });
  } catch (error) {
    if (!error || error.code !== "EEXIST") throw error;
  }
}

function ensureKinForgeFolders() {
  const appRoot = path.join(app.getPath("appData"), APP_FOLDER_NAME);
  const downloadsRoot = path.join(app.getPath("downloads"), APP_FOLDER_NAME);
  const updatesRoot = path.join(downloadsRoot, "Updates");
  const folders = Object.fromEntries(EXPORT_FOLDERS.map((folder) => [folder, path.join(downloadsRoot, folder)]));
  const appFolders = Object.fromEntries(APP_INTERNAL_FOLDERS.map((folder) => [folder, path.join(appRoot, folder)]));
  fs.mkdirSync(appRoot, { recursive: true });
  fs.mkdirSync(downloadsRoot, { recursive: true });
  fs.mkdirSync(updatesRoot, { recursive: true });
  for (const folder of Object.values(folders)) fs.mkdirSync(folder, { recursive: true });
  for (const folder of Object.values(appFolders)) fs.mkdirSync(folder, { recursive: true });
  writeReadme(path.join(downloadsRoot, "README.txt"), [
    "KinForge Genealogy Studio Supreme Suite export folder",
    "Copyright 2026 Dreams of Serene Landscapes. All rights reserved.",
    "",
    "The owner Mac app stores generated reports, backups, websites, GEDCOM files, charts, and media exports in the subfolders here.",
    "Files are written locally. Signed-in owners also save exports to their KinForge cloud library and any connected Google Drive or OneDrive."
  ].join("\n"));
  writeReadme(path.join(appRoot, "README.txt"), [
    "KinForge Genealogy Studio Supreme Suite app folder",
    "Copyright 2026 Dreams of Serene Landscapes. All rights reserved.",
    "",
    "This folder is used by the native app for local app data, drafts, settings, media support files, and logs.",
    "Use the Downloads/KinForge Genealogy Studio Supreme Suite folder for owner-suite files you want to share."
  ].join("\n"));
  return { appRoot, downloadsRoot, updatesRoot, folders, appFolders };
}

ipcMain.handle("kinforge:get-storage-folders", event => { trustedSender(event); return ensureKinForgeFolders(); });

function platformLabel() {
  if (process.platform === "darwin") return process.arch === "arm64" ? "Apple Silicon" : "Intel";
  if (process.platform === "win32") return "Windows";
  return `${process.platform} ${process.arch}`;
}

function updateUrl(value) {
  const url = new URL(String(value || ""), cloudOrigin);
  if (url.origin !== cloudOrigin || !/^\/api\/releases\/[^/]+\/[a-z0-9-]+$/i.test(url.pathname)) throw new Error("Unsupported KinForge update address.");
  return url;
}

function fileNameFromDisposition(disposition) {
  const utf = String(disposition || "").match(/filename\*=UTF-8''([^;]+)/i);
  if (utf) {
    try { return decodeURIComponent(utf[1]); } catch { return utf[1]; }
  }
  const plain = String(disposition || "").match(/filename="?([^";]+)"?/i);
  return plain?.[1] || "KinForge-update";
}

ipcMain.handle("kinforge:get-app-info", event => {
  trustedSender(event);
  return { version: app.getVersion(), platform: process.platform, arch: process.arch, platformLabel: platformLabel(), monthlyUpdateCadenceDays: 30 };
});

ipcMain.handle("kinforge:download-update", async (event, value) => {
  trustedSender(event);
  const url = updateUrl(value);
  const response = await net.fetch(url.href, { redirect: "error", headers: { "X-KinForge-Client": "1" }, signal: AbortSignal.timeout(120000) });
  if (response.status < 200 || response.status >= 300) throw new Error("This KinForge update is not available yet.");
  const checksum = response.headers.get("x-checksum-sha256") || "";
  if (checksum && !/^[a-f0-9]{64}$/.test(checksum)) throw new Error("The update checksum was not valid.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (checksum && crypto.createHash("sha256").update(bytes).digest("hex") !== checksum) throw new Error("The update download failed its safety check.");
  const roots = ensureKinForgeFolders();
  const target = uniqueFilePath(roots.updatesRoot, fileNameFromDisposition(response.headers.get("content-disposition")));
  if (!target.startsWith(`${roots.updatesRoot}${path.sep}`)) throw new Error("KinForge refused an unsafe update path.");
  await fs.promises.writeFile(target, bytes);
  await shell.openPath(target);
  return { ok: true, path: target, sha256: checksum || undefined };
});

ipcMain.handle("kinforge:open-update-downloads", async event => {
  trustedSender(event);
  const roots = ensureKinForgeFolders();
  const error = await shell.openPath(roots.updatesRoot);
  return { ok: !error, path: roots.updatesRoot, error: error || undefined };
});

ipcMain.handle("kinforge:save-file", async (_event, payload = {}) => {
  trustedSender(_event);
  const roots = ensureKinForgeFolders();
  const category = safeCategory(payload.category);
  const targetDir = roots.folders[category];
  const fileName = safeFileName(payload.fileName);
  const target = uniqueFilePath(targetDir, fileName);
  if (!target.startsWith(`${targetDir}${path.sep}`)) throw new Error("KinForge refused an unsafe export path.");
  const buffer = typeof payload.base64 === "string" ? Buffer.from(payload.base64, "base64") : Buffer.from(String(payload.text || ""), "utf8");
  await fs.promises.writeFile(target, buffer);
  return { ok: true, path: target, category };
});

ipcMain.handle("kinforge:show-folder", async (_event, target = "downloads") => {
  trustedSender(_event);
  const roots = ensureKinForgeFolders();
  const folder = target === "app" ? roots.appRoot : target === "downloads" ? roots.downloadsRoot : roots.folders[safeCategory(target)];
  const error = await shell.openPath(folder);
  return { ok: !error, path: folder, error: error || undefined };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1040,
    minHeight: 720,
    title: "KinForge Genealogy Studio Supreme Suite",
    backgroundColor: "#f7f4ed",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (["https://console.cloud.google.com/auth/clients", "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"].includes(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (url.split("#")[0] !== pathToFileURL(entry).href) event.preventDefault();
  });

  win.loadFile(entry).catch((error) => {
    dialog.showErrorBox("KinForge could not open", String(error));
  });
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
    (details, callback) => callback({ cancel: new URL(details.url).origin !== cloudOrigin })
  );
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
