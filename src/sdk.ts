/** Fetch-based browser SDK for Harborline's public and authenticated APIs. */

import type {
  Incident,
  IncidentStatus,
  IncidentUpdate,
  StatusComponent,
  StatusSummary,
  Subscriber,
  SubscriberChannel,
} from "./types.js";

export interface HarborlineClientOptions {
  baseUrl: string;
  apiToken?: string;
  fetch?: typeof globalThis.fetch;
}

export interface HarborlineClient {
  getStatus(): Promise<StatusSummary>;
  listComponents(): Promise<StatusComponent[]>;
  listIncidents(): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident>;
  listIncidentUpdates(id: string): Promise<IncidentUpdate[]>;
  publishIncidentUpdate(
    id: string,
    input: { message: string; status: IncidentStatus },
  ): Promise<IncidentUpdate>;
  subscribe(input: {
    channel: SubscriberChannel;
    address: string;
    componentIds?: string[];
  }): Promise<Subscriber>;
  getSubscriber(id: string): Promise<Subscriber>;
  verifySubscriber(id: string): Promise<Subscriber>;
  pauseSubscriber(id: string): Promise<Subscriber>;
  resumeSubscriber(id: string): Promise<Subscriber>;
  unsubscribe(id: string): Promise<void>;
}

/** Create a small dependency-free Harborline browser client. */
export function createHarborlineClient(options: HarborlineClientOptions): HarborlineClient {
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  const request = async <Value>(
    path: string,
    init: RequestInit = {},
  ): Promise<Value> => {
    const response = await fetchRequest(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...(options.apiToken ? { authorization: `Bearer ${options.apiToken}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(`Harborline request failed with ${response.status}.`);
    if (response.status === 204) return undefined as Value;
    return (await response.json()) as Value;
  };

  return {
    getStatus() {
      return request<StatusSummary>("/v1/status");
    },
    async listComponents() {
      return (await request<{ components: StatusComponent[] }>("/v1/components")).components;
    },
    async listIncidents() {
      return (await request<{ incidents: Incident[] }>("/v1/incidents")).incidents;
    },
    getIncident(id) {
      return request<Incident>(`/v1/incidents/${encodeURIComponent(id)}`);
    },
    async listIncidentUpdates(id) {
      return (
        await request<{ updates: IncidentUpdate[] }>(
          `/v1/incidents/${encodeURIComponent(id)}/updates`,
        )
      ).updates;
    },
    publishIncidentUpdate(id, input) {
      return request<IncidentUpdate>(`/v1/incidents/${encodeURIComponent(id)}/updates`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    subscribe(input) {
      return request<Subscriber>("/v1/subscribers", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    getSubscriber(id) {
      return request<Subscriber>(`/v1/subscribers/${encodeURIComponent(id)}`);
    },
    verifySubscriber(id) {
      return request<Subscriber>(`/v1/subscribers/${encodeURIComponent(id)}/verify`, {
        method: "POST",
      });
    },
    pauseSubscriber(id) {
      return request<Subscriber>(`/v1/subscribers/${encodeURIComponent(id)}/pause`, {
        method: "POST",
      });
    },
    resumeSubscriber(id) {
      return request<Subscriber>(`/v1/subscribers/${encodeURIComponent(id)}/resume`, {
        method: "POST",
      });
    },
    unsubscribe(id) {
      return request<void>(`/v1/subscribers/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
