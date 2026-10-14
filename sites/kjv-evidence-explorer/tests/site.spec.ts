import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Scripture study workspace" })).toBeVisible();
});

test("preserves the title description and companion ebook link", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "KJV Scripture Evidence Explorer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View the companion ebook on Amazon" })).toHaveAttribute("href", "https://www.amazon.com/dp/B0CW5Y1HV2");
});

test("passage and exact-word modes return canonical text", async ({ page }) => {
  await page.getByRole("radio", { name: "Passage" }).click();
  await page.getByLabel("Study query").fill("John 3:16");
  await page.getByRole("button", { name: "Study" }).click();
  await expect(page.getByText("For God so loved the world", { exact: false })).toBeVisible();

  await page.getByRole("radio", { name: "Exact word" }).click();
  await page.getByLabel("Study query").fill("gathered");
  await page.getByRole("button", { name: "Study" }).click();
  await expect(page.getByRole("heading", { name: "255 matching verses" })).toBeVisible();
  await expect(page.locator("tbody").getByText("Genesis 1:9", { exact: true })).toBeVisible();
});

test("related mode preserves deterministic golden ordering", async ({ page }) => {
  await page.getByLabel("Study query").fill("Genesis 1:1");
  await page.getByRole("button", { name: "Study" }).click();
  await expect(page.getByRole("heading", { name: "50 ranked results" })).toBeVisible();
  const references = await page.locator("tbody .reference").allTextContents();
  expect(references.slice(0, 3)).toEqual(["2 Samuel 18:9", "Jeremiah 51:48", "John 1:1"]);
  await expect(page.getByLabel("Strictness")).toHaveValue("exact_spelling");
  await page.getByLabel("Strictness").selectOption("letter_exact");
  await page.getByRole("button", { name: "Study" }).click();
  await expect(page.getByText("matchLevel:letter_exact", { exact: false })).toBeVisible();
});

test("phrase, compare, graph, workflow, and topic modes remain interactive", async ({ page }) => {
  await page.getByRole("radio", { name: "Exact phrase" }).click();
  await page.getByLabel("Study query").fill("in the beginning");
  await page.getByRole("button", { name: "Study" }).click();
  await expect(page.getByRole("heading", { name: /matching verses/ })).toBeVisible();

  await page.getByRole("radio", { name: "Compare" }).click();
  await page.getByLabel("Study query").fill("John 3:16, Romans 5:8");
  await page.getByRole("button", { name: "Study" }).click();
  await expect(page.getByText("John 3:16 ↔ Romans 5:8", { exact: true })).toBeVisible();

  await page.getByRole("radio", { name: "Evidence graph" }).click();
  await page.getByLabel("Study query").fill("John 3:16");
  await page.getByRole("button", { name: "Study" }).click();
  await expect(page.getByRole("heading", { name: /evidence nodes/ })).toBeVisible();

  await page.getByRole("radio", { name: "WHGW workflows" }).click();
  await page.getByLabel("Study query").fill("gathered");
  await page.getByRole("button", { name: "Study" }).click();
  await expect(page.getByRole("heading", { name: "Gather mentions" })).toBeVisible();

  await page.getByRole("radio", { name: "Modern topic" }).click();
  await page.getByLabel("Study query").fill("charity");
  await page.getByRole("button", { name: "Study" }).click();
  await expect(page.getByText("The query occurs in the KJV", { exact: false })).toBeVisible();
});

test("modern terms require explicit external dictionary sense selection", async ({ page }) => {
  await page.getByRole("radio", { name: "Modern topic" }).click();
  await page.getByLabel("Study query").fill("transportation");
  await page.getByRole("button", { name: "Study" }).click();
  await expect(page.getByText("Choose one dictionary sense", { exact: true })).toBeVisible();
  await expect(page.getByText("Princeton WordNet 3.0", { exact: false })).toBeVisible();
});
