import { expect, test } from "@playwright/test";

test("evidence graph offers table parity, a visual view, and stored explanations", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Evidence graph", { exact: true }).click();
  await page.getByLabel("Study query").fill("John 3:16");
  await page.getByRole("button", { name: "Study" }).click();

  await expect(page.getByRole("heading", { name: /explained edges/ })).toBeVisible({ timeout: 60_000 });
  const rows = page.locator("tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);
  await rows.first().getByRole("button", { name: "Inspect" }).click();
  await expect(page.getByRole("heading", { name: "Selected edge explanation" })).toBeVisible();
  await page.getByRole("button", { name: "Visual graph" }).click();
  await expect(page.getByRole("img", { name: /Bounded lexical evidence graph/ })).toBeVisible();
  await expect(page.getByText("Rectangle: verse")).toBeVisible();
  await expect(page.getByText(/Editorial cross-references are disabled/)).toBeVisible();
});

test("workflow API gathers exact mentions and labels lexical witnesses", async ({ request }) => {
  const mentions = await request.post("/api/v1/workflows", { data: { type: "gather_mentions", term: "begotten", limit: 20 } });
  expect(mentions.ok()).toBeTruthy();
  const mentionBody = await mentions.json();
  expect(mentionBody.data.mentions[0].evidenceTypes).toEqual(["exact_word"]);

  const witnesses = await request.post("/api/v1/workflows", { data: { type: "lexical_witnesses", reference: "John 3:16", count: 2 } });
  expect(witnesses.ok()).toBeTruthy();
  const witnessBody = await witnesses.json();
  expect(witnessBody.data.independenceBasis).toBe("distinct_canonical_books");
  expect(new Set(witnessBody.data.witnesses.map((item: { reference: { book: string } }) => item.reference.book)).size).toBe(witnessBody.data.witnesses.length);
  expect(witnessBody.data.notice).toContain("not a claim of doctrinal independence");
});
