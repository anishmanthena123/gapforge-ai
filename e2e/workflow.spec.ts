import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { paper, input } from "../tests/fixtures";
// Explicit test-only fixture responses. No live academic or paid AI calls are made.
const earlier = paper({
  id: "oa:W200",
  openalexId: "W200",
  title: "TEST FIXTURE: Earlier robotics method",
  doi: null,
  year: 2019,
  abstract: null,
  references: [],
});
const result = {
  papers: [paper(), earlier],
  queries: ["TEST FIXTURE: robot learning search"],
  concepts: {
    field: "Robotics",
    concepts: ["robot learning"],
    terminology: ["imitation learning"],
    methods: [],
    claims: [input.question],
    comparisons: [],
    queries: [
      "TEST FIXTURE: robot learning search",
      "TEST FIXTURE: causal robot prior art",
    ],
  },
  warnings: [
    "TEST FIXTURE: deterministic provider responses; not real research.",
  ],
  assessment: null,
};
test("landing, guest research, graph inspection, challenge, notes, reading queue and sourced exports", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let challenges = 0;
  await page.route("**/api/analyze", async (route) => {
    const body = route.request().postDataJSON();
    if (body.mode === "challenge") challenges++;
    const data =
      body.mode === "challenge"
        ? { ...result, queries: ["TEST FIXTURE: adversarial prior-art search"] }
        : result;
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({ type: "progress", stage: "Searching literature" }) +
        "\n" +
        JSON.stringify({ type: "result", data }) +
        "\n",
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every great idea/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore your research idea" }).click();
  await page.getByLabel("Research question or proposal").fill(input.question);
  await page.getByRole("button", { name: "Analyze research idea" }).click();
  await expect(page).toHaveURL(/\/research\/[a-f0-9-]+$/);
  const projectURL = page.url();
  await expect(
    page.getByRole("heading", { name: input.question }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bookmark paper" }).first().click();
  await page
    .getByLabel("Research notes")
    .fill("TEST FIXTURE: follow-up research note");
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Research notes")).toHaveValue(
    "TEST FIXTURE: follow-up research note",
  );
  await page.getByRole("link", { name: "Paper map", exact: true }).click();
  await expect(
    page.getByRole("img", { name: /Interactive evidence network/ }),
  ).toBeVisible();
  await page
    .getByLabel("Inspect a paper", { exact: true })
    .selectOption("oa:W100");
  await expect(page.locator(".paper-detail h3")).toHaveText(paper().title);
  await expect(page.locator(".paper-detail")).toContainText(
    "Classification explanation",
  );
  const citation = page.getByLabel("Inspect a connection", { exact: true });
  const option = await citation
    .locator("option")
    .filter({ hasText: /^Direct citation:/ })
    .first()
    .getAttribute("value");
  expect(option).toBeTruthy();
  await citation.selectOption(option!);
  await expect(page.locator(".paper-detail")).toContainText(
    "Verified metadata relationship",
  );
  await expect(page.locator(".paper-detail")).toContainText("oa:W200");
  await page.getByRole("button", { name: "Save graph layout" }).click();
  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export graph PNG" }).click();
  expect((await png).suggestedFilename()).toBe("gapforge-network.png");
  await page
    .getByRole("link", { name: "Challenge my idea", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Challenge My Idea", exact: true })
    .click();
  await expect.poll(() => challenges).toBe(1);
  await expect(
    page.getByText("Adversarial search strategy", { exact: false }),
  ).toBeVisible();
  await page.goto(projectURL);
  await page.getByText("Export report", { exact: true }).click();
  const md = page.waitForEvent("download");
  await page.getByRole("button", { name: "Markdown report" }).click();
  const download = await md;
  const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain(paper().title);
  expect(text).toContain("Abstract unavailable.");
  expect(text).toContain("10.0000/fixture-robot");
  await page.getByRole("link", { name: "Paper Library", exact: true }).click();
  await page
    .getByRole("button", { name: "Reading queue", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: paper().title }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: earlier.title })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});
test("mobile navigation, usable form and theme persistence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "New Research", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "What’s your next idea?" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Use light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("provider failure is actionable and creates no fake project", async ({
  page,
}) => {
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "error",
          error:
            "Literature search failed. Network access is denied. No research results were substituted.",
        }) + "\n",
    }),
  );
  await page.goto("/research/new");
  await page.getByLabel("Research question or proposal").fill(input.question);
  await page.getByRole("button", { name: "Analyze research idea" }).click();
  await expect(page.locator('.error-message[role="alert"]')).toContainText(
    "No research results were substituted",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("gapforge.projects.v1.guest") || "[]")
          .length,
    ),
  ).toBe(0);
  await expect(
    page.getByRole("button", { name: "Retry analysis" }),
  ).toBeEnabled();
});
test("unauthenticated cloud access is denied and the landing page has no serious accessibility violations", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/projects");
  expect([401, 503]).toContain(response.status());
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});

