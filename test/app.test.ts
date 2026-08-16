/** Endpoint coverage for Harborline's initial incident-management release. */

import { describe, expect, it } from "vitest";
import { createHarborlineApp } from "../src/app.js";
import { createHarborlineStore } from "../src/store.js";

const makeApp = (apiToken?: string) =>
  createHarborlineApp({ store: createHarborlineStore(), apiToken });

const json = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("public service metadata", () => {
  it("serves health and version without authentication", async () => {
    const app = makeApp("secret");
    expect(await (await app.request("/health")).json()).toEqual({ status: "ok" });
    expect(await (await app.request("/version")).json()).toEqual({ version: "1.0.0" });
  });
});

describe("components", () => {
  it("lists the seeded public components", async () => {
    const response = await makeApp().request("/v1/components");
    expect(response.status).toBe(200);
    expect((await response.json()).components).toHaveLength(3);
  });
});

describe("incident lifecycle", () => {
  it("creates, reads, lists, and resolves an incident", async () => {
    const app = makeApp();
    const createdResponse = await app.request(
      "/v1/incidents",
      json({ title: "API latency", message: "Investigating elevated latency.", componentIds: ["api"] }),
    );
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    expect(created).toMatchObject({ title: "API latency", status: "investigating" });

    expect((await (await app.request(`/v1/incidents/${created.id}`)).json()).id).toBe(created.id);
    expect((await (await app.request("/v1/incidents")).json()).incidents).toHaveLength(1);

    const resolved = await app.request(
      `/v1/incidents/${created.id}`,
      json({ status: "resolved", message: "Latency returned to normal." }, "PATCH"),
    );
    expect(await resolved.json()).toMatchObject({ status: "resolved" });
  });

  it("rejects malformed incidents and unknown components", async () => {
    const app = makeApp();
    expect((await app.request("/v1/incidents", json({}))).status).toBe(400);
    expect(
      (
        await app.request(
          "/v1/incidents",
          json({ title: "Problem", message: "Details", componentIds: ["missing"] }),
        )
      ).status,
    ).toBe(404);
  });
});

describe("authentication", () => {
  it("protects v1 routes when a token is configured", async () => {
    const app = makeApp("secret");
    expect((await app.request("/v1/components")).status).toBe(401);
    expect(
      (
        await app.request("/v1/components", {
          headers: { authorization: "Bearer secret" },
        })
      ).status,
    ).toBe(200);
  });
});
