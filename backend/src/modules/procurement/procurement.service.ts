import { AppError } from "../../shared/errors.js";
import type { AuthUser } from "../auth/auth.types.js";
import type { MailService } from "../mail/mail.service.js";
import { stageNoticeMail, stageRolePhrase, type StageRole } from "../mail/mail.rules.js";
import { ProcurementError, ProcurementRepository, type StageNotice } from "./procurement.repository.js";

export class ProcurementService {
  constructor(private readonly repository: ProcurementRepository, private readonly mail?: MailService) {}

  snapshot(user: AuthUser) {
    this.assertAny(user, ["pedidos.visualizar", "compras.gerenciar"]);
    return this.repository.snapshot();
  }

  saveSupplier(user: AuthUser, input: Parameters<ProcurementRepository["saveSupplier"]>[1], ip: string | null) {
    this.assert(user, "compras.gerenciar");
    return this.done(() => this.repository.saveSupplier(user.id, input, ip));
  }

  createPurchase(user: AuthUser, input: Parameters<ProcurementRepository["createPurchase"]>[1]) {
    this.assert(user, "compras.gerenciar", input.branchId);
    return this.done(() => this.repository.createPurchase(user.id, input));
  }

  addQuote(user: AuthUser, id: string, materialId: string, quote: Parameters<ProcurementRepository["addQuote"]>[3]) {
    this.assert(user, "compras.gerenciar");
    return this.done(() => this.repository.addQuote(user.id, id, materialId, quote));
  }

  approvePurchase(user: AuthUser, id: string, mode: "cost" | "balanced") {
    this.assert(user, "compras.gerenciar");
    return this.done(() => this.repository.approvePurchase(user.id, id, mode));
  }

  sendPurchase(user: AuthUser, id: string) {
    this.assert(user, "compras.gerenciar");
    return this.done(() => this.repository.sendPurchase(user.id, id));
  }

  receivePurchase(user: AuthUser, id: string, input: Parameters<ProcurementRepository["receivePurchase"]>[3], ip: string | null) {
    this.assert(user, "compras.gerenciar");
    return this.done(() => this.repository.receivePurchase(user.id, user.name, id, input, ip), true);
  }

  saveRequest(user: AuthUser, input: Parameters<ProcurementRepository["saveRequest"]>[1], send: boolean) {
    this.assertAny(user, ["pedidos.criar", "compras.gerenciar"], input.branchId);
    return this.done(() => this.repository.saveRequest(user.id, input, send));
  }

  respondRequest(user: AuthUser, id: string, items: Parameters<ProcurementRepository["respondRequest"]>[2], file?: string) {
    this.assert(user, "compras.gerenciar");
    return this.done(() => this.repository.respondRequest(user.id, id, items, file));
  }

  requestAction(user: AuthUser, id: string, action: "send" | "correction" | "approve" | "advance", note: string) {
    this.assert(user, "compras.gerenciar");
    return this.done(async () => {
      const result = await this.repository.requestAction(user.id, id, action, note);
      if (isStageNotice(result)) await this.dispatchStage(result);
    });
  }

  comment(user: AuthUser, kind: "order" | "request", id: string, note: string) {
    this.assert(user, "pedidos.visualizar");
    return this.done(() => this.repository.comment(user.id, kind, id, note));
  }

  saveOrder(user: AuthUser, input: Parameters<ProcurementRepository["saveOrder"]>[1]) {
    this.assert(user, "pedidos.criar", input.branchId);
    return this.done(() => this.repository.saveOrder(user.id, input));
  }

