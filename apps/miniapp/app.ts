import { refreshCurrentUser } from "./utils/session/auth";
import { configureVisualQaAdapter } from "./utils/visual-qa/adapter";
import { registerPrivacyAuthorization } from "./utils/privacy/authorization";

App({
  onLaunch(options?: { query?: Record<string, string | undefined> }) {
    configureVisualQaAdapter(options?.query);
    registerPrivacyAuthorization();
    void refreshCurrentUser();
  },
  globalData: {},
});
