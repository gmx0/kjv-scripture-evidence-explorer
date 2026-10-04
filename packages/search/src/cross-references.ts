import { compareReferences, formatReference, parseReference } from "../../corpus/src/index.ts";

export interface CrossReferenceManifest {
  schemaVersion: "1.0.0";
  setVersion: string;
  enabled: boolean;
  approvalStatus: "awaiting_licensed_source" | "approved";
  sourceUrl?: string;
  license?: string;
  checksum?: string;
  ownerApproved?: boolean;
}
export interface CrossReferenceRecord { source: string; target: string; note?: string; }

export function prepareCrossReferenceImport(manifest: CrossReferenceManifest, records: CrossReferenceRecord[]) {
  if (!manifest.enabled) return { manifest, enabled: false as const, records: [] as CrossReferenceRecord[] };
  if (!manifest.sourceUrl || !manifest.license || !/^[a-f\d]{64}$/iu.test(manifest.checksum ?? "") || !manifest.ownerApproved || manifest.approvalStatus !== "approved") {
    throw new Error("Enabled cross-reference sets require sourceUrl, license, checksum, and owner approval");
  }
  const unique = new Map<string, CrossReferenceRecord>();
  for (const record of records) {
    const left = formatReference(parseReference(record.source).start);
    const right = formatReference(parseReference(record.target).start);
    if (left === right) throw new Error(`Self-referential cross-reference is not allowed: ${left}`);
    const [source, target] = compareReferences(parseReference(left).start, parseReference(right).start) <= 0 ? [left, right] : [right, left];
    const normalized = { source, target, ...(record.note?.trim() ? { note: record.note.trim() } : {}) };
    unique.set(`${source}|${target}|${normalized.note ?? ""}`, normalized);
  }
  return { manifest, enabled: true as const, records: [...unique.values()].sort((left, right) => compareReferences(parseReference(left.source).start, parseReference(right.source).start) || compareReferences(parseReference(left.target).start, parseReference(right.target).start) || (left.note ?? "").localeCompare(right.note ?? "", "en")) };
}