  orderAction(user: AuthUser, id: string, action: Parameters<ProcurementRepository["orderAction"]>[2], input: Parameters<ProcurementRepository["orderAction"]>[3]) {
    const permission = action === "pick" || action === "ship" ? "pedidos.separar" : action === "receive" || action === "close" ? "pedidos.receber" : action === "approve" || action === "reject" || action === "correct" || action === "advance" ? "pedidos.aprovar" : "pedidos.criar";
    if (action === "ship") this.assert(user, "pedidos.expedir");
    else if (action !== "approve") this.assert(user, permission);
    else if (!user.permissions.includes("pedidos.aprovar") && !user.permissions.includes("pedidos.visualizar")) this.assert(user, "pedidos.aprovar");
    return this.done(async () => {
      const result = await this.repository.orderAction(user.id, id, action, input);
      if (isStageNotice(result)) {
        await this.dispatchStage(result);
        return false;
      }
      return result;
    });
  }

  duplicateOrder(user: AuthUser, id: string) {
    this.assert(user, "pedidos.criar");
    return this.done(() => this.repository.duplicateOrder(user.id, id));
  }

  saveBudget(user: AuthUser, input: Parameters<ProcurementRepository["saveBudget"]>[1]) {
    this.assert(user, "compras.gerenciar", input.branchId);
    return this.done(() => this.repository.saveBudget(user.id, input));
  }

  saveWorkflow(user: AuthUser, kind: "cd" | "supplier", template: Parameters<ProcurementRepository["saveWorkflow"]>[2]) {
    this.assert(user, "usuarios.gerenciar");
    return this.done(() => this.repository.saveWorkflow(user.id, kind, template));
  }

  private assert(user: AuthUser, permission: string, branchId?: string) {
    if (!user.permissions.includes(permission)) throw new AppError(403, "FORBIDDEN", "Sem permissão para esta operação.");
    if (!branchId || user.memberships.some((membership) => membership.scope === "all")) return;
    if (!user.memberships.some((membership) => membership.branchId === branchId)) throw new AppError(403, "FORBIDDEN", "Sem permissão nesta filial.");
  }

  private assertAny(user: AuthUser, permissions: string[], branchId?: string) {
    if (!permissions.some((permission) => user.permissions.includes(permission))) throw new AppError(403, "FORBIDDEN", "Sem permissão para esta operação.");
    if (!branchId || user.memberships.some((membership) => membership.scope === "all")) return;
    if (!user.memberships.some((membership) => membership.branchId === branchId)) throw new AppError(403, "FORBIDDEN", "Sem permissão nesta filial.");
  }

  private async dispatchStage(notice: StageNotice) {
    if (!this.mail) return;
    try {
      const delivered = new Set<StageRole>();
      let reason = "";
      for (const recipient of notice.recipients) {
        const message = stageNoticeMail({ ...notice, roles: recipient.roles });
        const result = await this.mail.send({ to: recipient.email, subject: message.subject, text: message.text, html: message.html });
        if (result.delivered) recipient.roles.forEach((role) => delivered.add(role));
        else reason = result.reason ?? "Falha no envio.";
      }
      const order: StageRole[] = ["supplier", "assignee", "opener"];
      const sent = stageRolePhrase(order.filter((role) => delivered.has(role)));
      const missing = stageRolePhrase(order.filter((role) => notice.missing.includes(role)));
      const parts = [
        sent ? `Enviado para ${sent}.` : "",
        reason ? `Falha: ${reason}` : "",
        missing ? `Sem endereço de e-mail: ${missing}.` : "",
      ].filter(Boolean);
      await this.repository.noteStageMail(notice, parts.join(" ") || "Nenhum aviso enviado.");
    } catch {
      // O e-mail não desfaz a etapa já confirmada.
    }
  }

  private async done(run: () => Promise<unknown>, stockChanged = false) {
    try {
      const result = await run();
      const changed = stockChanged || result === true;
      return { ...(await this.repository.snapshot()), stockChanged: changed };
    } catch (error) {
      if (error instanceof ProcurementError) {
        const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : error.code === "VALIDATION" ? 400 : 409;
        throw new AppError(status, error.code, error.message);
      }
      throw error;
    }
  }
}

function isStageNotice(value: unknown): value is StageNotice {
  return typeof value === "object" && value !== null && "recipients" in value && "documentType" in value;
}
