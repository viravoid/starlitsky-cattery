import type { CurrentUserData, UserRole } from "@starlitsky/shared";

export interface SessionState {
  token: string;
  userId: string;
  currentRole: UserRole | "guest";
  roles: UserRole[];
  user: CurrentUserData | null;
  expiresAt: string;
}

const initialSession: SessionState = {
  token: "",
  userId: "",
  currentRole: "guest",
  roles: [],
  user: null,
  expiresAt: "",
};

let sessionState: SessionState = { ...initialSession };

export function getSessionState() {
  return sessionState;
}

export function setSessionState(next: Partial<SessionState>) {
  sessionState = { ...sessionState, ...next };
}

export function resetSessionState() {
  sessionState = { ...initialSession };
}
