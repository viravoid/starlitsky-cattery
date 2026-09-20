import type { AuthSessionData, CurrentUserData } from "@starlitsky/shared";

type MaybePromise<T> = T | Promise<T>;

export interface SessionAuthAdapter {
  loginWithWechat?(): MaybePromise<AuthSessionData>;
  logout?(): MaybePromise<void>;
  refreshCurrentUser?(): MaybePromise<CurrentUserData | null>;
}

let activeAdapter: SessionAuthAdapter | null = null;

export function setSessionAuthAdapter(adapter: SessionAuthAdapter | null) {
  activeAdapter = adapter;
}

export function getSessionAuthAdapter() {
  return activeAdapter;
}
