import test from "node:test";
import assert from "node:assert/strict";
import { prepareCrossReferenceImport } from "../src/cross-references.ts";

test("disabled editorial cross-reference manifests import no rows", () => {
  const result = prepareCrossReferenceImport({ schemaVersion: "1.0.0", setVersion: "unselected", enabled: false, approvalStatus: "awaiting_licensed_source" }, [{ source: "John 3:16", target: "Romans 5:8" }]);
  assert.deepEqual(result.records, []);
  assert.equal(result.enabled, false);
});

test("enabled cross-reference sets require complete provenance and owner approval", () => {
  assert.throws(() => prepareCrossReferenceImport({ schemaVersion: "1.0.0", setVersion: "example-1", enabled: true, approvalStatus: "approved" }, []), /sourceUrl, license, checksum, and owner approval/);
});

test("approved records are canonicalized, deduplicated, and stably ordered", () => {
  const result = prepareCrossReferenceImport({ schemaVersion: "1.0.0", setVersion: "fixture-1", enabled: true, approvalStatus: "approved", sourceUrl: "https://example.invalid/fixture", license: "Test-only fixture", checksum: "a".repeat(64), ownerApproved: true }, [
    { source: "Romans 5:8", target: "John 3:16", note: "fixture" },
    { source: "John 3:16", target: "Romans 5:8", note: "fixture" },
  ]);
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.records[0], { source: "John 3:16", target: "Romans 5:8", note: "fixture" });
});
