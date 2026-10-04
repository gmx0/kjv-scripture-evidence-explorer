import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("browser related results reproduce the accepted CLI golden ranking", async ({ page }) => {
  const golden = JSON.parse(await readFile("tests/golden/phase1-related.json", "utf8"));
  const fixture = golden.queries.find((query: { reference: string }) => query.reference === "Genesis 1:1");

  await page.goto("/");
  await page.getByLabel("Study query").fill(fixture.reference);
  await page.getByRole("button", { name: "Study" }).click();

  await expect(page.getByRole("heading", { name: /ranked results/ })).toBeVisible({ timeout: 60_000 });
  const references = await page.locator("tbody .reference").allTextContents();
  expect(references.slice(0, 5)).toEqual(fixture.results.map((result: { reference: string }) => result.reference));
  await expect(page.getByText("Parsed deterministically")).toBeVisible();
  await expect(page.getByText("Why this matched").first()).toBeVisible();
});

test("API validation, passage context, and export are available", async ({ request }) => {
  const passage = await request.get("/api/v1/passages/John%203%3A16?context=1");
  expect(passage.ok()).toBeTruthy();
  const passageBody = await passage.json();
  expect(passageBody.data.requested[0].displayText).toContain("only begotten Son");
  expect(passageBody.data.context).toHaveLength(3);

  const invalid = await request.post("/api/v1/search/related", { data: { reference: "not a reference" } });
  expect(invalid.status()).toBe(400);

  const exported = await request.post("/api/v1/exports/research-record", {
    data: { mode: "related", input: "Genesis 1:1", limit: 5 },
  });
  expect(exported.ok()).toBeTruthy();
  expect(exported.headers()["content-disposition"]).toContain("kjv-research-record.json");
  const record = await exported.json();
  expect(record.recordVersion).toBe("1.0.0");
  expect(record.response.data.results.map((result: { label: string }) => result.label)).toEqual(
    ["John 1:1", "Jeremiah 51:48", "2 Samuel 18:9", "Genesis 1:17", "John 1:2"],
  );
});
