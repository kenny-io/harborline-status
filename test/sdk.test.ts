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
});
