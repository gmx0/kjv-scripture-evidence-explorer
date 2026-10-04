import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SOURCE_URL = "https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz";
const EXPECTED_SHA256 = "658b1ba191f5f98c2e9bae3e25c186013158f30ef779f191d2a44e5d25046dc8";
const sourcePath = resolve("data/source/WNdb-3.0.tar.gz");
const outputRoot = resolve("data/derived/wordnet-3.0");
const requiredFiles = ["index.noun", "index.verb", "index.adj", "index.adv", "data.noun", "data.verb", "data.adj", "data.adv"];

const archive = await readFile(sourcePath).catch(() => { throw new Error(`Missing ${sourcePath}. Download ${SOURCE_URL} first.`); });
const archiveSha256 = sha256(archive);
if (archiveSha256 !== EXPECTED_SHA256) throw new Error(`WordNet archive checksum mismatch: expected ${EXPECTED_SHA256}, received ${archiveSha256}`);
const entries = readTar(gunzipSync(archive));
await mkdir(resolve(outputRoot, "dict"), { recursive: true });
const files: Record<string, { sha256: string; bytes: number }> = {};
for (const name of requiredFiles) {
  const entry = [...entries.entries()].find(([path]) => path.endsWith(`/dict/${name}`) || path === `dict/${name}`)?.[1];
  if (!entry) throw new Error(`Official archive is missing dict/${name}`);
  await writeFile(resolve(outputRoot, "dict", name), entry);
  files[name] = { sha256: sha256(entry), bytes: entry.length };
}
const license = [...entries.entries()].find(([path]) => /(?:^|\/)LICENSE$/u.test(path))?.[1]
  ?? Buffer.from(extractEmbeddedLicense([...entries.entries()].find(([path]) => path.endsWith("/dict/index.noun") || path === "dict/index.noun")?.[1]), "utf8");
await writeFile(resolve(outputRoot, "LICENSE"), license);
files.LICENSE = { sha256: sha256(license), bytes: license.length };
await writeFile(resolve(outputRoot, "manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", provider: "Princeton WordNet", providerVersion: "3.0", sourceUrl: SOURCE_URL, licenseUrl: "https://wordnet.princeton.edu/license-and-commercial-use", archiveSha256, files }, null, 2)}\n`);
console.log(`Imported WordNet 3.0 (${archiveSha256}) to ${outputRoot}`);

function readTar(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = ascii(header.subarray(0, 100));
    const prefix = ascii(header.subarray(345, 500));
    const path = prefix ? `${prefix}/${name}` : name;
    const size = Number.parseInt(ascii(header.subarray(124, 136)) || "0", 8);
    const start = offset + 512;
    entries.set(path, Buffer.from(buffer.subarray(start, start + size)));
    offset = start + Math.ceil(size / 512) * 512;
  }
  return entries;
}
function ascii(buffer: Buffer) { return buffer.toString("ascii").replace(/\0.*$/u, "").trim(); }
function sha256(value: Buffer) { return createHash("sha256").update(value).digest("hex"); }
function extractEmbeddedLicense(index: Buffer | undefined) {
  if (!index) throw new Error("Official archive is missing its embedded license notice");
  const lines = index.toString("ascii").split(/\r?\n/u).filter((line) => line.startsWith("  "));
  if (lines.length < 20) throw new Error("Official archive has an incomplete embedded license notice");
  return `${lines.map((line) => line.replace(/^\s+\d+\s?/u, "").trimEnd()).join("\n")}\n`;
}
