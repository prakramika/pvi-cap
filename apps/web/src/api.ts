const ACCESS_KEY = "pvi.accessToken";
const REFRESH_KEY = "pvi.refreshToken";

export type PublicLearner = {
  id: string;
  displayName: string;
  dateOfBirth: string;
  ageYears: number;
  assignedStage: string;
  stageLabel: string;
  stageGuidance: string;
  stageOverridden: boolean;
  respondentRelation: string;
  relationLabel: string;
  lastFamilyRole: "PARENT" | "TEACHER" | "CAREGIVER" | "CHILD" | null;
  familyRoleLabel: string | null;
  gender: string | null;
  diagnosis: string | null;
  schoolName: string | null;
  city: string | null;
  teacherEmail: string | null;
  caregiverEmail: string | null;
  profileComplete: boolean;
};

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "EXPERT" | "RESPONDENT";
  accountStatus: string;
  learner: PublicLearner | null;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
};

type ApiError = { error?: { message?: string } };

export function readSession(): { accessToken: string; refreshToken: string } | null {
  const accessToken = sessionStorage.getItem(ACCESS_KEY);
  const refreshToken = sessionStorage.getItem(REFRESH_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function saveSession(session: { accessToken: string; refreshToken: string }) {
  sessionStorage.setItem(ACCESS_KEY, session.accessToken);
  sessionStorage.setItem(REFRESH_KEY, session.refreshToken);
}

export function clearSession() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const session = readSession();
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);

  const response = await fetch(path, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  }
  return body;
}
