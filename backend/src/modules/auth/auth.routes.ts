import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";
import type { AuthService } from "./auth.service.js";

export const SESSION_COOKIE = "gs_session";

const loginBody = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
  remember: z.boolean().optional().default(false),
});

function clientIp(ip: string | undefined) {
  const value = ip?.trim();
  return value ? value.slice(0, 45) : null;
}

function userAgent(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;
  return value ? value.slice(0, 300) : null;
}

export function registerAuthRoutes(auth: AuthService, env: Env) {
  return async function authRoutes(app: FastifyInstance) {
    app.post("/login", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (request, reply) => {
      const parsed = loginBody.safeParse(request.body ?? {});
      if (!parsed.success) {
        throw new AppError(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Dados inválidos.");
      }
      const result = await auth.login(parsed.data, {
        ip: clientIp(request.ip),
        userAgent: userAgent(request.headers["user-agent"]),
      });
      setSessionCookie(reply, env, result.refreshToken, result.remember);
      return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
    });

    app.post("/refresh", async (request, reply) => {
      const current = request.cookies[SESSION_COOKIE];
      const result = await auth.refresh(current);
      if (current) setSessionCookie(reply, env, current, true);
      return result;
    });

    app.get("/me", async (request) => {
      return auth.me(request.headers.authorization);
    });

    app.post("/password", async (request) => {
      const parsed = z.object({
        currentPassword: z.string().min(1, "Informe a senha atual."),
        newPassword: z.string().min(8, "A nova senha precisa ter ao menos 8 caracteres."),
      }).safeParse(request.body ?? {});
      if (!parsed.success) throw new AppError(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Dados inválidos.");
      await auth.changePassword(request.headers.authorization, parsed.data.currentPassword, parsed.data.newPassword);
      return { ok: true };
    });

    app.post("/logout", async (request, reply) => {
      await auth.logout(request.cookies[SESSION_COOKIE]);
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return { ok: true };
    });
  };
}

function setSessionCookie(reply: FastifyReply, env: Env, token: string, remember: boolean) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    path: "/",
    maxAge: 60 * 60 * 24 * (remember ? 90 : 30),
  });
}
