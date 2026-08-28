export interface SessionState {
  token: string;
  userId: string;
}

const initialSession: SessionState = {
  token: "",
  userId: ""
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
