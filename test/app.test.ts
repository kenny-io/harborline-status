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
    expect(await (await app.request("/version")).json()).toEqual({ version: "1.2.0" });
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

describe("public status summary", () => {
  it("reports active incidents without authentication", async () => {
    const app = makeApp("secret");
    expect(await (await app.request("/v1/status")).json()).toMatchObject({
      status: "operational",
      activeIncidents: [],
    });

    const created = await (
      await app.request(
        "/v1/incidents",
        {
          ...json({
            title: "Webhook delays",
            message: "Investigating delivery lag.",
            componentIds: ["webhooks"],
          }),
          headers: {
            "content-type": "application/json",
            authorization: "Bearer secret",
          },
        },
      )
    ).json();
    const status = await (await app.request("/v1/status")).json();
    expect(status).toMatchObject({ status: "outage" });
    expect(status.activeIncidents[0].id).toBe(created.id);
  });

  it("supports credential-free cross-origin widget requests", async () => {
    const app = makeApp("secret");
    const status = await app.request("/v1/status", {
      headers: { origin: "https://customer.example" },
    });
    expect(status.headers.get("access-control-allow-origin")).toBe("*");

    const preflight = await app.request("/v1/subscribers", {
      method: "OPTIONS",
      headers: {
        origin: "https://customer.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

describe("incident updates", () => {
  it("publishes and lists an incident timeline", async () => {
    const app = makeApp();
    const incident = await (
      await app.request(
        "/v1/incidents",
        json({ title: "API errors", message: "Investigating.", componentIds: ["api"] }),
      )
    ).json();

    const published = await app.request(
      `/v1/incidents/${incident.id}/updates`,
      json({ status: "monitoring", message: "A fix is deployed." }),
    );
    expect(published.status).toBe(201);
    expect(await published.json()).toMatchObject({ status: "monitoring" });

    const timeline = await (
      await app.request(`/v1/incidents/${incident.id}/updates`)
    ).json();
    expect(timeline.updates).toHaveLength(2);
    expect(timeline.updates[1].message).toBe("A fix is deployed.");
  });
});

describe("subscriber alerts", () => {
  it("registers, reads, verifies, and removes an email subscriber", async () => {
    const app = makeApp("secret");
    const createdResponse = await app.request(
      "/v1/subscribers",
      json({ channel: "email", address: "ops@example.com", componentIds: ["api"] }),
    );
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    expect(created).toMatchObject({ channel: "email", address: "ops@example.com" });
    expect(created).not.toHaveProperty("verifiedAt");

    const auth = { headers: { authorization: "Bearer secret" } };
    expect((await app.request(`/v1/subscribers/${created.id}`)).status).toBe(401);
    expect(await (await app.request(`/v1/subscribers/${created.id}`, auth)).json()).toMatchObject({
      id: created.id,
    });
    const verified = await app.request(`/v1/subscribers/${created.id}/verify`, {
      method: "POST",
      ...auth,
    });
    expect((await verified.json()).verifiedAt).toBeTruthy();
    expect(
      (
        await app.request(`/v1/subscribers/${created.id}/pause`, {
          method: "POST",
        })
      ).status,
    ).toBe(401);
    const paused = await app.request(`/v1/subscribers/${created.id}/pause`, {
      method: "POST",
      ...auth,
    });
    expect(await paused.json()).toMatchObject({ id: created.id, isPaused: true });
    const resumed = await app.request(`/v1/subscribers/${created.id}/resume`, {
      method: "POST",
      ...auth,
    });
    expect(await resumed.json()).toMatchObject({ id: created.id, isPaused: false });
    expect(
      (
        await app.request(`/v1/subscribers/${created.id}`, {
          method: "DELETE",
          ...auth,
        })
      ).status,
    ).toBe(204);
  });

  it("rejects oversized public signup bodies before JSON parsing", async () => {
    const response = await makeApp().request("/v1/subscribers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: "email",
        address: "ops@example.com",
        padding: "x".repeat(17 * 1024),
      }),
    });
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("payload_too_large");
  });

  it("bounds public signup velocity", async () => {
    const app = createHarborlineApp({
      store: createHarborlineStore(),
      publicSignupRateLimit: { requests: 1, windowMs: 60_000 },
    });
    const body = { channel: "email", address: "ops@example.com" };
    expect((await app.request("/v1/subscribers", json(body))).status).toBe(201);
    const limited = await app.request("/v1/subscribers", json(body));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
  });

  it("fails closed when the in-process subscriber registry reaches its cap", async () => {
    const app = createHarborlineApp({
      store: createHarborlineStore({ maxSubscribers: 1 }),
    });
    expect(
      (
        await app.request(
          "/v1/subscribers",
          json({ channel: "email", address: "first@example.com" }),
        )
      ).status,
    ).toBe(201);
    const full = await app.request(
      "/v1/subscribers",
      json({ channel: "email", address: "second@example.com" }),
    );
    expect(full.status).toBe(503);
    expect((await full.json()).error.code).toBe("subscriber_capacity_reached");
  });

  it("rejects unsafe webhook destinations and unknown components", async () => {
    const app = makeApp();
    const insecure = await app.request(
      "/v1/subscribers",
      json({ channel: "webhook", address: "http://example.com/hook" }),
    );
    expect(insecure.status).toBe(400);
    expect((await insecure.json()).error.code).toBe("invalid_address");

    const unknown = await app.request(
      "/v1/subscribers",
      json({ channel: "email", address: "ops@example.com", componentIds: ["unknown"] }),
    );
    expect(unknown.status).toBe(404);
  });
});
