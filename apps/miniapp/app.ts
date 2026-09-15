import { refreshCurrentUser } from "./utils/session/auth";
import { configureVisualQaMode } from "./utils/visual-qa/mode";

App({
  onLaunch(options?: { query?: Record<string, string | undefined> }) {
    configureVisualQaMode(options?.query);
    void refreshCurrentUser();
  },
  globalData: {},
});
