import type { ResolvedAdminLoginChallengeData } from "@starlitsky/shared";
import { getSessionState } from "../../store/session";
import { approveAdminLoginChallenge, resolveAdminLoginChallenge } from "../../utils/admin-auth";
import { loginWithWechat, refreshCurrentUser } from "../../utils/session/auth";

interface AdminAuthLoadOptions {
  scene?: string;
  sceneCredential?: string;
}

interface AdminAuthData {
  challenge: ResolvedAdminLoginChallengeData | null;
  isApproving: boolean;
  isLoading: boolean;
  message: string;
  sceneCredential: string;
  state: "loading" | "ready" | "forbidden" | "expired" | "confirmed" | "error";
}

interface AdminAuthPage {
  data: AdminAuthData;
  setData(data: Partial<AdminAuthData>): void;
  loadChallenge(sceneCredential: string): Promise<void>;
}

const DEFAULT_DATA: AdminAuthData = {
  challenge: null,
  isApproving: false,
  isLoading: true,
  message: "",
  sceneCredential: "",
  state: "loading",
};

Page({
  data: DEFAULT_DATA,

  async onLoad(this: AdminAuthPage, options: AdminAuthLoadOptions) {
    const sceneCredential = getCredentialFromOptions(options);
    this.setData({ sceneCredential });

    if (!sceneCredential) {
      this.setData({
        isLoading: false,
        message: "二维码无效，请回电脑浏览器刷新。",
        state: "error",
      });
      return;
    }

    await this.loadChallenge(sceneCredential);
  },

  async loadChallenge(this: AdminAuthPage, sceneCredential: string) {
    this.setData({ isLoading: true, message: "", state: "loading" });
    try {
      await ensureLoggedIn();
      if (!hasAdminRole()) {
        this.setData({
          isLoading: false,
          message: "当前账号无后台权限。",
          state: "forbidden",
        });
        return;
      }

      const challenge = await resolveAdminLoginChallenge({ sceneCredential });
      if (challenge.status === "expired") {
        this.setData({
          challenge,
          isLoading: false,
          message: "二维码已失效，请回电脑刷新。",
          state: "expired",
        });
        return;
      }
      if (challenge.status === "consumed") {
        this.setData({
          challenge,
          isLoading: false,
          message: "这个二维码已经使用过。",
          state: "error",
        });
        return;
      }

      this.setData({
        challenge,
        isLoading: false,
        message: "",
        state: "ready",
      });
    } catch (error) {
      this.setData({
        isLoading: false,
        message: getErrorMessage(error),
        state: "error",
      });
    }
  },

  async onApprove(this: AdminAuthPage) {
    if (!this.data.challenge || this.data.isApproving) return;

    this.setData({ isApproving: true, message: "" });
    try {
      await ensureLoggedIn();
      if (!hasAdminRole()) {
        this.setData({
          isApproving: false,
          message: "当前账号无后台权限。",
          state: "forbidden",
        });
        return;
      }

      const challenge = await approveAdminLoginChallenge(this.data.challenge.id, {
        sceneCredential: this.data.sceneCredential,
      });
      this.setData({
        challenge,
        isApproving: false,
        message: "已确认，请回到电脑浏览器。",
        state: "confirmed",
      });
    } catch (error) {
      this.setData({
        isApproving: false,
        message: getErrorMessage(error),
      });
    }
  },
});

async function ensureLoggedIn() {
  const current = await refreshCurrentUser();
  if (current) return current;
  const session = await loginWithWechat();
  return session.user;
}

function hasAdminRole() {
  const roles = getSessionState().roles;
  return roles.includes("keeper") || roles.includes("admin");
}

function getCredentialFromOptions(options: AdminAuthLoadOptions) {
  if (options.sceneCredential) return decodeURIComponent(options.sceneCredential).trim();
  const scene = options.scene ? decodeURIComponent(options.scene).trim() : "";
  if (scene.startsWith("a=")) return scene.slice(2);
  return "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}
