import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../shared/errors.js";
import type { AuthService } from "../auth/auth.service.js";
import type { AuthUser } from "../auth/auth.types.js";
import type { ProcurementService } from "./procurement.service.js";

declare module "fastify" {
  interface FastifyRequest { procurementUser: AuthUser }
}

const item = z.object({ materialId: z.string().min(1), requested: z.number().positive(), unitPrice: z.number().nonnegative().optional(), supplierCode: z.string().max(60).optional() });
const supplierBody = z.object({
  id: z.string().optional(), name: z.string().trim().min(1).max(200), cnpj: z.string().max(20).default(""), contact: z.string().max(150).default(""),
  email: z.string().max(190).default(""), phone: z.string().max(30).optional(), address: z.string().max(250).optional(), city: z.string().max(100).optional(),
  state: z.string().max(2).optional(), notes: z.string().max(2000).optional(), leadDays: z.number().min(0), rating: z.number().min(0).max(5),
  categories: z.array(z.string()).default([]), portalEnabled: z.boolean().optional(), portalContact: z.string().max(150).optional(), portalEmail: z.string().max(190).optional(),
});
const orderBody = z.object({
  id: z.string().optional(), branchId: z.string().min(1), priority: z.enum(["baixa", "normal", "alta", "urgente"]),
  desiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), notes: z.string().max(2000).default(""),
  items: z.array(z.object({ materialId: z.string().min(1), requested: z.number().positive() })).min(1),
});

function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw new AppError(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

export function registerProcurementRoutes(procurement: ProcurementService, auth: AuthService) {
  return async function procurementRoutes(app: FastifyInstance) {
    app.addHook("preHandler", async (request) => {
      request.procurementUser = (await auth.me(request.headers.authorization)).user;
    });
    app.get("/", async (request) => procurement.snapshot(request.procurementUser));
    app.post("/suppliers", async (request) => procurement.saveSupplier(request.procurementUser, parse(supplierBody, request.body), request.ip ?? null));
    app.post("/purchases", async (request) => procurement.createPurchase(request.procurementUser, parse(z.object({ branchId: z.string(), items: z.array(z.object({ materialId: z.string(), qty: z.number().positive() })).min(1), confirmed: z.object({ supplierId: z.string(), prices: z.record(z.string(), z.number()) }).optional() }), request.body)));
    app.post("/purchases/:id/quotes", async (request) => {
      const body = parse(z.object({ materialId: z.string(), supplierId: z.string(), unitPrice: z.number().nonnegative(), days: z.number().nonnegative(), freight: z.number().nonnegative().optional() }), request.body);
      return procurement.addQuote(request.procurementUser, (request.params as { id: string }).id, body.materialId, body);
    });
    app.post("/purchases/:id/approve", async (request) => procurement.approvePurchase(request.procurementUser, (request.params as { id: string }).id, parse(z.object({ mode: z.enum(["cost", "balanced"]) }), request.body).mode));
    app.post("/purchases/:id/send", async (request) => procurement.sendPurchase(request.procurementUser, (request.params as { id: string }).id));
    app.post("/purchases/:id/receive", async (request) => procurement.receivePurchase(request.procurementUser, (request.params as { id: string }).id, parse(z.object({ qty: z.record(z.string(), z.number()), damaged: z.record(z.string(), z.number()).default({}), prices: z.record(z.string(), z.number().optional()).default({}), notes: z.string().max(1000).default("") }), request.body), request.ip ?? null));
    app.post("/requests", async (request) => {
      const body = parse(z.object({ send: z.boolean(), branchId: z.string(), supplierId: z.string(), desiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), priority: z.enum(["baixa", "normal", "alta", "urgente"]), notes: z.string().max(2000).default(""), file: z.string().max(255).optional(), items: z.array(item).min(1) }), request.body);
      return procurement.saveRequest(request.procurementUser, body, body.send);
    });
    app.post("/requests/:id/respond", async (request) => {
      const body = parse(z.object({ items: z.array(item).min(1), file: z.string().max(255).optional() }), request.body);
      return procurement.respondRequest(request.procurementUser, (request.params as { id: string }).id, body.items, body.file);
    });
    app.post("/requests/:id/action", async (request) => {
      const body = parse(z.object({ action: z.enum(["send", "correction", "approve", "advance"]), note: z.string().max(2000).default("") }), request.body);
      return procurement.requestAction(request.procurementUser, (request.params as { id: string }).id, body.action, body.note);
    });
    app.post("/comments", async (request) => {
      const body = parse(z.object({ kind: z.enum(["order", "request"]), id: z.string(), note: z.string().max(2000) }), request.body);
      return procurement.comment(request.procurementUser, body.kind, body.id, body.note);
    });
    app.post("/orders", async (request) => procurement.saveOrder(request.procurementUser, parse(orderBody, request.body)));
    app.post("/orders/:id/:action", async (request) => {
      const params = request.params as { id: string; action: "submit" | "approve" | "reject" | "correct" | "pick" | "ship" | "receive" | "close" | "cancel" | "advance" | "duplicate" };
      if (params.action === "duplicate") return procurement.duplicateOrder(request.procurementUser, params.id);
      const body = parse(z.object({ quantities: z.record(z.string(), z.number()).optional(), note: z.string().max(2000).optional() }), request.body);
      return procurement.orderAction(request.procurementUser, params.id, params.action, body);
    });
    app.put("/budgets", async (request) => procurement.saveBudget(request.procurementUser, parse(z.object({ branchId: z.string(), period: z.string(), limit: z.number().min(0), block: z.boolean() }), request.body)));
    app.put("/workflows/:kind", async (request) => {
      const kind = (request.params as { kind: string }).kind;
      if (kind !== "cd" && kind !== "supplier") throw new AppError(400, "VALIDATION", "Fluxo inválido.");
      return procurement.saveWorkflow(request.procurementUser, kind, parse(z.object({ name: z.string().min(1).max(120), steps: z.array(z.object({ id: z.string(), name: z.string(), assigneeType: z.enum(["user", "role"]), assigneeId: z.string(), hours: z.number().positive(), requireNote: z.boolean(), minValue: z.number().optional(), maxValue: z.number().optional(), branchId: z.string().optional(), category: z.string().optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })).min(1) }), request.body));
    });
  };
}
