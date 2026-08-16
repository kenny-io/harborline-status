/** Harborline Status HTTP API with bounded validation and uniform errors. */

import { Hono } from "hono";
import type { HarborlineStore } from "./store.js";
import type { IncidentStatus } from "./types.js";

export interface HarborlineAppOptions {
  store: HarborlineStore;
  apiToken?: string;
}

const INCIDENT_STATUSES = new Set<IncidentStatus>([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
]);

const errorBody = (code: string, message: string) => ({ error: { code, message } });

const isShortText = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maximum;

/** Build an isolated Harborline application. */
export function createHarborlineApp(options: HarborlineAppOptions): Hono {
  const app = new Hono();

  app.get("/health", (context) => context.json({ status: "ok" }));
  app.get("/version", (context) => context.json({ version: "1.0.0" }));

  app.use("/v1/*", async (context, next) => {
    if (!options.apiToken) return next();
    if (context.req.header("authorization") !== `Bearer ${options.apiToken}`) {
      return context.json(errorBody("unauthorized", "A valid bearer token is required."), 401);
    }
    return next();
  });

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

  app.notFound((context) => context.json(errorBody("not_found", "Route not found."), 404));
  return app;
}
