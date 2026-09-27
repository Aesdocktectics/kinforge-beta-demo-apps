import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const directory = process.argv[2];
if (!directory) throw new Error("Pass the verified installer directory.");
const { version, build } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const productName = build?.productName || "KinForge Genealogy Studio";
const files = [];
for (const [platform, suffix, formats] of [["Apple Silicon", "Apple-Silicon", ["dmg", "pkg", "zip"]], ["Intel", "Intel", ["dmg", "pkg", "zip"]], ["Windows", "x64", ["setup.exe", "portable.exe"]]]) {
  for (const format of formats) {
    const name = `${productName}-${version}-${suffix}${platform === "Windows" ? "-" : "."}${format}`;
    const path = join(directory, name), hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    files.push({ id: `${suffix.toLowerCase()}-${format.replace(".", "-")}`, platform, format, name, size: (await stat(path)).size, sha256: hash.digest("hex") });
  }
}
await writeFile("server/releaseManifest.ts", `// Generated from verified installer files.\nexport const release = ${JSON.stringify({ version, files }, null, 2)} as const;\n`);
await writeFile(join(directory, "SHA256SUMS.txt"), files.map(file => `${file.sha256}  ${file.name}`).join("\n") + "\n");
console.log(JSON.stringify({ version, files: files.length, directory }));
