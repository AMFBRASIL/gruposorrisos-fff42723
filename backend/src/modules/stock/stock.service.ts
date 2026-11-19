import { AppError } from "../../shared/errors.js";
import type { AuthUser } from "../auth/auth.types.js";
import { StockError, StockRepository } from "./stock.repository.js";

export class StockService {
  constructor(private readonly repository: StockRepository) {}

  snapshot(user: AuthUser) {
    this.assert(user, "estoque.visualizar");
    return this.repository.snapshot();
  }

  async createMaterial(user: AuthUser, input: Parameters<StockRepository["createMaterial"]>[1], ip: string | null) {
    this.assert(user, "estoque.movimentar");
    for (const line of input.initial ?? []) this.assert(user, "estoque.movimentar", line.clinicId);
    await this.guard(() => this.repository.createMaterial(user.id, input, ip));
    return this.repository.snapshot();
  }

  async updateMaterial(user: AuthUser, id: string, input: Parameters<StockRepository["updateMaterial"]>[2], ip: string | null) {
    this.assert(user, "estoque.movimentar");
    await this.guard(() => this.repository.updateMaterial(user.id, id, input, ip));
    return this.repository.snapshot();
  }

  async registerMovements(user: AuthUser, lines: Parameters<StockRepository["registerMovements"]>[1], ip: string | null) {
    for (const line of lines) {
      this.assert(user, "estoque.movimentar", line.clinicId);
      if (line.toClinicId) this.assert(user, "estoque.movimentar", line.toClinicId);
    }
    await this.guard(() => this.repository.registerMovements(user.id, lines, ip));
    return this.repository.snapshot();
  }

  async createTransfer(user: AuthUser, input: Parameters<StockRepository["createTransfer"]>[1], ip: string | null) {
    this.assert(user, "estoque.movimentar", input.fromId);
    this.assert(user, "estoque.movimentar", input.toId);
    await this.guard(() => this.repository.createTransfer(user.id, input, ip));
    return this.repository.snapshot();
  }

  async advanceTransfer(user: AuthUser, id: string, ip: string | null) {
    this.assert(user, "estoque.movimentar");
    await this.guard(() => this.repository.advanceTransfer(user.id, id, ip));
    return this.repository.snapshot();
  }

  async submitInventory(user: AuthUser, input: Parameters<StockRepository["submitInventory"]>[2], ip: string | null) {
    this.assert(user, "inventario.realizar", input.branchId);
    const result = await this.guard(() => this.repository.submitInventory(user.id, user.name, input, ip));
    return { ...(await this.repository.snapshot()), result };
  }

  async reviewAdjustment(user: AuthUser, id: string, approve: boolean, note: string, ip: string | null) {
    this.assert(user, "pedidos.aprovar");
    await this.guard(() => this.repository.reviewAdjustment(user.id, user.name, id, approve, note, ip));
    return this.repository.snapshot();
  }

  async saveRecipe(user: AuthUser, name: string, items: { materialId: string; qty: number }[], ip: string | null) {
    this.assert(user, "estoque.ajustar");
    await this.guard(() => this.repository.saveRecipe(user.id, name, items, ip));
    return this.repository.snapshot();
  }

  async consumeProcedure(user: AuthUser, recipeId: string, branchId: string, repetitions: number, ip: string | null) {
    this.assert(user, "estoque.movimentar", branchId);
    await this.guard(() => this.repository.consumeProcedure(user.id, recipeId, branchId, repetitions, ip));
    return this.repository.snapshot();
  }

  async saveSettings(user: AuthUser, limit: number, alertDays: number, ip: string | null) {
    this.assert(user, "estoque.ajustar");
    await this.guard(() => this.repository.saveSettings(user.id, limit, alertDays, ip));
    return this.repository.snapshot();
  }

  async simulateDigest(user: AuthUser, branchId: string) {
    this.assert(user, "estoque.visualizar", branchId);
    await this.guard(() => this.repository.simulateDigest(user.id, branchId));
    return this.repository.snapshot();
  }

  async replenish(user: AuthUser, branchId: string, channel: "pedido" | "compra", ip: string | null) {
    this.assert(user, channel === "pedido" ? "pedidos.criar" : "compras.gerenciar", branchId);
    await this.guard(() => this.repository.replenish(user.id, branchId, channel, ip));
    return this.repository.snapshot();
  }

  async addLot(user: AuthUser, input: Parameters<StockRepository["addLot"]>[1], ip: string | null) {
    this.assert(user, "estoque.movimentar", input.clinicId);
    await this.guard(() => this.repository.addLot(user.id, input, ip));
    return this.repository.snapshot();
  }

  private assert(user: AuthUser, permission: string, branchId?: string) {
    if (!user.permissions.includes(permission)) throw new AppError(403, "FORBIDDEN", "Sem permissão para esta operação.");
    if (!branchId || user.memberships.some((membership) => membership.scope === "all")) return;
    if (!user.memberships.some((membership) => membership.branchId === branchId)) {
      throw new AppError(403, "FORBIDDEN", "Sem permissão nesta filial.");
    }
  }

  private async guard<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      if (error instanceof StockError) {
        const status = error.code === "NOT_FOUND" ? 404 : error.code === "VALIDATION" ? 400 : 409;
        throw new AppError(status, error.code, error.message);
      }
      throw error;
    }
  }
}
