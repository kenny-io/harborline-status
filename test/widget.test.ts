// @vitest-environment happy-dom
/** Sanitization and rendering coverage for the embeddable beacon widget. */

import { describe, expect, it } from "vitest";
import { renderHarborlineStatus } from "../src/widget.js";

describe("renderHarborlineStatus", () => {
  it("renders the all-clear state", () => {
    const html = renderHarborlineStatus({
      status: "operational",
      components: [
        { id: "api", name: "API", status: "operational", updatedAt: "2026-08-16T00:00:00Z" },
      ],
      activeIncidents: [],
    });
    expect(html).toContain("All systems steady");
    expect(html).toContain("1 components reporting normally");
  });

  it("escapes incident titles before rendering", () => {
    const html = renderHarborlineStatus({
      status: "outage",
      components: [],
      activeIncidents: [
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

  it("adds the opt-in form only when requested", () => {
    const payload = { status: "operational" as const, components: [], activeIncidents: [] };
    expect(renderHarborlineStatus(payload)).not.toContain("Subscribe to status alerts");
    expect(renderHarborlineStatus(payload, { showSubscribe: true })).toContain(
      "Subscribe to status alerts",
    );
  });

  it("normalizes an untrusted status value before writing HTML", () => {
    const html = renderHarborlineStatus({
      status: 'operational\" onmouseover=\"alert(1)' as "operational",
      components: [],
      activeIncidents: [],
    });
    expect(html).toContain("beacon--outage");
    expect(html).not.toContain("onmouseover");
  });
});
