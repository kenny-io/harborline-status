/** In-memory reference store used by Harborline's API and isolated tests. */

import type {
  CreateIncidentInput,
  Incident,
  StatusComponent,
  UpdateIncidentInput,
} from "./types.js";

export interface HarborlineStore {
  listComponents(): StatusComponent[];
  listIncidents(): Incident[];
  getIncident(id: string): Incident | undefined;
  createIncident(input: CreateIncidentInput): Incident;
  updateIncident(id: string, input: UpdateIncidentInput): Incident | undefined;
}

let incidentSequence = 0;

/** Create an isolated store seeded with the public platform components. */
export function createHarborlineStore(): HarborlineStore {
  const now = new Date().toISOString();
  const components: StatusComponent[] = [
    { id: "api", name: "Public API", status: "operational", updatedAt: now },
    { id: "dashboard", name: "Dashboard", status: "operational", updatedAt: now },
    { id: "webhooks", name: "Webhook delivery", status: "operational", updatedAt: now },
  ];
  const incidents = new Map<string, Incident>();

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
      return incident;
    },
    updateIncident(id, input) {
      const current = incidents.get(id);
      if (!current) return undefined;
      const incident: Incident = {
        ...current,
        ...(input.message === undefined ? {} : { message: input.message }),
        ...(input.status === undefined ? {} : { status: input.status }),
        updatedAt: new Date().toISOString(),
      };
      incidents.set(id, incident);
      return incident;
    },
  };
}
