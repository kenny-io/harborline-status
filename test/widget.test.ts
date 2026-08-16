// @vitest-environment happy-dom
/** Sanitization and rendering coverage for the embeddable beacon widget. */

import { describe, expect, it } from "vitest";
import { renderHarborlineStatus } from "../src/widget.js";

describe("renderHarborlineStatus", () => {
  it("renders the all-clear state", () => {
    const html = renderHarborlineStatus({
      components: [
        { id: "api", name: "API", status: "operational", updatedAt: "2026-08-16T00:00:00Z" },
      ],
      incidents: [],
    });
    expect(html).toContain("All systems steady");
    expect(html).toContain("1 components reporting normally");
  });

  it("escapes incident titles before rendering", () => {
    const html = renderHarborlineStatus({
      components: [],
      incidents: [
        {
          id: "inc_1",
          title: "<img src=x onerror=alert(1)>",
          message: "Investigating",
          status: "investigating",
          componentIds: [],
          createdAt: "2026-08-16T00:00:00Z",
          updatedAt: "2026-08-16T00:00:00Z",
        },
      ],
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
