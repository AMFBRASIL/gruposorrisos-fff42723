import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../shared/errors.js";
import type { AuthUser } from "../auth/auth.types.js";
import type { AuthService } from "../auth/auth.service.js";
import type { DirectoryService } from "./directory.service.js";

declare module "fastify" {
  interface FastifyRequest {
    directoryUser: AuthUser;
  }
}

const membership = z.object({
  branchId: z.string().min(1),
  roleId: z.string().min(1),
});

const userBody = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(150),
  email: z.string().trim().email("Informe um e-mail válido.").max(190),
  initials: z.string().trim().max(4).optional(),
  color: z.string().trim().max(40).optional(),
  profileId: z.string().nullable().optional(),
  department: z.string().trim().max(80).nullable().optional(),
  memberships: z.array(membership).optional(),
  seesAllBranches: z.boolean().optional(),
});

const profileBody = z.object({
  name: z.string().trim().min(1, "Informe o nome do perfil.").max(100),
  description: z.string().trim().max(300).optional(),
  color: z.string().trim().max(40).optional(),
});

const pageBody = z.object({
  path: z.string().trim().min(1),
  allowed: z.boolean(),
});

const permissionBody = z.object({
  code: z.string().trim().min(1).max(60),
  allowed: z.boolean(),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw new AppError(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

function clientIp(ip: string | undefined) {
  const value = ip?.trim();
  return value ? value.slice(0, 45) : null;
}

export function registerDirectoryRoutes(directory: DirectoryService, auth: AuthService) {
  return async function directoryRoutes(app: FastifyInstance) {
    app.addHook("preHandler", async (request) => {
      const session = await auth.me(request.headers.authorization);
      request.directoryUser = session.user;
    });

    app.get("/", async () => directory.snapshot());

    app.post("/users", async (request) => {
      const body = parse(userBody, request.body);
      return directory.saveUser(request.directoryUser, body, clientIp(request.ip));
    });

    app.patch("/users/:id", async (request) => {
      const body = parse(userBody, request.body);
      const id = (request.params as { id: string }).id;
      return directory.saveUser(request.directoryUser, { ...body, id }, clientIp(request.ip));
    });

    app.post("/profiles", async (request) => {
      const body = parse(profileBody, request.body);
      return directory.saveProfile(request.directoryUser, body, clientIp(request.ip));
    });

    app.patch("/profiles/:id", async (request) => {
      const body = parse(profileBody, request.body);
      const id = (request.params as { id: string }).id;
      return directory.saveProfile(request.directoryUser, { ...body, id }, clientIp(request.ip));
    });

    app.patch("/profiles/:id/pages", async (request, reply) => {
      const body = parse(pageBody, request.body);
      const id = (request.params as { id: string }).id;
      await directory.setPageAccess(request.directoryUser, id, body.path, body.allowed, clientIp(request.ip));
      return reply.send({ ok: true });
    });

    app.patch("/roles/:id/permissions", async (request, reply) => {
      const body = parse(permissionBody, request.body);
      const id = (request.params as { id: string }).id;
      await directory.setRolePermission(request.directoryUser, id, body.code, body.allowed, clientIp(request.ip));
      return reply.send({ ok: true });
    });
  };
}
