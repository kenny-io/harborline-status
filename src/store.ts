/** In-memory reference store used by Harborline's API and isolated tests. */

import type {
  CreateSubscriberInput,
  CreateIncidentInput,
  Incident,
  IncidentStatus,
  IncidentUpdate,
  StatusSummary,
  StatusComponent,
  Subscriber,
  UpdateIncidentInput,
} from "./types.js";

export interface HarborlineStore {
  listComponents(): StatusComponent[];
  listIncidents(): Incident[];
  getIncident(id: string): Incident | undefined;
  createIncident(input: CreateIncidentInput): Incident;
  updateIncident(id: string, input: UpdateIncidentInput): Incident | undefined;
  getStatus(): StatusSummary;
  listIncidentUpdates(incidentId: string): IncidentUpdate[] | undefined;
  publishIncidentUpdate(
    incidentId: string,
    input: { message: string; status: IncidentStatus },
  ): IncidentUpdate | undefined;
  createSubscriber(input: CreateSubscriberInput): Subscriber | undefined;
  getSubscriber(id: string): Subscriber | undefined;
  verifySubscriber(id: string): Subscriber | undefined;
  deleteSubscriber(id: string): boolean;
}

export interface HarborlineStoreOptions {
  /** Hard memory bound for the reference server's in-process registry. */
  maxSubscribers?: number;
}

let incidentSequence = 0;
let updateSequence = 0;
let subscriberSequence = 0;

/** Create an isolated store seeded with the public platform components. */
export function createHarborlineStore(options: HarborlineStoreOptions = {}): HarborlineStore {
  const now = new Date().toISOString();
  const components: StatusComponent[] = [
    { id: "api", name: "Public API", status: "operational", updatedAt: now },
    { id: "dashboard", name: "Dashboard", status: "operational", updatedAt: now },
    { id: "webhooks", name: "Webhook delivery", status: "operational", updatedAt: now },
  ];
  const incidents = new Map<string, Incident>();
  const updates = new Map<string, IncidentUpdate[]>();
  const subscribers = new Map<string, Subscriber>();

  const recordUpdate = (
    incident: Incident,
    message: string,
    status: IncidentStatus,
  ): IncidentUpdate => {
    updateSequence += 1;
    const update: IncidentUpdate = {
      id: `upd_${updateSequence.toString(36).padStart(6, "0")}`,
      incidentId: incident.id,
      message,
      status,
      publishedAt: incident.updatedAt,
    };
    const timeline = updates.get(incident.id) ?? [];
    timeline.push(update);
    updates.set(incident.id, timeline);
    return update;
  };

  const applyIncidentUpdate = (
    incident: Incident,
    input: UpdateIncidentInput,
  ): Incident => ({
    ...incident,
    ...(input.message === undefined ? {} : { message: input.message }),
    ...(input.status === undefined ? {} : { status: input.status }),
    updatedAt: new Date().toISOString(),
  });

  return {
    listComponents() {
      return components.map((component) => ({ ...component }));
    },
    listIncidents() {
      return [...incidents.values()].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
    },
    getIncident(id) {
      return incidents.get(id);
    },
    createIncident(input) {
      incidentSequence += 1;
      const timestamp = new Date().toISOString();
      const incident: Incident = {
        id: `inc_${incidentSequence.toString(36).padStart(6, "0")}`,
        title: input.title,
        message: input.message,
        status: "investigating",
        componentIds: [...input.componentIds],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      incidents.set(incident.id, incident);
      recordUpdate(incident, incident.message, incident.status);
      return incident;
    },
    updateIncident(id, input) {
      const current = incidents.get(id);
      if (!current) return undefined;
      const incident = applyIncidentUpdate(current, input);
      incidents.set(id, incident);
      recordUpdate(incident, incident.message, incident.status);
      return incident;
    },
    getStatus() {
      const activeIncidents = [...incidents.values()].filter(
        (incident) => incident.status !== "resolved",
      );
      const status = activeIncidents.some((incident) =>
        incident.status === "investigating" || incident.status === "identified"
      )
        ? "outage"
        : activeIncidents.length > 0
          ? "degraded"
          : "operational";
      return {
        status,
        components: components.map((component) => ({ ...component })),
        activeIncidents,
      };
    },
    listIncidentUpdates(incidentId) {
      if (!incidents.has(incidentId)) return undefined;
      return [...(updates.get(incidentId) ?? [])];
    },
    publishIncidentUpdate(incidentId, input) {
      const current = incidents.get(incidentId);
      if (!current) return undefined;
      const incident = applyIncidentUpdate(current, input);
      incidents.set(incidentId, incident);
      return recordUpdate(incident, input.message, input.status);
    },
    createSubscriber(input) {
      if (subscribers.size >= (options.maxSubscribers ?? 10_000)) return undefined;
      subscriberSequence += 1;
      const subscriber: Subscriber = {
        id: `sub_${subscriberSequence.toString(36).padStart(6, "0")}`,
        channel: input.channel,
        address: input.address,
        componentIds: [...(input.componentIds ?? [])],
        createdAt: new Date().toISOString(),
      };
      subscribers.set(subscriber.id, subscriber);
      return subscriber;
    },
    getSubscriber(id) {
      return subscribers.get(id);
    },
    verifySubscriber(id) {
      const current = subscribers.get(id);
      if (!current) return undefined;
      const subscriber = { ...current, verifiedAt: new Date().toISOString() };
      subscribers.set(id, subscriber);
      return subscriber;
    },
    deleteSubscriber(id) {
      return subscribers.delete(id);
    },
  };
}
