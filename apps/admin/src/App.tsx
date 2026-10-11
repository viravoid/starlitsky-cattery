import { useEffect, useState, type FormEvent } from "react";
import type { AdminPasswordLoginData, CurrentUserData } from "@starlitsky/shared";
import {
  getCurrentAdminUser,
  loginAdminWithPassword,
  logoutCurrentAdminSession,
} from "./api/cattery";
import { clearAdminAuthToken, getAdminAuthToken, setAdminAuthToken } from "./api/auth-token";
import { AdminLayout } from "./layouts/AdminLayout";
import { routes } from "./routes";

const ADMIN_ROLES = new Set(["keeper", "admin"]);

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

  async function handleAuthenticated(data: AdminPasswordLoginData) {
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
    return <AdminPasswordLogin onAuthenticated={handleAuthenticated} />;
  }

  return (
    <AdminLayout onLogout={handleLogout} user={currentUser}>
      <CurrentPage />
    </AdminLayout>
  );
}

function AdminPasswordLogin({
  onAuthenticated,
}: {
  onAuthenticated: (data: AdminPasswordLoginData) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage("");
    try {
      await onAuthenticated(await loginAdminWithPassword({ username, password }));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Starlitsky Admin</p>
        <h1>后台登录</h1>

        <form className="auth-form" onSubmit={submitLogin}>
          <label>
            账号
            <input
              autoComplete="username"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              required
              type="text"
              value={username}
            />
          </label>
          <label>
            密码
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "登录中" : "登录"}
          </button>
        </form>

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
