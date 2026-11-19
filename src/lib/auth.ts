import { useSyncExternalStore } from "react";
import { ApiError, apiRequest, setSessionRecovery } from "@/lib/api";

export type AuthMembership = {
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  roleCode: string;
  roleName: string;
  scope: "all" | "assigned";
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  jobTitle: string | null;
  userType: "interno" | "fornecedor" | "cliente";
  profileName: string | null;
  profileCode: string | null;
  permissions: string[];
  pages: string[];
  memberships: AuthMembership[];
};

export type AuthPayload = {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
};

type AuthState = {
  status: "loading" | "authenticated" | "anonymous";
  user: AuthUser | null;
  accessToken: string | null;
};

let state: AuthState = { status: "loading", user: null, accessToken: null };
let accessExpiresAt = 0;
const serverState: AuthState = { status: "loading", user: null, accessToken: null };
const listeners = new Set<() => void>();
let refreshTimer = 0;
let refreshTask: Promise<string | null> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function clearRefreshTimer() {
  if (refreshTimer) window.clearTimeout(refreshTimer);
  refreshTimer = 0;
}

function scheduleRefresh(expiresIn: number) {
  if (typeof window === "undefined") return;
  clearRefreshTimer();
  const delay = Math.max(30, expiresIn - 120) * 1000;
  refreshTimer = window.setTimeout(() => { void refreshAccess(); }, delay);
}

function setAuthenticated(payload: AuthPayload) {
  accessExpiresAt = Date.now() + payload.expiresIn * 1000;
  state = { status: "authenticated", user: payload.user, accessToken: payload.accessToken };
  emit();
  scheduleRefresh(payload.expiresIn);
}

function setAnonymous() {
  accessExpiresAt = 0;
  clearRefreshTimer();
  state = { status: "anonymous", user: null, accessToken: null };
  emit();
}

async function refreshAccess() {
  if (!refreshTask) {
    refreshTask = (async () => {
      try {
        const payload = await apiRequest<AuthPayload>("/api/auth/refresh", { method: "POST" });
        setAuthenticated(payload);
        return payload.accessToken;
      } catch (error) {
        if (error instanceof ApiError && error.status === 0) return state.accessToken;
        setAnonymous();
        return null;
      } finally {
        refreshTask = null;
      }
    })();
  }
  return refreshTask;
}

setSessionRecovery(() => refreshAccess());

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void renewSessionIfNeeded();
  });
}

export function useAuth() {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

export function getAccessToken() {
  return state.accessToken;
}

let sessionPromise: Promise<void> | null = null;

export function ensureSession() {
  if (!sessionPromise) sessionPromise = restore();
  return sessionPromise;
}

export function renewSessionIfNeeded() {
  if (state.status === "loading") return ensureSession();
  if (state.status !== "authenticated") return Promise.resolve();
  if (Date.now() < accessExpiresAt - 120_000) return Promise.resolve();
  return refreshAccess();
}

async function restore() {
  try {
    const payload = await apiRequest<AuthPayload>("/api/auth/refresh", { method: "POST" });
    if (state.status === "authenticated") return;
    setAuthenticated(payload);
  } catch {
    if (state.status === "authenticated") return;
    setAnonymous();
  }
}

export async function login(input: { email: string; password: string; remember: boolean }) {
  const payload = await apiRequest<AuthPayload>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setAuthenticated(payload);
  return payload.user;
}

export async function reloadSessionUser() {
  if (!state.accessToken || state.status !== "authenticated") return;
  const data = await apiRequest<{ user: AuthUser }>("/api/auth/me", {}, state.accessToken);
  if (state.status !== "authenticated") return;
  state = { ...state, user: data.user };
  emit();
}

export async function logout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" }, state.accessToken);
  } catch {
    // A sessão local sai mesmo se o servidor não responder.
  }
  setAnonymous();
}
