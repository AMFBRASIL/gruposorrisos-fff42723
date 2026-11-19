import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../shared/errors.js";
import type { AuthUser } from "../auth/auth.types.js";
import type { AuthService } from "../auth/auth.service.js";
import type { SettingsService } from "./settings.service.js";

declare module "fastify" {
  interface FastifyRequest {
    settingsUser: AuthUser;
  }
}

const draftBody = z.object({
  module: z.string().trim().min(1),
  selections: z.record(z.string(), z.string()).optional().default({}),
  values: z.record(z.string(), z.string()).optional().default({}),
  toggles: z.record(z.string(), z.boolean()).optional().default({}),
});

export function registerSettingsRoutes(settings: SettingsService, auth: AuthService) {
  return async function settingsRoutes(app: FastifyInstance) {
    app.addHook("preHandler", async (request) => {
      request.settingsUser = (await auth.me(request.headers.authorization)).user;
    });

    app.get("/", async (request) => settings.snapshot(request.settingsUser));

    app.post("/", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => {
      const parsed = draftBody.safeParse(request.body ?? {});
      if (!parsed.success) throw new AppError(400, "VALIDATION", "Dados de configuração inválidos.");
      const draft = parsed.data;
      if (Object.keys(draft.values).length > 40 || Object.keys(draft.selections).length > 20) {
        throw new AppError(400, "VALIDATION", "Dados de configuração inválidos.");
      }
      return settings.save(request.settingsUser, draft.module, draft, request.ip?.slice(0, 45) ?? null);
    });
  };
}
