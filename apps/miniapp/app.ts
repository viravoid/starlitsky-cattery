import { refreshCurrentUser } from "./utils/session/auth";

App({
  onLaunch() {
    void refreshCurrentUser();
  },
  globalData: {},
});
