/** Fetch-based browser SDK for Harborline's public and authenticated APIs. */

import type { Incident, StatusComponent } from "./types.js";

export interface HarborlineClientOptions {
  baseUrl: string;
  apiToken?: string;
  fetch?: typeof globalThis.fetch;
}

export interface HarborlineClient {
  listComponents(): Promise<StatusComponent[]>;
  listIncidents(): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident>;
}

/** Create a small dependency-free Harborline browser client. */
export function createHarborlineClient(options: HarborlineClientOptions): HarborlineClient {
  const request = options.fetch ?? globalThis.fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  const get = async <Value>(path: string): Promise<Value> => {
    const response = await request(`${baseUrl}${path}`, {
      headers: options.apiToken ? { authorization: `Bearer ${options.apiToken}` } : undefined,
    });
    if (!response.ok) throw new Error(`Harborline request failed with ${response.status}.`);
    return (await response.json()) as Value;
  };

  return {
    async listComponents() {
      return (await get<{ components: StatusComponent[] }>("/v1/components")).components;
    },
    async listIncidents() {
      return (await get<{ incidents: Incident[] }>("/v1/incidents")).incidents;
    },
    getIncident(id) {
      return get<Incident>(`/v1/incidents/${encodeURIComponent(id)}`);
    },
  };
}
