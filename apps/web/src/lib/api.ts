const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";
let csrfToken = "";

type ApiError = Error & { status?: number };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.method && options.method !== "GET" ? { "X-CSRF-Token": csrfToken } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok) {
    const error = new Error(payload.error?.message ?? "Something went wrong") as ApiError;
    error.status = response.status;
    throw error;
  }
  return payload.data as T;
}

export async function initializeCsrf(): Promise<void> {
  const result = await request<{ csrfToken: string }>("/auth/csrf");
  csrfToken = result.csrfToken;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
  upload: <T>(path: string, file: File, description = "") =>
    request<T>(path, {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        "X-File-Name": encodeURIComponent(file.name),
        "X-Resume-Description": encodeURIComponent(description),
      },
      body: file,
    }),
  download: async (path: string): Promise<Blob> => {
    const response = await fetch(`${API_URL}${path}`, { credentials: "include" });
    if (!response.ok) {
      const payload = await response.json() as { error?: { message?: string } };
      throw new Error(payload.error?.message ?? "Could not download file");
    }
    return response.blob();
  },
};

export type User = { id: string; email: string; name: string; createdAt: string };
export type Status = "SAVED" | "APPLIED" | "ASSESSMENT" | "INTERVIEW" | "OFFER" | "REJECTED" | "WITHDRAWN";
export type ApplicationEvent = {
  id: string;
  fromStatus: Status | null;
  toStatus: Status;
  note: string | null;
  createdAt: string;
};
export type Application = {
  id: string;
  companyName: string;
  role: string;
  location: string | null;
  jobUrl: string | null;
  jobDescription: string | null;
  status: Status;
  appliedAt: string | null;
  followUpAt: string | null;
  nextAction: string | null;
  priority: number;
  source: string;
  updatedAt: string;
  events: ApplicationEvent[];
};
export type GmailIntegrationStatus = {
  connected: boolean;
  integration: { email: string; lastSyncedAt: string | null; createdAt: string } | null;
};
export type GmailSyncResult = { processed: number; created: number; updated: number; needsReview: number };
export type Dashboard = {
  totals: {
    total: number;
    active: number;
    pendingAssessments: number;
    upcomingFollowUps: number;
    interviewConversionRate: number;
    interviewToOfferRate: number;
  };
  statuses: { status: Status; count: number }[];
  upcomingFollowUps: { id: string; companyName: string; role: string; followUpAt: string | null; nextAction: string | null }[];
  recentActivity: (ApplicationEvent & { application: { id: string; companyName: string; role: string } })[];
};
export type ApplicationList = {
  items: Application[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
export type ImportedJobDetails = {
  companyName: string | null;
  role: string | null;
  location: string | null;
  jobDescription: string | null;
  jobUrl: string;
};
export type ResumeDocument = {
  id: string;
  name: string;
  description: string;
  contentType: string;
  size: number;
  createdAt: string;
};
export type ResumeAtsAnalysis = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  missingKeywords: string[];
};
export type InterviewPrep = {
  id: string;
  title: string;
  applicationId: string | null;
  scheduledAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  application: { id: string; companyName: string; role: string } | null;
};
export type ToolkitInsights = {
  totals: {
    total: number;
    active: number;
    interviewed: number;
    offers: number;
    interviewRate: number;
    offerRate: number;
  };
  statuses: { status: Status; count: number }[];
  monthlyApplications: { key: string; label: string; count: number }[];
};
