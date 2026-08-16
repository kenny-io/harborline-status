/** Public Harborline domain contracts shared by the API, SDK, and widget. */

export type ComponentStatus = "operational" | "degraded" | "outage";

export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

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

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
