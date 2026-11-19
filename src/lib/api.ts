const baseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ErrorBody = { error?: { code?: string; message?: string } };
type Recover = () => Promise<string | null>;

let recoverSession: Recover | null = null;

export function setSessionRecovery(recover: Recover) {
  recoverSession = recover;
}

async function send(path: string, init: RequestInit, accessToken?: string | null) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  try {
    return await fetch(`${baseUrl}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw new ApiError(0, "NETWORK", "Servidor indisponível. Verifique se o backend está em execução.");
  }
}

async function read<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const body = data as ErrorBody | null;
    throw new ApiError(response.status, body?.error?.code ?? "HTTP_ERROR", body?.error?.message ?? "Não foi possível concluir a operação.");
  }
  return data as T;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, accessToken?: string | null, retried = false): Promise<T> {
  const response = await send(path, init, accessToken);
  if (response.status === 401 && accessToken && !retried && recoverSession) {
    const next = await recoverSession();
    if (next) return apiRequest<T>(path, init, next, true);
  }
  return read<T>(response);
}
