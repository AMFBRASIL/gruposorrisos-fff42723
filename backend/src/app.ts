import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { Env } from "./config/env.js";
import type { Pool } from "./database/pool.js";
import { ensureAccess } from "./bootstrap/ensure-access.js";
import { ensureGestao } from "./bootstrap/ensure-gestao.js";
import { ensureSettings } from "./bootstrap/ensure-settings.js";
import { ensureProcurement } from "./bootstrap/ensure-procurement.js";
import { ensureStock } from "./bootstrap/ensure-stock.js";
import { AuthRepository } from "./modules/auth/auth.repository.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { TokenService } from "./modules/auth/tokens.js";
import { DirectoryRepository } from "./modules/directory/directory.repository.js";
import { registerDirectoryRoutes } from "./modules/directory/directory.routes.js";
import { DirectoryService } from "./modules/directory/directory.service.js";
import { MailService } from "./modules/mail/mail.service.js";
import { SettingsRepository } from "./modules/settings/settings.repository.js";
import { registerSettingsRoutes } from "./modules/settings/settings.routes.js";
import { SettingsService } from "./modules/settings/settings.service.js";
import { WorkRepository } from "./modules/work/work.repository.js";
import { registerWorkRoutes } from "./modules/work/work.routes.js";
import { WorkspaceRepository } from "./modules/workspace/workspace.repository.js";
import { registerWorkspaceRoutes } from "./modules/workspace/workspace.routes.js";
import { domainAllowed } from "./modules/settings/settings.rules.js";
import { ProcurementRepository } from "./modules/procurement/procurement.repository.js";
import { registerProcurementRoutes } from "./modules/procurement/procurement.routes.js";
import { ProcurementService } from "./modules/procurement/procurement.service.js";
import { BranchesRepository } from "./modules/branches/branches.repository.js";
import { registerBranchRoutes } from "./modules/branches/branches.routes.js";
import { BranchesService } from "./modules/branches/branches.service.js";
import { StockRepository } from "./modules/stock/stock.repository.js";
import { registerStockRoutes } from "./modules/stock/stock.routes.js";
import { StockService } from "./modules/stock/stock.service.js";
import { AppError, isAppError } from "./shared/errors.js";

function statusOf(error: unknown) {
  if (typeof error === "object" && error && "statusCode" in error) {
    const status = Number((error as { statusCode: unknown }).statusCode);
    if (Number.isInteger(status) && status >= 400 && status < 600) return status;
  }
  return 500;
}

export async function buildApp(env: Env, pool: Pool) {
  const app = Fastify({
    trustProxy: true,
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.values.senha",
        "req.body.values.apikey",
        "req.body.values.accesskey",
        "req.body.values.secretkey",
        "req.body.values.token",
        "req.body.values.segredo",
      ],
    },
  });

  const authRepository = new AuthRepository(pool);
  const settingsRepository = new SettingsRepository(pool, env.JWT_SECRET);
  const mail = new MailService(settingsRepository);
  const settings = new SettingsService(settingsRepository, mail);
  const auth = new AuthService(authRepository, new TokenService(env), {
    accessTtlSeconds: (userId) => settingsRepository.sessionMinutes(userId),
    accessLogsEnabled: () => settingsRepository.accessLogsEnabled(),
    onNewIp: async ({ email, name, ip }) => {
      if (!(await settingsRepository.suspiciousAlertsEnabled())) return;
      await mail.send({
        to: email,
        subject: "Novo acesso à sua conta",
        text: `Olá ${name},\n\nDetectamos um acesso à sua conta a partir do IP ${ip}. Se não foi você, altere sua senha.`,
      });
    },
  });
  const directory = new DirectoryService(new DirectoryRepository(pool), {
    assertNewEmail: async (email) => {
      const domain = await settingsRepository.allowedDomain();
      if (!domainAllowed(email, domain)) throw new AppError(400, "EMAIL_DOMAIN", `O e-mail precisa terminar com ${domain}.`);
    },
    userCreated: async ({ name, email, temporaryPassword }) => {
      await mail.send({
        to: email,
        subject: "Seu acesso ao Grupo Sorrisos",
        text: `Olá ${name},\n\nSua senha temporária é ${temporaryPassword}.\nAltere-a no primeiro acesso.`,
      });
    },
  });
  const stockRepository = new StockRepository(pool);
  const stock = new StockService(stockRepository);
  const procurement = new ProcurementService(new ProcurementRepository(pool, stockRepository), mail);
  const branches = new BranchesService(new BranchesRepository(pool));

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.NODE_ENV === "production" ? env.CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean) : true,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 300, timeWindow: "1 minute" });

  app.setErrorHandler((error, request, reply) => {
    if (isAppError(error)) {
      return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }
    const status = statusOf(error);
    if (status === 429) {
      return reply.status(429).send({ error: { code: "RATE_LIMITED", message: "Muitas tentativas. Aguarde um instante." } });
    }
    if (status >= 400 && status < 500) {
      const message = error instanceof Error ? error.message : "Requisição inválida.";
      return reply.status(status).send({ error: { code: "BAD_REQUEST", message } });
    }
    request.log.error(error);
    return reply.status(500).send({ error: { code: "INTERNAL", message: "Erro interno. Tente novamente." } });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: { code: "NOT_FOUND", message: "Recurso não encontrado." } });
  });

  app.get("/api/health", async () => {
    await pool.query("SELECT 1");
    return { status: "ok", service: "gruposorrisos-backend" };
  });

  await app.register(registerAuthRoutes(auth, env), { prefix: "/api/auth" });
  await app.register(registerDirectoryRoutes(directory, auth), { prefix: "/api/directory" });
  await app.register(registerStockRoutes(stock, auth), { prefix: "/api/stock" });
  await app.register(registerProcurementRoutes(procurement, auth), { prefix: "/api/procurement" });
  await app.register(registerSettingsRoutes(settings, auth), { prefix: "/api/settings" });
  await app.register(registerBranchRoutes(branches, auth), { prefix: "/api/branches" });
  await app.register(registerWorkRoutes(new WorkRepository(pool), auth), { prefix: "/api/work" });
  await app.register(registerWorkspaceRoutes(new WorkspaceRepository(pool), auth), { prefix: "/api/workspace" });

  app.addHook("onClose", async () => {
    await pool.end();
  });

  return app;
}

export async function prepareDatabase(env: Env, pool: Pool, log: (message: string) => void) {
  await pool.query("SELECT 1");
  await ensureAccess(pool, env, log);
  await ensureStock(pool, log);
  await ensureProcurement(pool, log);
  await ensureSettings(pool, log);
  await ensureGestao(pool, log);
}
