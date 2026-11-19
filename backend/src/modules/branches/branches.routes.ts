import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../shared/errors.js";
import type { AuthUser } from "../auth/auth.types.js";
import type { AuthService } from "../auth/auth.service.js";
import type { BranchesService } from "./branches.service.js";

declare module "fastify" {
  interface FastifyRequest {
    branchUser: AuthUser;
  }
}

const warehouse = z.object({
  id: z.string().max(40).optional().default(""),
  name: z.string().trim().max(120),
  locations: z.array(z.string().trim().max(150)).default([]),
});

const branchBody = z.object({
  id: z.string().max(40).optional(),
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(150),
  type: z.enum(["administracao", "cd", "clinica"]),
  legalName: z.string().trim().max(200).optional().default(""),
  cnpj: z.string().trim().max(20).optional().default(""),
  address: z.string().trim().max(250).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  state: z.string().trim().max(2).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  email: z.string().trim().max(190).optional().default(""),
  manager: z.string().trim().max(150).optional().default(""),
  costCenter: z.string().trim().max(30).optional().default(""),
  region: z.string().trim().max(80).optional().default(""),
  openedAt: z.string().trim().max(10).optional().default(""),
  warehouses: z.array(warehouse).default([]),
});

const activeBody = z.object({ active: z.boolean() });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw new AppError(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

export function registerBranchRoutes(branches: BranchesService, auth: AuthService) {
  return async function branchRoutes(app: FastifyInstance) {
    app.addHook("preHandler", async (request) => {
      request.branchUser = (await auth.me(request.headers.authorization)).user;
    });

    app.get("/", async (request) => ({ branches: await branches.list(request.branchUser) }));
    app.get("/:id", async (request) => branches.detail(request.branchUser, (request.params as { id: string }).id));
    app.post("/", async (request) => branches.save(request.branchUser, parse(branchBody, request.body)));
    app.patch("/:id", async (request) => {
      const id = (request.params as { id: string }).id;
      return branches.save(request.branchUser, { ...parse(branchBody, request.body), id });
    });
    app.patch("/:id/active", async (request) => {
      const id = (request.params as { id: string }).id;
      const body = parse(activeBody, request.body);
      return branches.setActive(request.branchUser, id, body.active);
    });
  };
}
