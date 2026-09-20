import { refreshCurrentUser } from "./utils/session/auth";
import { configureVisualQaAdapter } from "./utils/visual-qa/adapter";

App({
  onLaunch(options?: { query?: Record<string, string | undefined> }) {
    configureVisualQaAdapter(options?.query);
    void refreshCurrentUser();
  },
  globalData: {},
});
