// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PaperCard } from "../src/components/papers";
import { WorkspaceProvider } from "../src/components/workspace-provider";
import { paper } from "./fixtures";
vi.mock("../src/lib/supabase/client", () => ({ browserSupabase: () => null }));
it("shows absent abstracts explicitly and preserves original source links", () => {
  render(
    <WorkspaceProvider>
      <PaperCard paper={paper({ abstract: null })} />
    </WorkspaceProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Read abstract" }));
  expect(screen.getByText("Abstract unavailable.")).toBeVisible();
  expect(
    screen.getByRole("link", { name: /TEST FIXTURE: Robot/ }),
  ).toHaveAttribute("href", "https://example.org/test-fixture");
  cleanup();
});
