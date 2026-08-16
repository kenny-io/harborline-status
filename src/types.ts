/** Public Harborline domain contracts shared by the API, SDK, and widget. */

export type ComponentStatus = "operational" | "degraded" | "outage";

export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export type SubscriberChannel = "email" | "webhook";

export type OverallStatus = "operational" | "degraded" | "outage";

export interface StatusComponent {
  id: string;
  name: string;
  status: ComponentStatus;
  updatedAt: string;
}

export interface Incident {
  id: string;
  title: string;
  message: string;
  status: IncidentStatus;
  componentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateIncidentInput {
  title: string;
  message: string;
  componentIds: string[];
}

export interface UpdateIncidentInput {
  message?: string;
  status?: IncidentStatus;
}

/** One customer-facing message on an incident timeline. */
export interface IncidentUpdate {
  id: string;
  incidentId: string;
  message: string;
  status: IncidentStatus;
  publishedAt: string;
}

/** A destination registered for component-scoped incident alerts. */
export interface Subscriber {
  id: string;
  channel: SubscriberChannel;
  address: string;
  componentIds: string[];
  /** Paused destinations retain verification and component preferences. */
  isPaused: boolean;
  verifiedAt?: string;
  createdAt: string;
}

export interface CreateSubscriberInput {
  channel: SubscriberChannel;
  address: string;
  componentIds?: string[];
}

/** Public, unauthenticated status payload consumed by embeds and status pages. */
export interface StatusSummary {
  status: OverallStatus;
  components: StatusComponent[];
  activeIncidents: Incident[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
