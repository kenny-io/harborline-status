/** Harborline Status HTTP API with bounded validation and uniform errors. */

import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { HarborlineStore } from "./store.js";
import type { IncidentStatus, SubscriberChannel } from "./types.js";

export interface HarborlineAppOptions {
  store: HarborlineStore;
  apiToken?: string;
  /** Global reference-server guard for the intentionally public signup route. */
  publicSignupRateLimit?: {
    requests: number;
    windowMs: number;
  };
}

const INCIDENT_STATUSES = new Set<IncidentStatus>([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
]);
const SUBSCRIBER_CHANNELS = new Set<SubscriberChannel>(["email", "webhook"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const errorBody = (code: string, message: string) => ({ error: { code, message } });

const isShortText = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maximum;

const isValidSubscriberAddress = (channel: SubscriberChannel, address: unknown): address is string => {
  if (typeof address !== "string" || address.length > 2_048) return false;
  if (channel === "email") return address.length <= 320 && EMAIL_PATTERN.test(address);
  try {
    return new URL(address).protocol === "https:";
  } catch {
    return false;
  }
};

/** Build an isolated Harborline application. */
export function createHarborlineApp(options: HarborlineAppOptions): Hono {
  const app = new Hono();
  const signupLimit = options.publicSignupRateLimit ?? { requests: 120, windowMs: 60_000 };
  let signupWindowStartedAt = Date.now();
  let signupRequests = 0;

  app.get("/health", (context) => context.json({ status: "ok" }));
  app.get("/version", (context) => context.json({ version: "1.2.0" }));

  // These endpoints are deliberately credential-free so third-party status
  // pages may read state and register alerts. Authenticated operator routes do
  // not inherit wildcard CORS.
  app.use("/v1/status", cors({ origin: "*", allowMethods: ["GET", "OPTIONS"] }));
  app.use(
    "/v1/subscribers",
    cors({
      origin: "*",
      allowMethods: ["POST", "OPTIONS"],
      allowHeaders: ["content-type"],
      maxAge: 86_400,
    }),
  );

  app.use(
    "/v1/*",
    bodyLimit({
      maxSize: 16 * 1024,
      onError: (context) =>
        context.json(errorBody("payload_too_large", "Request bodies are limited to 16 KiB."), 413),
    }),
  );

  app.use("/v1/*", async (context, next) => {
    const isPublicStatus = context.req.method === "GET" && context.req.path === "/v1/status";
    const isPublicSignup = context.req.method === "POST" && context.req.path === "/v1/subscribers";
    if (!options.apiToken || isPublicStatus || isPublicSignup) return next();
    if (context.req.header("authorization") !== `Bearer ${options.apiToken}`) {
      return context.json(errorBody("unauthorized", "A valid bearer token is required."), 401);
    }
    return next();
  });

  app.get("/v1/status", (context) => context.json(options.store.getStatus()));

  app.get("/v1/components", (context) =>
    context.json({ components: options.store.listComponents() }),
  );

  app.get("/v1/incidents", (context) =>
    context.json({ incidents: options.store.listIncidents() }),
  );

  app.post("/v1/incidents", async (context) => {
    const body = await context.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) return context.json(errorBody("invalid_json", "Body must be valid JSON."), 400);
    if (!isShortText(body.title, 120)) {
      return context.json(errorBody("invalid_title", "title must be 1-120 characters."), 400);
    }
    if (!isShortText(body.message, 2_000)) {
      return context.json(errorBody("invalid_message", "message must be 1-2000 characters."), 400);
    }
    if (
      !Array.isArray(body.componentIds) ||
      body.componentIds.length === 0 ||
      body.componentIds.length > 20 ||
      body.componentIds.some((value) => typeof value !== "string")
    ) {
      return context.json(
        errorBody("invalid_components", "componentIds must contain 1-20 component ids."),
        400,
      );
    }
    const knownIds = new Set(options.store.listComponents().map((component) => component.id));
    if (body.componentIds.some((id) => !knownIds.has(id as string))) {
      return context.json(errorBody("component_not_found", "One or more components are unknown."), 404);
    }
    return context.json(
      options.store.createIncident({
        title: body.title,
        message: body.message,
        componentIds: body.componentIds as string[],
      }),
      201,
    );
  });

  app.get("/v1/incidents/:id/updates", (context) => {
    const updates = options.store.listIncidentUpdates(context.req.param("id"));
    return updates
      ? context.json({ updates })
      : context.json(errorBody("incident_not_found", "No incident has that id."), 404);
  });

  app.post("/v1/incidents/:id/updates", async (context) => {
    const body = await context.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) return context.json(errorBody("invalid_json", "Body must be valid JSON."), 400);
    if (!isShortText(body.message, 2_000)) {
      return context.json(errorBody("invalid_message", "message must be 1-2000 characters."), 400);
    }
    if (typeof body.status !== "string" || !INCIDENT_STATUSES.has(body.status as IncidentStatus)) {
      return context.json(errorBody("invalid_status", "status is not supported."), 400);
    }
    const update = options.store.publishIncidentUpdate(context.req.param("id"), {
      message: body.message,
      status: body.status as IncidentStatus,
    });
    return update
      ? context.json(update, 201)
      : context.json(errorBody("incident_not_found", "No incident has that id."), 404);
  });

  app.get("/v1/incidents/:id", (context) => {
    const incident = options.store.getIncident(context.req.param("id"));
    return incident
      ? context.json(incident)
      : context.json(errorBody("incident_not_found", "No incident has that id."), 404);
  });

  app.patch("/v1/incidents/:id", async (context) => {
    const body = await context.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) return context.json(errorBody("invalid_json", "Body must be valid JSON."), 400);
    if (body.message === undefined && body.status === undefined) {
      return context.json(errorBody("empty_update", "Set message and/or status."), 400);
    }
    if (body.message !== undefined && !isShortText(body.message, 2_000)) {
      return context.json(errorBody("invalid_message", "message must be 1-2000 characters."), 400);
    }
    if (
      body.status !== undefined &&
      (typeof body.status !== "string" || !INCIDENT_STATUSES.has(body.status as IncidentStatus))
    ) {
      return context.json(errorBody("invalid_status", "status is not supported."), 400);
    }
    const incident = options.store.updateIncident(context.req.param("id"), {
      ...(body.message === undefined ? {} : { message: body.message as string }),
      ...(body.status === undefined ? {} : { status: body.status as IncidentStatus }),
    });
    return incident
      ? context.json(incident)
      : context.json(errorBody("incident_not_found", "No incident has that id."), 404);
  });

  app.post("/v1/subscribers", async (context) => {
    const now = Date.now();
    if (now - signupWindowStartedAt >= signupLimit.windowMs) {
      signupWindowStartedAt = now;
      signupRequests = 0;
    }
    signupRequests += 1;
    if (signupRequests > signupLimit.requests) {
      context.header(
        "retry-after",
        Math.max(1, Math.ceil((signupLimit.windowMs - (now - signupWindowStartedAt)) / 1_000)).toString(),
      );
      return context.json(errorBody("rate_limited", "Too many alert signups. Try again later."), 429);
    }
    const body = await context.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) return context.json(errorBody("invalid_json", "Body must be valid JSON."), 400);
    if (typeof body.channel !== "string" || !SUBSCRIBER_CHANNELS.has(body.channel as SubscriberChannel)) {
      return context.json(errorBody("invalid_channel", "channel must be email or webhook."), 400);
    }
    const channel = body.channel as SubscriberChannel;
    if (!isValidSubscriberAddress(channel, body.address)) {
      return context.json(errorBody("invalid_address", "address is invalid for that channel."), 400);
    }
    const componentIds = body.componentIds;
    if (
      componentIds !== undefined &&
      (!Array.isArray(componentIds) ||
        componentIds.length > 20 ||
        componentIds.some((value) => typeof value !== "string"))
    ) {
      return context.json(errorBody("invalid_components", "componentIds must contain at most 20 ids."), 400);
    }
    const knownIds = new Set(options.store.listComponents().map((component) => component.id));
    if ((componentIds as string[] | undefined)?.some((id) => !knownIds.has(id))) {
      return context.json(errorBody("component_not_found", "One or more components are unknown."), 404);
    }
    const subscriber = options.store.createSubscriber({
      channel,
      address: body.address,
      ...(componentIds === undefined ? {} : { componentIds: componentIds as string[] }),
    });
    return subscriber
      ? context.json(subscriber, 201)
      : context.json(
          errorBody("subscriber_capacity_reached", "Alert signup is temporarily unavailable."),
          503,
        );
  });

  app.get("/v1/subscribers/:id", (context) => {
    const subscriber = options.store.getSubscriber(context.req.param("id"));
    return subscriber
      ? context.json(subscriber)
      : context.json(errorBody("subscriber_not_found", "No subscriber has that id."), 404);
  });

  app.post("/v1/subscribers/:id/verify", (context) => {
    const subscriber = options.store.verifySubscriber(context.req.param("id"));
    return subscriber
      ? context.json(subscriber)
      : context.json(errorBody("subscriber_not_found", "No subscriber has that id."), 404);
  });

  app.post("/v1/subscribers/:id/pause", (context) => {
    const subscriber = options.store.setSubscriberPaused(context.req.param("id"), true);
    return subscriber
      ? context.json(subscriber)
      : context.json(errorBody("subscriber_not_found", "No subscriber has that id."), 404);
  });

  app.post("/v1/subscribers/:id/resume", (context) => {
    const subscriber = options.store.setSubscriberPaused(context.req.param("id"), false);
    return subscriber
      ? context.json(subscriber)
      : context.json(errorBody("subscriber_not_found", "No subscriber has that id."), 404);
  });

  app.delete("/v1/subscribers/:id", (context) =>
    options.store.deleteSubscriber(context.req.param("id"))
      ? context.body(null, 204)
      : context.json(errorBody("subscriber_not_found", "No subscriber has that id."), 404),
  );

  app.notFound((context) => context.json(errorBody("not_found", "Route not found."), 404));
  return app;
}
