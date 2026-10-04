import { createHash } from "node:crypto";
import type { CorpusManifest } from "../../shared/src/index.ts";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function sha256(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function validateManifest(manifest: CorpusManifest): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== "1.0.0") errors.push("Unsupported manifest schema version");
  if (!manifest.corpusVersion.trim()) errors.push("corpusVersion is required");
  if (!manifest.edition.trim()) errors.push("edition is required");
  if (!isValidUrl(manifest.sourceUrl)) errors.push("sourceUrl must be an absolute URL");
  if (!manifest.sourceMember.trim()) errors.push("sourceMember is required");
  if (!SHA256_PATTERN.test(manifest.sourceSha256)) errors.push("sourceSha256 must be a lowercase SHA-256 digest");
  if (!SHA256_PATTERN.test(manifest.memberSha256)) errors.push("memberSha256 must be a lowercase SHA-256 digest");
  if (!SHA256_PATTERN.test(manifest.canonicalSha256)) errors.push("canonicalSha256 must be a lowercase SHA-256 digest");
  if (manifest.encoding !== "windows-1252") errors.push("encoding must be windows-1252");
  if (manifest.lineEndings !== "CRLF") errors.push("lineEndings must be CRLF");
  if (manifest.canonicalFormat !== "jsonl-utf8-lf-v1") errors.push("canonicalFormat must be jsonl-utf8-lf-v1");
  if (manifest.bookOrder.length !== 66) errors.push("bookOrder must contain 66 canonical books");
  if (manifest.counts.books !== manifest.bookOrder.length) errors.push("book count does not match bookOrder");
  if (manifest.counts.chapters < 1 || manifest.counts.verses < 1) errors.push("chapter and verse counts must be positive");
  if (!manifest.license.statement.trim()) errors.push("license statement is required");
  return errors;
}

function isValidUrl(value: string): boolean {
  try { return Boolean(new URL(value)); } catch { return false; }
}
