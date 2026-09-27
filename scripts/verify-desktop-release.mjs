import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { extractFile } = createRequire(import.meta.url)("@electron/asar");
const directory = resolve(process.argv[2]);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const version = packageJson.version;
const productName = packageJson.build?.productName || "KinForge Genealogy Studio";
const temp = mkdtempSync(join(tmpdir(), `kinforge-verify-${version}-`));
const run = (command, args) => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
function verifyApp(app, arch) {
  run("codesign", ["--verify", "--deep", "--strict", app]);
  assert.equal(run("lipo", ["-archs", join(app, "Contents/MacOS", productName)]), arch);
  assert.equal(run("/usr/libexec/PlistBuddy", ["-c", "Print CFBundleShortVersionString", join(app, "Contents/Info.plist")]), version);
  const archive = join(app, "Contents/Resources/app.asar");
  for (const file of ["electron/main.cjs", "electron/preload.cjs", "dist/client/index.html", ...readdirSync("dist/client/assets").filter(name => !name.endsWith(".map")).map(name => `dist/client/assets/${name}`)]) {
    assert.ok(extractFile(archive, file).equals(readFileSync(file)), `Package differs from verified source: ${file}`);
  }
  const extraFiles = run("find", [app, "-name", "._*"]);
  assert.equal(extraFiles, "", "Unexpected AppleDouble files in app bundle");
}
function findApps(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (!entry.isDirectory()) return [];
    const path = join(directory, entry.name);
    return entry.name.endsWith(".app") ? [path] : findApps(path);
  });
}
for (const [label, arch] of [["Apple-Silicon", "arm64"], ["Intel", "x86_64"]]) {
  const stem = join(directory, `${productName}-${version}-${label}`);
  const mount = join(temp, label); mkdirSync(mount);
  run("hdiutil", ["attach", `${stem}.dmg`, "-readonly", "-nobrowse", "-mountpoint", mount]);
  try { verifyApp(join(mount, `${productName}.app`), arch); }
  finally { run("hdiutil", ["detach", mount]); }
  const expanded = join(temp, `${label}-pkg`);
  run("pkgutil", ["--expand-full", `${stem}.pkg`, expanded]);
  const apps = findApps(expanded); assert.equal(apps.length, 1); verifyApp(apps[0], arch);
  run("unzip", ["-tq", `${stem}.zip`]);
  console.log(`${label}: DMG mounted, PKG expanded, architectures/signatures/packaged assets verified; ZIP integrity passed`);
}
for (const kind of ["setup", "portable"]) {
  const file = join(directory, `${productName}-${version}-x64-${kind}.exe`);
  assert.equal(readFileSync(file).subarray(0, 2).toString(), "MZ");
}
console.log(JSON.stringify({ version, passed: true, macNotarized: false, windowsExecutionTested: false }));
