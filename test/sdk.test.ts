/** Browser SDK contract tests with a deterministic fetch boundary. */

import { describe, expect, it, vi } from "vitest";
import { createHarborlineClient } from "../src/sdk.js";

describe("createHarborlineClient", () => {
  it("normalizes the origin and authenticates requests", async () => {
    const request = vi.fn(async (input: string | URL | Request) =>
      new Response(JSON.stringify({ components: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createHarborlineClient({
      baseUrl: "https://status.harborline.test/",
      apiToken: "secret",
      fetch: request as typeof fetch,
    });

    await expect(client.listComponents()).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith("https://status.harborline.test/v1/components", {
      headers: { authorization: "Bearer secret" },
    });
  });

  it("serializes subscriber and timeline mutations", async () => {
    const request = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/subscribers")) {
        return new Response(
          JSON.stringify({
            id: "sub_1",
            channel: "email",
            address: "ops@example.com",
            componentIds: [],
            createdAt: "2026-08-16T00:00:00Z",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          id: "upd_1",
          incidentId: "inc_1",
          message: "Monitoring",
          status: "monitoring",
          publishedAt: "2026-08-16T00:00:00Z",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    });
    const client = createHarborlineClient({
      baseUrl: "https://status.harborline.test",
      fetch: request as typeof fetch,
    });

    await client.subscribe({ channel: "email", address: "ops@example.com" });
    await client.publishIncidentUpdate("inc_1", {
      message: "Monitoring",
      status: "monitoring",
    });

    expect(request).toHaveBeenNthCalledWith(
      1,
      "https://status.harborline.test/v1/subscribers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ channel: "email", address: "ops@example.com" }),
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      "https://status.harborline.test/v1/incidents/inc_1/updates",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