test("editable experiment, grounded assistant and valid PDF export with labeled test responses", async ({
  page,
}) => {
  const { makeProject } = await import("../src/lib/model");
  const project = makeProject(input, result);
  await page.addInitScript(
    (p) =>
      !localStorage.getItem("gapforge.projects.v1.guest") &&
      localStorage.setItem("gapforge.projects.v1.guest", JSON.stringify([p])),
    project,
  );
  await page.route("**/api/intelligence", async (route) => {
    const action = route.request().postDataJSON().action;
    const response =
      action === "experiment"
        ? {
            title: "TEST FIXTURE: Proposed experiment",
            question: input.question,
            hypothesis: "TEST FIXTURE: A testable hypothetical effect.",
            independentVariables: ["Test-only intervention"],
            dependentVariables: ["Test-only performance measure"],
            controls: ["Matched control"],
            baselines: ["TEST FIXTURE baseline"],
            methodology:
              "TEST FIXTURE: Randomize conditions; use independent replications.",
            equipment: ["Test-only workstation"],
            datasets: ["Collect a suitable dataset; verify its properties."],
            frameworks: ["Verify software compatibility."],
            metrics: ["Test-only outcome"],
            statistics: "Pre-register an analysis and report uncertainty.",
            challenges: ["Test-only challenge"],
            limitations: ["DETERMINISTIC TEST DATA; not scientific advice."],
            resources: "Test-only resource estimate",
            timeline: Array.from({ length: 6 }, (_, i) => ({
              month: i + 1,
              task: `TEST FIXTURE month ${i + 1}`,
            })),
            paperIds: [paper().id],
          }
        : {
            answer:
              "TEST FIXTURE: Read the comparison abstract first; its outcomes remain uncertain.",
            sources: [
              {
                paperId: paper().id,
                evidence: "Counterfactual demonstrations are compared",
              },
            ],
          };
    await route.fulfill({ json: response });
  });
  await page.goto(`/research/${project.id}/experiments`);
  await page
    .getByRole("button", { name: "Design an Experiment", exact: true })
    .click();
  const title = page.getByRole("textbox", {
    name: "Proposed title",
    exact: true,
  });
  await expect(title).toHaveValue("TEST FIXTURE: Proposed experiment");
  await title.fill("TEST FIXTURE: Edited experiment");
  await page
    .getByRole("button", { name: "Save experiment", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Proposed title", exact: true }),
  ).toHaveValue("TEST FIXTURE: Edited experiment");
  await page
    .getByLabel("Question for research assistant")
    .fill("Which study should I read first?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.locator(".chat-message.assistant")).toContainText(
    "TEST FIXTURE: Read the comparison",
  );
  await expect(page.locator(".chat-message.assistant a")).toHaveAttribute(
    "href",
    paper().url!,
  );
  await page.getByText("Export report", { exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF report", exact: true }).click();
  const download = await pending;
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  const { PDFDocument } = await import("pdf-lib");
  expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
});
