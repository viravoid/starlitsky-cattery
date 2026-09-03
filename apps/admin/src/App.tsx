import { useEffect, useMemo, useState } from "react";
import type {
  CreatedAdminLoginChallengeData,
  CurrentUserData,
  PollAdminLoginChallengeData,
} from "@starlitsky/shared";
import {
  createAdminLoginChallenge,
  getCurrentAdminUser,
  logoutCurrentAdminSession,
  pollAdminLoginChallenge,
} from "./api/cattery";
import { clearAdminAuthToken, getAdminAuthToken, setAdminAuthToken } from "./api/auth-token";
import { AdminLayout } from "./layouts/AdminLayout";
import { routes } from "./routes";

const ADMIN_ROLES = new Set(["keeper", "admin"]);
const POLL_INTERVAL_MS = 2000;

export function App() {
  const CurrentPage = routes.catteryManagement;
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "login">("checking");
  const [currentUser, setCurrentUser] = useState<CurrentUserData | null>(null);

  useEffect(() => {
    let active = true;
    async function verifyExistingSession() {
      const token = getAdminAuthToken();
      if (!token) {
        setAuthState("login");
        return;
      }

      try {
        const data = await getCurrentAdminUser();
        if (!hasAdminAccess(data.user)) {
          await logoutCurrentAdminSession().catch(() => undefined);
          clearAdminAuthToken();
          if (active) {
            setCurrentUser(null);
            setAuthState("login");
          }
          return;
        }
        if (active) {
          setCurrentUser(data.user);
          setAuthState("authenticated");
        }
      } catch {
        clearAdminAuthToken();
        if (active) {
          setCurrentUser(null);
          setAuthState("login");
        }
      }
    }

    verifyExistingSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
      setAuthState("login");
    };
    window.addEventListener("starlitsky-admin-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("starlitsky-admin-unauthorized", handleUnauthorized);
  }, []);

  async function handleAuthenticated(data: PollAdminLoginChallengeData) {
    if (!data.token) throw new Error("登录响应缺少 session token");

    setAdminAuthToken(data.token);
    const current = await getCurrentAdminUser();
    if (!hasAdminAccess(current.user)) {
      await logoutCurrentAdminSession().catch(() => undefined);
      clearAdminAuthToken();
      setCurrentUser(null);
      setAuthState("login");
      return;
    }

    setCurrentUser(current.user);
    setAuthState("authenticated");
  }

  async function handleLogout() {
    try {
      await logoutCurrentAdminSession();
    } finally {
      clearAdminAuthToken();
      setCurrentUser(null);
      setAuthState("login");
    }
  }

  if (authState === "checking") {
    return (
      <main className="page auth-page">
        <section className="auth-panel">
          <p className="eyebrow">Starlitsky Admin</p>
          <h1>正在确认登录状态</h1>
          <p className="muted compact">请稍候。</p>
        </section>
      </main>
    );
  }

  if (authState === "login") {
    return <AdminQrLogin onAuthenticated={handleAuthenticated} />;
  }

  return (
    <AdminLayout onLogout={handleLogout} user={currentUser}>
      <CurrentPage />
    </AdminLayout>
  );
}

function AdminQrLogin({
  onAuthenticated,
}: {
  onAuthenticated: (data: PollAdminLoginChallengeData) => Promise<void>;
}) {
  const [challenge, setChallenge] = useState<CreatedAdminLoginChallengeData | null>(null);
  const [message, setMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [expiresAtMs, setExpiresAtMs] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  const secondsLeft = useMemo(
    () => Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000)),
    [expiresAtMs, nowMs],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function createChallenge() {
      setIsCreating(true);
      setMessage("");
      try {
        const created = await createAdminLoginChallenge();
        if (!active) return;
        setChallenge(created);
        setExpiresAtMs(Date.parse(created.expiresAt));
        if (created.qr.status === "unavailable") {
          setMessage(created.qr.message);
        }
      } catch (error) {
        if (active) setMessage(getErrorMessage(error));
      } finally {
        if (active) setIsCreating(false);
      }
    }

    createChallenge();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!challenge || Date.now() >= Date.parse(challenge.expiresAt)) return;

    const activeChallenge = challenge;
    let stopped = false;
    let timeoutId = 0;

    async function poll() {
      if (stopped) return;
      try {
        const result = await pollAdminLoginChallenge(activeChallenge.id, {
          pollCredential: activeChallenge.pollCredential,
        });
        if (stopped) return;
        if (result.token) {
          await onAuthenticated(result);
          return;
        }
        if (result.status === "expired") {
          setMessage("二维码已失效，正在刷新。");
          refreshChallenge();
          return;
        }
        if (result.status === "consumed") {
          setMessage("这个二维码已经使用过，请刷新后重试。");
          return;
        }
        timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS);
      } catch (error) {
        if (stopped) return;
        setMessage(getErrorMessage(error));
        timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timeoutId);
    };
  }, [challenge, onAuthenticated]);

  useEffect(() => {
    if (!challenge || secondsLeft > 0) return;
    setMessage("二维码已过期，正在刷新。");
    refreshChallenge();
  }, [challenge, secondsLeft]);

  async function refreshChallenge() {
    setIsCreating(true);
    setMessage("");
    try {
      const created = await createAdminLoginChallenge();
      setChallenge(created);
      setExpiresAtMs(Date.parse(created.expiresAt));
      if (created.qr.status === "unavailable") setMessage(created.qr.message);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="page auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Starlitsky Admin</p>
        <h1>使用星月小程序扫码登录</h1>
        <p className="muted">请使用星月缅因猫舍小程序扫码，并在手机上点击确认登录。</p>

        <div className="auth-qr-box">
          {challenge?.qr.imageDataUrl ? (
            <img src={challenge.qr.imageDataUrl} alt="星月小程序后台登录码" />
          ) : (
            <div className="auth-qr-placeholder">{isCreating ? "正在生成" : "暂无二维码"}</div>
          )}
        </div>

        <div className="auth-status-row">
          <span>{secondsLeft > 0 ? `剩余 ${secondsLeft} 秒` : "正在刷新"}</span>
          <button className="secondary-button" type="button" onClick={refreshChallenge} disabled={isCreating}>
            刷新二维码
          </button>
        </div>

        {message ? <p className="error-banner compact">{message}</p> : null}
      </section>
    </main>
  );
}

function hasAdminAccess(user: CurrentUserData) {
  return user.roles.some((role) => ADMIN_ROLES.has(role));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}
