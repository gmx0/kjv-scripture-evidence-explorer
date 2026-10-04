import { expect, test } from "@playwright/test";

test("modern topics require sense and KJV-candidate selection before results", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Modern topic", { exact: true }).click();
  await page.getByLabel("Study query").fill("harmony");
  await page.getByRole("button", { name: "Study" }).click();

  await expect(page.getByText("Choose a dictionary sense before any KJV vocabulary is suggested.")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /combined Scripture results/ })).toHaveCount(0);
  await page.getByLabel(/a harmonious state of things in general/).check();
  await page.getByRole("button", { name: "Use selected sense" }).click();

  await expect(page.getByText("Select the candidate KJV vocabulary to search.")).toBeVisible();
  await page.getByLabel(/concord/).check();
  await page.getByRole("button", { name: "Search selected KJV words" }).click();

  await expect(page.getByRole("heading", { name: /combined Scripture results/ })).toBeVisible();
  await expect(page.getByText("external synonym bridge").first()).toBeVisible();
  await expect(page.getByText("2 Corinthians 6:15").first()).toBeVisible();
  await expect(page.getByText("Dictionary provenance")).toBeVisible();
});

test("topic API cannot bypass ambiguity and exact KJV topics bypass WordNet", async ({ request }) => {
  const ambiguous = await request.post("/api/v1/topics/resolve", { data: { topic: "harmony" } });
  expect(ambiguous.ok()).toBeTruthy();
  const ambiguousBody = await ambiguous.json();
  expect(ambiguousBody.data.status).toBe("requires_sense_selection");
  expect(ambiguousBody.data.rankings).toBeUndefined();

  const invalid = await request.post("/api/v1/topics/resolve", { data: { topic: "harmony", selectedSenseId: "not-a-real-sense" } });
  expect(invalid.status()).toBe(422);

  const exact = await request.post("/api/v1/topics/resolve", { data: { topic: "begotten" } });
  expect(exact.ok()).toBeTruthy();
  const exactBody = await exact.json();
  expect(exactBody.data.status).toBe("exact_kjv");
  expect(exactBody.data.notice).toContain("no external vocabulary bridge");
});
