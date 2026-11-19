import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../shared/errors.js";
import type { AuthUser } from "../auth/auth.types.js";
import type { AuthService } from "../auth/auth.service.js";
import type { StockService } from "./stock.service.js";

declare module "fastify" {
  interface FastifyRequest {
    stockUser: AuthUser;
  }
}

const materialBody = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(30),
  sku: z.string().trim().max(50).optional(),
  barcode: z.string().trim().max(50).optional(),
  approvalCertificate: z.string().trim().max(30).optional(),
  manufacturer: z.string().trim().max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  brand: z.string().trim().max(100).optional(),
  category: z.string().trim().min(1).max(100),
  unit: z.string().trim().min(1).max(10),
  cost: z.number().min(0),
  min: z.number().min(0),
  max: z.number().min(0),
  lotControl: z.boolean(),
  initial: z.array(z.object({ clinicId: z.string().min(1), qty: z.number() })).optional(),
});

const movementBody = z.object({
  lines: z.array(z.object({
    type: z.enum(["entrada", "saida", "transferencia"]),
    materialId: z.string().min(1),
    clinicId: z.string().min(1),
    toClinicId: z.string().min(1).optional(),
    qty: z.number(),
    reason: z.string().trim().min(1).max(180),
    document: z.string().trim().max(60).optional(),
  })).min(1),
});

const transferBody = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  items: z.array(z.object({ materialId: z.string().min(1), qty: z.number() })).min(1),
});

const inventoryBody = z.object({
  branchId: z.string().min(1),
  scope: z.string().trim().min(1).max(100),
  blind: z.boolean(),
  counts: z.array(z.object({ materialId: z.string().min(1), qty: z.number() })).min(1),
});

const reviewBody = z.object({ approve: z.boolean(), note: z.string().trim().max(500) });
const recipeBody = z.object({ name: z.string().trim().min(1).max(150), items: z.array(z.object({ materialId: z.string().min(1), qty: z.number().positive() })).min(1) });
const procedureBody = z.object({ recipeId: z.string().min(1), branchId: z.string().min(1), repetitions: z.number().int().positive() });
const settingsBody = z.object({ limit: z.number().min(0), alertDays: z.number().int().positive() });
const branchBody = z.object({ branchId: z.string().min(1) });
const replenishBody = branchBody.extend({ channel: z.enum(["pedido", "compra"]) });
const lotBody = z.object({ materialId: z.string().min(1), clinicId: z.string().min(1), lot: z.string().trim().min(1).max(60), expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), qty: z.number().positive() });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw new AppError(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

export function registerStockRoutes(stock: StockService, auth: AuthService) {
  return async function stockRoutes(app: FastifyInstance) {
    app.addHook("preHandler", async (request) => {
      request.stockUser = (await auth.me(request.headers.authorization)).user;
    });

    app.get("/", async (request) => stock.snapshot(request.stockUser));
    app.post("/materials", async (request) => stock.createMaterial(request.stockUser, parse(materialBody, request.body), request.ip ?? null));
    app.patch("/materials/:id", async (request) => stock.updateMaterial(request.stockUser, (request.params as { id: string }).id, parse(materialBody.omit({ initial: true }), request.body), request.ip ?? null));
    app.post("/movements", async (request) => stock.registerMovements(request.stockUser, parse(movementBody, request.body).lines, request.ip ?? null));
    app.post("/transfers", async (request) => stock.createTransfer(request.stockUser, parse(transferBody, request.body), request.ip ?? null));
    app.post("/transfers/:id/advance", async (request) => stock.advanceTransfer(request.stockUser, (request.params as { id: string }).id, request.ip ?? null));
    app.post("/inventories", async (request) => stock.submitInventory(request.stockUser, parse(inventoryBody, request.body), request.ip ?? null));
    app.post("/adjustments/:id/review", async (request) => {
      const body = parse(reviewBody, request.body);
      return stock.reviewAdjustment(request.stockUser, (request.params as { id: string }).id, body.approve, body.note, request.ip ?? null);
    });
    app.post("/recipes", async (request) => {
      const body = parse(recipeBody, request.body);
      return stock.saveRecipe(request.stockUser, body.name, body.items, request.ip ?? null);
    });
    app.post("/procedures", async (request) => {
      const body = parse(procedureBody, request.body);
      return stock.consumeProcedure(request.stockUser, body.recipeId, body.branchId, body.repetitions, request.ip ?? null);
    });
    app.patch("/settings", async (request) => {
      const body = parse(settingsBody, request.body);
      return stock.saveSettings(request.stockUser, body.limit, body.alertDays, request.ip ?? null);
    });
    app.post("/digests", async (request) => stock.simulateDigest(request.stockUser, parse(branchBody, request.body).branchId));
    app.post("/replenishments", async (request) => {
      const body = parse(replenishBody, request.body);
      return stock.replenish(request.stockUser, body.branchId, body.channel, request.ip ?? null);
    });
    app.post("/lots", async (request) => stock.addLot(request.stockUser, parse(lotBody, request.body), request.ip ?? null));
  };
}
