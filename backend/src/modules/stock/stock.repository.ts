import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "../../database/pool.js";
import { transaction } from "../../database/pool.js";
import { allocateIssue, needsApproval, replenishmentQty, roundMoney, roundQty, nextTransferStatus, type StockBucket } from "./stock.rules.js";

export class StockError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "StockError";
  }
}

type Runner = Pool | PoolConnection;
type MaterialInput = {
  name: string;
  code: string;
  sku?: string;
  barcode?: string;
  approvalCertificate?: string;
  manufacturer?: string;
  description?: string;
  brand?: string;
  category: string;
  unit: string;
  cost: number;
  min: number;
  max: number;
  lotControl: boolean;
  initial?: { clinicId: string; qty: number }[];
};
type MovementLine = { type: "entrada" | "saida" | "transferencia"; materialId: string; clinicId: string; toClinicId?: string; qty: number; reason: string; document?: string };
type CountLine = { materialId: string; qty: number };

const today = () => new Date().toISOString().slice(0, 10);
const temporaryNumber = () => `T${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`;
const num = (value: unknown) => Number(value ?? 0);
const text = (value: unknown) => (value == null ? "" : String(value));
const day = (value: unknown) => text(value).slice(0, 10);

export class StockRepository {
  constructor(private readonly pool: Pool) {}

  async snapshot() {
    const [clinics, categories, materials, balances, lots, movements, transfers, transferItems, inventories, recipes, recipeItems, procedures, adjustments, adjustmentItems, digests, settings, incoming] = await Promise.all([
      this.pool.query<RowDataPacket[]>("SELECT id, name, COALESCE(city, '') AS city, type FROM branches WHERE deleted_at IS NULL AND active = 1 ORDER BY FIELD(type, 'cd', 'clinica', 'administracao'), name"),
      this.pool.query<RowDataPacket[]>("SELECT name FROM material_categories WHERE parent_id IS NULL ORDER BY name"),
      this.pool.query<RowDataPacket[]>(`SELECT m.id, m.code, COALESCE(m.sku, '') AS sku, m.name, c.name AS category, COALESCE(m.brand, '') AS brand,
        u.code AS unit, m.standard_cost AS cost, m.average_cost, m.min_qty AS min_qty, m.max_qty AS max_qty, m.lot_control, m.expiry_control,
        m.barcode, m.approval_certificate, m.description, m.anvisa_registration, m.ca_expires_at, m.abc_class, m.created_at, m.updated_at,
        man.name AS manufacturer, sup.name AS supplier
        FROM materials m
        JOIN material_categories c ON c.id = m.category_id
        JOIN units_of_measure u ON u.id = m.unit_id
        LEFT JOIN manufacturers man ON man.id = m.manufacturer_id
        LEFT JOIN suppliers sup ON sup.id = m.default_supplier_id
        WHERE m.deleted_at IS NULL AND m.active = 1
        ORDER BY m.name`),
      this.pool.query<RowDataPacket[]>(`SELECT material_id, branch_id, SUM(qty) AS qty, SUM(reserved_qty) AS reserved
        FROM stock_balances GROUP BY material_id, branch_id`),
      this.pool.query<RowDataPacket[]>(`SELECT l.id, l.material_id, b.branch_id, l.lot_number, l.expires_at, SUM(b.qty) AS qty
        FROM stock_balances b JOIN stock_lots l ON l.id = b.lot_id
        WHERE b.qty > 0 GROUP BY l.id, b.branch_id, l.material_id, l.lot_number, l.expires_at`),
      this.pool.query<RowDataPacket[]>(`SELECT i.id, mv.number, mv.type, COALESCE(mv.reason_text, r.name, '') AS reason, i.material_id, mv.branch_id, mv.to_branch_id,
        i.qty, u.name AS user_name, mv.movement_date
        FROM stock_movement_items i
        JOIN stock_movements mv ON mv.id = i.movement_id
        JOIN users u ON u.id = mv.user_id
        LEFT JOIN movement_reasons r ON r.id = mv.reason_id
        ORDER BY mv.movement_date DESC, i.id DESC LIMIT 300`),
      this.pool.query<RowDataPacket[]>(`SELECT id, number, from_branch_id, to_branch_id, status, transfer_date FROM transfers ORDER BY id DESC`),
      this.pool.query<RowDataPacket[]>("SELECT transfer_id, material_id, qty FROM transfer_items"),
      this.pool.query<RowDataPacket[]>(`SELECT i.id, i.number, i.branch_id, i.scope, i.category_id, c.name AS category, i.blind_count, i.counted_items, i.divergences,
        i.value_in, i.value_out, u.name AS user_name, COALESCE(i.finished_at, i.created_at) AS done_at
        FROM inventories i JOIN users u ON u.id = i.responsible_id LEFT JOIN material_categories c ON c.id = i.category_id
        WHERE i.status = 'concluido' ORDER BY i.id DESC`),
      this.pool.query<RowDataPacket[]>("SELECT id, name FROM procedure_recipes WHERE active = 1 ORDER BY name"),
      this.pool.query<RowDataPacket[]>("SELECT recipe_id, material_id, qty FROM procedure_recipe_items"),
      this.pool.query<RowDataPacket[]>(`SELECT p.id, r.name, p.branch_id, p.quantity, p.performed_at, u.name AS user_name
        FROM procedure_consumptions p JOIN procedure_recipes r ON r.id = p.recipe_id JOIN users u ON u.id = p.user_id
        ORDER BY p.id DESC LIMIT 40`),
      this.pool.query<RowDataPacket[]>(`SELECT a.id, a.branch_id, a.total_value, a.status, a.requester_id, a.reviewer_id, a.review_note, a.created_at, a.reviewed_at,
        a.inventory_id, req.name AS requester, rev.name AS reviewer, i.scope, i.blind_count, c.name AS category
        FROM stock_adjustments a
        JOIN users req ON req.id = a.requester_id
        LEFT JOIN users rev ON rev.id = a.reviewer_id
        LEFT JOIN inventories i ON i.id = a.inventory_id
        LEFT JOIN material_categories c ON c.id = i.category_id
        ORDER BY a.id DESC LIMIT 40`),
      this.pool.query<RowDataPacket[]>("SELECT adjustment_id, material_id, baseline_qty, counted_qty FROM stock_adjustment_items"),
      this.pool.query<RowDataPacket[]>(`SELECT id, branch_id, message, created_at FROM stock_alerts WHERE type = 'resumo' ORDER BY id DESC LIMIT 20`),
      this.pool.query<RowDataPacket[]>("SELECT approval_limit, expiry_alert_days FROM stock_settings WHERE id = 1"),
      this.pool.query<RowDataPacket[]>(`SELECT branch_id, material_id, SUM(suggested_qty) AS qty FROM replenishment_suggestions WHERE status = 'aberta' GROUP BY branch_id, material_id`),
    ]);

    const itemsByTransfer = new Map<string, { materialId: string; qty: number }[]>();
    for (const row of transferItems[0]) {
      const key = text(row.transfer_id);
      const list = itemsByTransfer.get(key) ?? [];
      list.push({ materialId: text(row.material_id), qty: num(row.qty) });
      itemsByTransfer.set(key, list);
    }
    const recipeMap = new Map<string, { materialId: string; qty: number }[]>();
    for (const row of recipeItems[0]) {
      const key = text(row.recipe_id);
      const list = recipeMap.get(key) ?? [];
      list.push({ materialId: text(row.material_id), qty: num(row.qty) });
      recipeMap.set(key, list);
    }
    const countMap = new Map<string, { counts: Record<string, number>; baseline: Record<string, number> }>();
    for (const row of adjustmentItems[0]) {
      const key = text(row.adjustment_id);
      const entry = countMap.get(key) ?? { counts: {}, baseline: {} };
      entry.counts[text(row.material_id)] = num(row.counted_qty);
      entry.baseline[text(row.material_id)] = num(row.baseline_qty);
      countMap.set(key, entry);
    }
    const setting = settings[0][0];

    return {
      clinics: clinics[0].map((row) => ({ id: text(row.id), name: text(row.name), city: text(row.city), kind: text(row.type) === "cd" ? "cd" : text(row.type) === "administracao" ? "administracao" : "clinica" })),
      categories: categories[0].map((row) => text(row.name)),
      materials: materials[0].map((row) => ({
        id: text(row.id), code: text(row.code), sku: text(row.sku), name: text(row.name), category: text(row.category), brand: text(row.brand),
        unit: text(row.unit), cost: num(row.cost), averageCost: num(row.average_cost), min: num(row.min_qty), max: num(row.max_qty),
        lotControl: Boolean(row.lot_control), expiryControl: Boolean(row.expiry_control),
        barcode: row.barcode ? text(row.barcode) : undefined, approvalCertificate: row.approval_certificate ? text(row.approval_certificate) : undefined,
        manufacturer: row.manufacturer ? text(row.manufacturer) : undefined, description: row.description ? text(row.description) : undefined,
        supplier: row.supplier ? text(row.supplier) : undefined, anvisa: row.anvisa_registration ? text(row.anvisa_registration) : undefined,
        caExpires: row.ca_expires_at ? day(row.ca_expires_at) : undefined, abcClass: row.abc_class ? text(row.abc_class) : undefined,
        createdAt: day(row.created_at), updatedAt: day(row.updated_at),
      })),
      balances: balances[0].map((row) => ({ materialId: text(row.material_id), clinicId: text(row.branch_id), qty: num(row.qty), reserved: num(row.reserved) })),
      lots: lots[0].map((row) => ({ id: text(row.id) + ":" + text(row.branch_id), materialId: text(row.material_id), clinicId: text(row.branch_id), lot: text(row.lot_number), expires: day(row.expires_at) || "2099-12-31", qty: num(row.qty) })),
      movements: movements[0].map((row) => {
        const type = text(row.type);
        const ui = type === "entrada" ? "entrada" : type === "transferencia" ? "transferencia" : "saida";
        return { id: text(row.id), number: text(row.number), type: ui, reason: text(row.reason), materialId: text(row.material_id), clinicId: text(row.branch_id), toClinicId: row.to_branch_id ? text(row.to_branch_id) : undefined, qty: num(row.qty), user: text(row.user_name), date: day(row.movement_date) };
      }),
      transfers: transfers[0].filter((row) => text(row.status) !== "cancelada").map((row) => ({
        id: text(row.id), number: text(row.number), fromId: text(row.from_branch_id), toId: text(row.to_branch_id),
        items: itemsByTransfer.get(text(row.id)) ?? [], status: text(row.status) === "cancelada" ? "solicitada" : text(row.status), date: day(row.transfer_date),
      })),
      inventories: inventories[0].map((row) => ({
        id: text(row.id), number: text(row.number), branchId: text(row.branch_id),
        scope: text(row.scope) === "completo" ? "Completo" : text(row.category) || "Categoria",
        blind: Boolean(row.blind_count), counted: num(row.counted_items), divergences: num(row.divergences),
        valueIn: num(row.value_in), valueOut: num(row.value_out), user: text(row.user_name), date: day(row.done_at),
      })),
      advanced: {
        limit: num(setting?.approval_limit ?? 500),
        alertDays: num(setting?.expiry_alert_days ?? 60),
        recipes: recipes[0].map((row) => ({ id: text(row.id), name: text(row.name), items: recipeMap.get(text(row.id)) ?? [] })),
        procedures: procedures[0].map((row) => ({ id: text(row.id), name: text(row.name), branchId: text(row.branch_id), repetitions: num(row.quantity), at: text(row.performed_at), user: text(row.user_name) })),
        adjustments: adjustments[0].map((row) => {
          const counts = countMap.get(text(row.id)) ?? { counts: {}, baseline: {} };
          const scope = text(row.scope) === "categoria" ? text(row.category) || "Categoria" : "Completo";
          return {
            id: text(row.id),
            input: { branchId: text(row.branch_id), scope, blind: Boolean(row.blind_count), counts: counts.counts, user: text(row.requester) },
            baseline: counts.baseline, value: num(row.total_value), requesterId: text(row.requester_id), status: text(row.status),
            reason: text(row.review_note), at: text(row.created_at), reviewer: row.reviewer ? text(row.reviewer) : undefined, reviewedAt: row.reviewed_at ? text(row.reviewed_at) : undefined,
          };
        }),
        digests: digests[0].map((row) => {
          const message = text(row.message);
          const count = Number(message.match(/(\d+)/)?.[1] ?? 0);
          return { id: text(row.id), branchId: text(row.branch_id), at: text(row.created_at), count, status: message };
        }),
        incoming: incoming[0].map((row) => ({ clinicId: text(row.branch_id), materialId: text(row.material_id), qty: num(row.qty) })),
      },
    };
  }

  async createMaterial(userId: string, input: MaterialInput, ip: string | null) {
    if (!input.name.trim() || !input.code.trim()) throw new StockError("VALIDATION", "Informe o nome e o código do material.");
    if (input.min < 0 || input.max < input.min) throw new StockError("VALIDATION", "Estoque máximo deve ser maior ou igual ao mínimo.");
    if (input.cost < 0) throw new StockError("VALIDATION", "Custo inválido.");
    return transaction(this.pool, async (conn) => {
      const categoryId = await this.categoryId(conn, input.category);
      if (input.category === "EPIs" && !input.approvalCertificate?.trim()) throw new StockError("VALIDATION", "Informe o Certificado de Aprovação (CA) para EPIs.");
      const unitId = await this.unitId(conn, input.unit);
      const manufacturerId = input.manufacturer?.trim() ? await this.manufacturerId(conn, input.manufacturer.trim()) : null;
      try {
        const [created] = await conn.query<ResultSetHeader>(
          `INSERT INTO materials (code, sku, barcode, name, description, category_id, brand, manufacturer_id, unit_id, approval_certificate, standard_cost, average_cost, min_qty, max_qty, lot_control, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [input.code.trim(), blank(input.sku), blank(input.barcode), input.name.trim(), input.description?.trim() || null, categoryId, input.brand?.trim() || null, manufacturerId, unitId, input.approvalCertificate?.trim() || null, input.cost, input.cost, input.min, input.max, input.lotControl ? 1 : 0],
        );
        const materialId = String(created.insertId);
        for (const line of input.initial ?? []) {
          const qty = roundQty(line.qty);
          if (qty <= 0) continue;
          await this.assertBranch(conn, line.clinicId);
          await this.receive(conn, materialId, line.clinicId, qty, input.cost);
          await this.postMovement(conn, { userId, type: "entrada", branchId: line.clinicId, reason: "Saldo inicial", document: null, materialId, qty, unitCost: input.cost, lotId: null, before: 0, after: qty });
        }
        await this.audit(conn, userId, "materials", materialId, "INSERT", `Cadastrou material ${input.name.trim()}`, ip);
        return materialId;
      } catch (error) {
        if (isDuplicate(error)) throw new StockError("CONFLICT", "Código, SKU ou código de barras já cadastrado.");
        throw error;
      }
    });
  }

  async updateMaterial(userId: string, id: string, input: Omit<MaterialInput, "initial">, ip: string | null) {
    if (!input.name.trim() || !input.code.trim()) throw new StockError("VALIDATION", "Informe o nome e o código do material.");
    if (input.min < 0 || input.max < input.min) throw new StockError("VALIDATION", "Estoque máximo deve ser maior ou igual ao mínimo.");
    if (input.cost < 0) throw new StockError("VALIDATION", "Custo inválido.");
    return transaction(this.pool, async (conn) => {
      await this.materialRow(conn, id);
      const categoryId = await this.categoryId(conn, input.category);
      if (input.category === "EPIs" && !input.approvalCertificate?.trim()) throw new StockError("VALIDATION", "Informe o Certificado de Aprovação (CA) para EPIs.");
      const unitId = await this.unitId(conn, input.unit);
      const manufacturerId = input.manufacturer?.trim() ? await this.manufacturerId(conn, input.manufacturer.trim()) : null;
      try {
        const [updated] = await conn.query<ResultSetHeader>(
          `UPDATE materials SET code = ?, sku = ?, barcode = ?, name = ?, description = ?, category_id = ?, brand = ?, manufacturer_id = ?,
             unit_id = ?, approval_certificate = ?, standard_cost = ?, min_qty = ?, max_qty = ?, lot_control = ?
           WHERE id = ? AND deleted_at IS NULL`,
          [input.code.trim(), blank(input.sku), blank(input.barcode), input.name.trim(), input.description?.trim() || null, categoryId, input.brand?.trim() || null, manufacturerId, unitId, input.approvalCertificate?.trim() || null, input.cost, input.min, input.max, input.lotControl ? 1 : 0, id],
        );
        if (!updated.affectedRows) throw new StockError("NOT_FOUND", "Material não encontrado.");
        await this.audit(conn, userId, "materials", id, "UPDATE", `Atualizou material ${input.name.trim()}`, ip);
      } catch (error) {
        if (error instanceof StockError) throw error;
        if (isDuplicate(error)) throw new StockError("CONFLICT", "Código, SKU ou código de barras já cadastrado.");
        throw error;
      }
    });
  }

  async moveOn(conn: PoolConnection, userId: string, line: { type: "entrada" | "saida"; clinicId: string; materialId: string; qty: number; reason: string; source: string }) {
    const material = await this.materialRow(conn, line.materialId);
    if (line.type === "entrada") {
      const before = await this.totalQty(conn, line.materialId, line.clinicId);
      await this.receive(conn, line.materialId, line.clinicId, line.qty, material.cost);
      await this.average(conn, line.materialId, before, line.qty, material.cost);
      await this.postMovement(conn, { userId, type: "entrada", branchId: line.clinicId, reason: line.reason, document: null, materialId: line.materialId, qty: line.qty, unitCost: material.cost, lotId: null, before, after: before + line.qty, source: line.source });
      return;
    }
    let plan = await this.issue(conn, line.materialId, line.clinicId, line.qty, material.lotControl);
    if (plan.error && material.lotControl) plan = await this.issue(conn, line.materialId, line.clinicId, line.qty, false);
    if (plan.error) throw new StockError("INSUFFICIENT", plan.error);
    const before = await this.totalQty(conn, line.materialId, line.clinicId);
    await this.postMovement(conn, { userId, type: "saida", branchId: line.clinicId, reason: line.reason, document: null, materialId: line.materialId, qty: line.qty, unitCost: material.cost, lotId: plan.allocations[0]?.lotId ?? null, before, after: Math.max(0, before - line.qty), source: line.source });
  }

  async registerMovements(userId: string, lines: MovementLine[], ip: string | null) {
    if (!lines.length) throw new StockError("VALIDATION", "Adicione ao menos um material.");
    await transaction(this.pool, async (conn) => {
      const demand = new Map<string, number>();
      for (const line of lines) {
        if (!(line.qty > 0)) throw new StockError("VALIDATION", "Quantidade deve ser maior que zero.");
        await this.assertBranch(conn, line.clinicId);
        if (line.type === "transferencia") {
          if (!line.toClinicId || line.toClinicId === line.clinicId) throw new StockError("VALIDATION", "Escolha um destino diferente da origem.");
          await this.assertBranch(conn, line.toClinicId);
        }
        if (line.type !== "entrada") demand.set(`${line.clinicId}:${line.materialId}`, (demand.get(`${line.clinicId}:${line.materialId}`) ?? 0) + line.qty);
      }
      for (const [key, qty] of demand) {
        const [clinicId, materialId] = key.split(":");
        const total = await this.totalQty(conn, materialId, clinicId);
        if (total + 0.0001 < qty) throw new StockError("INSUFFICIENT", `Saldo insuficiente de ${await this.materialName(conn, materialId)} na origem.`);
      }
      for (const line of lines) {
        const material = await this.materialRow(conn, line.materialId);
        const reason = line.document ? `${line.reason} · ${line.document}` : line.reason;
        if (line.type === "entrada") {
          const before = await this.totalQty(conn, line.materialId, line.clinicId);
          await this.receive(conn, line.materialId, line.clinicId, line.qty, material.cost);
          await this.average(conn, line.materialId, before, line.qty, material.cost);
          await this.postMovement(conn, { userId, type: "entrada", branchId: line.clinicId, reason, document: line.document ?? null, materialId: line.materialId, qty: line.qty, unitCost: material.cost, lotId: null, before, after: roundQty(before + line.qty) });
          continue;
        }
        const plan = await this.issue(conn, line.materialId, line.clinicId, line.qty, material.lotControl && line.reason.startsWith("Procedimento"));
        if (plan.error) throw new StockError("INSUFFICIENT", `${plan.error} · ${material.name}.`);
        for (const part of plan.allocations) {
          await this.postMovement(conn, { userId, type: line.type === "transferencia" ? "transferencia" : "saida", branchId: line.clinicId, toBranchId: line.toClinicId, reason, document: line.document ?? null, materialId: line.materialId, qty: part.qty, unitCost: material.cost, lotId: part.lotId, before: part.before, after: part.after });
          if (line.type === "transferencia" && line.toClinicId) await this.receive(conn, line.materialId, line.toClinicId, part.qty, material.cost, part.lotId);
        }
      }
      await this.audit(conn, userId, "stock_movements", "0", "INSERT", `Registrou ${lines.length} movimentação(ões)`, ip);
    });
  }

  async createTransfer(userId: string, input: { fromId: string; toId: string; items: { materialId: string; qty: number }[] }, ip: string | null) {
    if (input.fromId === input.toId) throw new StockError("VALIDATION", "Origem e destino devem ser diferentes.");
    if (!input.items.length || input.items.some((item) => !(item.qty > 0))) throw new StockError("VALIDATION", "Adicione itens com quantidade maior que zero.");
    return transaction(this.pool, async (conn) => {
      await this.assertBranch(conn, input.fromId);
      await this.assertBranch(conn, input.toId);
      for (const item of input.items) {
        const total = await this.totalQty(conn, item.materialId, input.fromId);
        if (total + 0.0001 < item.qty) throw new StockError("INSUFFICIENT", `Saldo insuficiente de ${await this.materialName(conn, item.materialId)} na origem.`);
      }
      const [created] = await conn.query<ResultSetHeader>(
        `INSERT INTO transfers (number, from_branch_id, to_branch_id, status, priority, requested_by, transfer_date)
         VALUES (?, ?, ?, 'solicitada', 'normal', ?, UTC_DATE())`,
        [temporaryNumber(), input.fromId, input.toId, userId],
      );
      const number = `TRF-${String(created.insertId).padStart(6, "0")}`;
      await conn.query("UPDATE transfers SET number = ? WHERE id = ?", [number, created.insertId]);
      for (const item of input.items) {
        await conn.query("INSERT INTO transfer_items (transfer_id, material_id, qty) VALUES (?, ?, ?)", [created.insertId, item.materialId, roundQty(item.qty)]);
      }
      await this.event(conn, "transfer", created.insertId, "criado", null, "solicitada", userId);
      await this.audit(conn, userId, "transfers", String(created.insertId), "INSERT", `Solicitou ${number}`, ip);
      return number;
    });
  }

  async advanceTransfer(userId: string, transferId: string, ip: string | null) {
    return transaction(this.pool, async (conn) => {
      const [rows] = await conn.query<RowDataPacket[]>("SELECT id, number, from_branch_id, to_branch_id, status FROM transfers WHERE id = ? FOR UPDATE", [transferId]);
      const transfer = rows[0];
      if (!transfer) throw new StockError("NOT_FOUND", "Transferência não encontrada.");
      const next = nextTransferStatus(text(transfer.status));
      if (!next) throw new StockError("CONFLICT", "Esta transferência já foi concluída.");
      const [items] = await conn.query<RowDataPacket[]>("SELECT id, material_id, qty, shipped_qty FROM transfer_items WHERE transfer_id = ? FOR UPDATE", [transferId]);
      if (next === "transito") {
        for (const item of items) {
          const material = await this.materialRow(conn, text(item.material_id));
          const plan = await this.issue(conn, text(item.material_id), text(transfer.from_branch_id), num(item.qty), false);
          if (plan.error) throw new StockError("INSUFFICIENT", `${plan.error} para expedir ${material.name}.`);
          await conn.query("UPDATE transfer_items SET shipped_qty = ? WHERE id = ?", [roundQty(num(item.qty)), item.id]);
        }
        await conn.query("UPDATE transfers SET status = ?, shipped_at = UTC_TIMESTAMP() WHERE id = ?", [next, transferId]);
      } else if (next === "recebida") {
        for (const item of items) {
          const material = await this.materialRow(conn, text(item.material_id));
          const qty = num(item.shipped_qty) || num(item.qty);
          const before = await this.totalQty(conn, text(item.material_id), text(transfer.to_branch_id));
          await this.receive(conn, text(item.material_id), text(transfer.to_branch_id), qty, material.cost);
          await conn.query("UPDATE transfer_items SET received_qty = ? WHERE id = ?", [roundQty(qty), item.id]);
          await this.postMovement(conn, { userId, type: "transferencia", branchId: text(transfer.from_branch_id), toBranchId: text(transfer.to_branch_id), reason: `Transferência ${text(transfer.number)}`, document: text(transfer.number), materialId: text(item.material_id), qty, unitCost: material.cost, lotId: null, before, after: roundQty(before + qty), source: "transferencia", sourceId: transferId });
        }
        await conn.query("UPDATE transfers SET status = ?, received_at = UTC_TIMESTAMP(), received_by = ? WHERE id = ?", [next, userId, transferId]);
      } else {
        await conn.query("UPDATE transfers SET status = ? WHERE id = ?", [next, transferId]);
      }
      await this.event(conn, "transfer", Number(transferId), "avancou", text(transfer.status), next, userId);
      await this.audit(conn, userId, "transfers", transferId, "UPDATE", `${text(transfer.number)}: ${text(transfer.status)} → ${next}`, ip);
      return next;
    });
  }

  async submitInventory(userId: string, userName: string, input: { branchId: string; scope: string; blind: boolean; counts: CountLine[] }, ip: string | null) {
    if (!input.counts.length || input.counts.some((line) => !Number.isFinite(line.qty) || line.qty < 0)) throw new StockError("VALIDATION", "Informe contagens válidas e não negativas.");
    return transaction(this.pool, async (conn) => {
      await this.assertBranch(conn, input.branchId);
      const scope = await this.scopeOf(conn, input.scope);
      const settings = await this.settings(conn);
      let value = 0;
      const prepared: { materialId: string; baseline: number; counted: number; cost: number }[] = [];
      for (const line of input.counts) {
        const material = await this.materialRow(conn, line.materialId);
        await this.buckets(conn, line.materialId, input.branchId);
        const baseline = await this.totalQty(conn, line.materialId, input.branchId);
        value += Math.abs(line.qty - baseline) * material.cost;
        prepared.push({ materialId: line.materialId, baseline, counted: roundQty(line.qty), cost: material.cost });
      }
      value = roundMoney(value);
      const pending = needsApproval(value, settings.limit);
      const inventoryId = await this.insertInventory(conn, { branchId: input.branchId, scope: scope.scope, categoryId: scope.categoryId, blind: input.blind, userId, status: pending ? "aguardando_ajuste" : "concluido", rows: prepared });
      if (pending) {
        const adjustmentId = await this.insertAdjustment(conn, { branchId: input.branchId, inventoryId, userId, value, rows: prepared, status: "pendente" });
        await this.audit(conn, userId, "stock_adjustments", String(adjustmentId), "INSERT", `Contagem de ${userName} aguardando aprovação`, ip);
        return { pending: true as const, number: "" };
      }
      await this.applyCount(conn, userId, input.branchId, prepared);
      const number = await this.inventoryNumber(conn, inventoryId);
      await this.audit(conn, userId, "inventories", String(inventoryId), "INSERT", `Concluiu ${number}`, ip);
      return { pending: false as const, number };
    });
  }

  async reviewAdjustment(userId: string, userName: string, adjustmentId: string, approve: boolean, note: string, ip: string | null) {
    if (!note.trim()) throw new StockError("VALIDATION", "Informe o parecer.");
    return transaction(this.pool, async (conn) => {
      const [rows] = await conn.query<RowDataPacket[]>("SELECT id, branch_id, status, requester_id, inventory_id FROM stock_adjustments WHERE id = ? FOR UPDATE", [adjustmentId]);
      const adjustment = rows[0];
      if (!adjustment || text(adjustment.status) !== "pendente") throw new StockError("CONFLICT", "Ajuste não está pendente.");
      if (text(adjustment.requester_id) === userId) throw new StockError("CONFLICT", "Outro gestor deve revisar este ajuste.");
      const [items] = await conn.query<RowDataPacket[]>("SELECT material_id, baseline_qty, counted_qty, unit_cost FROM stock_adjustment_items WHERE adjustment_id = ?", [adjustmentId]);
      if (approve) {
        for (const item of items) {
          const locked = await this.buckets(conn, text(item.material_id), text(adjustment.branch_id));
          const current = roundQty(locked.reduce((sum, bucket) => sum + bucket.qty, 0));
          if (Math.abs(current - num(item.baseline_qty)) > 0.001) throw new StockError("STALE", "O saldo mudou após a contagem. Rejeite e faça nova contagem.");
        }
        await this.applyCount(conn, userId, text(adjustment.branch_id), items.map((item) => ({ materialId: text(item.material_id), baseline: num(item.baseline_qty), counted: num(item.counted_qty), cost: num(item.unit_cost) })));
        if (adjustment.inventory_id) await this.finishInventory(conn, text(adjustment.inventory_id), items.map((item) => ({ baseline: num(item.baseline_qty), counted: num(item.counted_qty), cost: num(item.unit_cost) })));
      } else if (adjustment.inventory_id) {
        await conn.query("UPDATE inventories SET status = 'cancelado' WHERE id = ?", [adjustment.inventory_id]);
      }
      await conn.query("UPDATE stock_adjustments SET status = ?, reviewer_id = ?, reviewed_at = UTC_TIMESTAMP(), review_note = ? WHERE id = ?", [approve ? "aprovado" : "rejeitado", userId, note.trim(), adjustmentId]);
      await this.audit(conn, userId, "stock_adjustments", adjustmentId, "UPDATE", `${approve ? "Aprovou" : "Rejeitou"} ajuste · ${userName}`, ip);
    });
  }

  async saveRecipe(userId: string, name: string, items: { materialId: string; qty: number }[], ip: string | null) {
    if (!name.trim() || !items.length || items.some((item) => !(item.qty > 0))) throw new StockError("VALIDATION", "Informe nome e materiais com quantidades positivas.");
    await transaction(this.pool, async (conn) => {
      const [created] = await conn.query<ResultSetHeader>("INSERT INTO procedure_recipes (name, active) VALUES (?, 1)", [name.trim()]);
      for (const item of items) {
        await this.materialRow(conn, item.materialId);
        await conn.query("INSERT INTO procedure_recipe_items (recipe_id, material_id, qty) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)", [created.insertId, item.materialId, roundQty(item.qty)]);
      }
      await this.audit(conn, userId, "procedure_recipes", String(created.insertId), "INSERT", `Cadastrou ficha ${name.trim()}`, ip);
    });
  }

  async consumeProcedure(userId: string, recipeId: string, branchId: string, repetitions: number, ip: string | null) {
    if (!Number.isInteger(repetitions) || repetitions <= 0) throw new StockError("VALIDATION", "Informe um número inteiro de procedimentos.");
    const [recipes] = await this.pool.query<RowDataPacket[]>("SELECT id, name FROM procedure_recipes WHERE id = ? AND active = 1", [recipeId]);
    if (!recipes[0]) throw new StockError("NOT_FOUND", "Ficha não encontrada.");
    const [items] = await this.pool.query<RowDataPacket[]>("SELECT material_id, qty FROM procedure_recipe_items WHERE recipe_id = ?", [recipeId]);
    const merged = new Map<string, number>();
    for (const item of items) merged.set(text(item.material_id), (merged.get(text(item.material_id)) ?? 0) + num(item.qty) * repetitions);
    const lines = [...merged].map(([materialId, qty]) => ({ type: "saida" as const, materialId, clinicId: branchId, qty: roundQty(qty), reason: `Procedimento · ${text(recipes[0].name)}` }));
    await this.registerMovements(userId, lines, ip);
    await this.pool.query("INSERT INTO procedure_consumptions (recipe_id, branch_id, quantity, user_id) VALUES (?, ?, ?, ?)", [recipeId, branchId, repetitions, userId]);
  }

  async saveSettings(userId: string, limit: number, alertDays: number, ip: string | null) {
    if (!Number.isFinite(limit) || limit < 0 || !Number.isInteger(alertDays) || alertDays < 1) throw new StockError("VALIDATION", "Limite e antecedência inválidos.");
    await this.pool.query("UPDATE stock_settings SET approval_limit = ?, expiry_alert_days = ? WHERE id = 1", [roundMoney(limit), alertDays]);
    await this.pool.query("UPDATE stock_alert_rules SET days_before = ? WHERE type = 'vencimento' AND branch_id IS NULL", [alertDays]);
    await this.audit(this.pool, userId, "stock_settings", "1", "UPDATE", "Atualizou políticas de estoque", ip);
  }

  async simulateDigest(userId: string, branchId: string) {
    await this.assertBranch(this.pool, branchId);
    const snap = await this.snapshot();
    const horizon = new Date(Date.now() + snap.advanced.alertDays * 86400000).toISOString().slice(0, 10);
    const lows = snap.balances.filter((row) => row.clinicId === branchId && row.qty - row.reserved < (snap.materials.find((material) => material.id === row.materialId)?.min ?? 0)).length;
    const expiring = snap.lots.filter((row) => row.clinicId === branchId && row.qty > 0 && row.expires <= horizon).length;
    await this.pool.query(
      "INSERT INTO stock_alerts (branch_id, type, severity, message) VALUES (?, 'resumo', 'info', ?)",
      [branchId, `Simulado · não enviado · ${lows + expiring} alertas`],
    );
    await this.audit(this.pool, userId, "stock_alerts", branchId, "INSERT", "Simulou resumo de estoque", null);
  }

  async replenish(userId: string, branchId: string, channel: "pedido" | "compra", ip: string | null) {
    const snap = await this.snapshot();
    const cd = snap.clinics.find((clinic) => clinic.kind === "cd")?.id;
    const rows = suggestionsFor(snap, branchId, channel, cd);
    if (!rows.length) throw new StockError("CONFLICT", "Não há reposição pendente para este destino.");
    await transaction(this.pool, async (conn) => {
      for (const row of rows) {
        await conn.query(
          `INSERT INTO replenishment_suggestions (branch_id, material_id, current_qty, avg_daily_consumption, coverage_days, suggested_qty, status)
           VALUES (?, ?, ?, ?, ?, ?, 'aberta')`,
          [branchId, row.materialId, row.available, row.daily, row.coverage, row.qty],
        );
      }
      await this.audit(conn, userId, "replenishment_suggestions", branchId, "INSERT", `Registrou reposição via ${channel}`, ip);
    });
  }

  async addLot(userId: string, input: { materialId: string; clinicId: string; lot: string; expires: string; qty: number }, ip: string | null) {
    if (!input.lot.trim()) throw new StockError("VALIDATION", "Informe o número do lote.");
    if (!(input.qty > 0)) throw new StockError("VALIDATION", "Quantidade deve ser maior que zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expires)) throw new StockError("VALIDATION", "Informe a validade.");
    await transaction(this.pool, async (conn) => {
      await this.assertBranch(conn, input.clinicId);
      const material = await this.materialRow(conn, input.materialId);
      const [found] = await conn.query<RowDataPacket[]>("SELECT id FROM stock_lots WHERE material_id = ? AND lot_number = ?", [input.materialId, input.lot.trim()]);
      let lotId = found[0] ? text(found[0].id) : "";
      if (!lotId) {
        const [created] = await conn.query<ResultSetHeader>("INSERT INTO stock_lots (material_id, lot_number, expires_at) VALUES (?, ?, ?)", [input.materialId, input.lot.trim(), input.expires]);
        lotId = String(created.insertId);
      }
      const before = await this.totalQty(conn, input.materialId, input.clinicId);
      await this.receive(conn, input.materialId, input.clinicId, input.qty, material.cost, lotId);
      await this.postMovement(conn, { userId, type: "entrada", branchId: input.clinicId, reason: `Lote ${input.lot.trim()}`, document: null, materialId: input.materialId, qty: roundQty(input.qty), unitCost: material.cost, lotId, before, after: roundQty(before + input.qty) });
      await conn.query("UPDATE materials SET lot_control = 1 WHERE id = ?", [input.materialId]);
      await this.audit(conn, userId, "stock_lots", lotId, "INSERT", `Registrou lote ${input.lot.trim()}`, ip);
    });
  }

  private async categoryId(conn: Runner, name: string) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM material_categories WHERE name = ? LIMIT 1", [name]);
    if (!rows[0]) throw new StockError("VALIDATION", "Categoria inválida.");
    return rows[0].id;
  }

  private async unitId(conn: Runner, code: string) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM units_of_measure WHERE code = ? LIMIT 1", [code]);
    if (!rows[0]) throw new StockError("VALIDATION", "Unidade de medida inválida.");
    return rows[0].id;
  }

  private async manufacturerId(conn: Runner, name: string) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM manufacturers WHERE name = ? LIMIT 1", [name]);
    if (rows[0]) return rows[0].id;
    const [created] = await conn.query<ResultSetHeader>("INSERT INTO manufacturers (name) VALUES (?)", [name]);
    return created.insertId;
  }

  private async assertBranch(conn: Runner, id: string) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM branches WHERE id = ? AND deleted_at IS NULL AND active = 1", [id]);
    if (!rows[0]) throw new StockError("VALIDATION", "Filial inválida.");
  }

  private async materialRow(conn: Runner, id: string) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id, name, standard_cost AS cost, lot_control FROM materials WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!rows[0]) throw new StockError("NOT_FOUND", "Material não encontrado.");
    return { id: text(rows[0].id), name: text(rows[0].name), cost: num(rows[0].cost), lotControl: Boolean(rows[0].lot_control) };
  }

  private async materialName(conn: Runner, id: string) {
    return (await this.materialRow(conn, id)).name;
  }

  private async warehouseId(conn: Runner, branchId: string) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM warehouses WHERE branch_id = ? AND active = 1 ORDER BY is_default DESC, id LIMIT 1", [branchId]);
    if (rows[0]) return text(rows[0].id);
    const [created] = await conn.query<ResultSetHeader>("INSERT INTO warehouses (branch_id, code, name, is_default, active) VALUES (?, 'PRIN', 'Principal', 1, 1)", [branchId]);
    return String(created.insertId);
  }

  private async totalQty(conn: Runner, materialId: string, branchId: string) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT COALESCE(SUM(qty), 0) AS qty FROM stock_balances WHERE material_id = ? AND branch_id = ?", [materialId, branchId]);
    return num(rows[0]?.qty);
  }

  private async buckets(conn: Runner, materialId: string, branchId: string): Promise<StockBucket[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT b.id, b.qty, b.lot_id, l.expires_at FROM stock_balances b
       LEFT JOIN stock_lots l ON l.id = b.lot_id
       WHERE b.material_id = ? AND b.branch_id = ? FOR UPDATE`,
      [materialId, branchId],
    );
    return rows.map((row) => ({ id: text(row.id), qty: num(row.qty), lotId: row.lot_id ? text(row.lot_id) : null, expires: row.expires_at ? day(row.expires_at) : null }));
  }

  private async issue(conn: Runner, materialId: string, branchId: string, qty: number, lotControl: boolean) {
    const plan = allocateIssue(await this.buckets(conn, materialId, branchId), qty, lotControl, today());
    if (plan.error) return plan;
    for (const part of plan.allocations) await conn.query("UPDATE stock_balances SET qty = ? WHERE id = ?", [part.after, part.id]);
    return plan;
  }

  private async receive(conn: Runner, materialId: string, branchId: string, qty: number, _cost: number, lotId: string | null = null) {
    const warehouseId = await this.warehouseId(conn, branchId);
    const amount = roundQty(qty);
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, qty FROM stock_balances WHERE material_id = ? AND branch_id = ? AND warehouse_id = ? AND location_id IS NULL AND ${lotId ? "lot_id = ?" : "lot_id IS NULL"} ORDER BY id LIMIT 1 FOR UPDATE`,
      lotId ? [materialId, branchId, warehouseId, lotId] : [materialId, branchId, warehouseId],
    );
    if (rows[0]) await conn.query("UPDATE stock_balances SET qty = ? WHERE id = ?", [roundQty(num(rows[0].qty) + amount), rows[0].id]);
    else await conn.query("INSERT INTO stock_balances (material_id, branch_id, warehouse_id, lot_id, qty, reserved_qty) VALUES (?, ?, ?, ?, ?, 0)", [materialId, branchId, warehouseId, lotId, amount]);
  }

  private async average(conn: Runner, materialId: string, before: number, qty: number, cost: number) {
    await conn.query("UPDATE materials SET average_cost = IF(? + ? = 0, average_cost, ((average_cost * ?) + (? * ?)) / (? + ?)) WHERE id = ?", [before, qty, before, cost, qty, before, qty, materialId]);
  }

  private async postMovement(conn: Runner, input: { userId: string; type: "entrada" | "saida" | "transferencia"; branchId: string; toBranchId?: string; reason: string; document: string | null; materialId: string; qty: number; unitCost: number; lotId: string | null; before: number; after: number; source?: string; sourceId?: string }) {
    const reasonId = await this.reasonId(conn, input.reason, input.type);
    const [created] = await conn.query<ResultSetHeader>(
      `INSERT INTO stock_movements (number, type, reason_id, reason_text, branch_id, to_branch_id, source_type, source_id, document_number, user_id, movement_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [temporaryNumber(), input.type, reasonId, input.reason.slice(0, 200), input.branchId, input.toBranchId ?? null, input.source ?? "manual", input.sourceId ?? null, input.document, input.userId],
    );
    await conn.query("UPDATE stock_movements SET number = ? WHERE id = ?", [`MOV-${String(created.insertId).padStart(6, "0")}`, created.insertId]);
    await conn.query(
      `INSERT INTO stock_movement_items (movement_id, material_id, lot_id, qty, unit_cost, qty_before, qty_after) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [created.insertId, input.materialId, input.lotId, roundQty(input.qty), input.unitCost, input.before, input.after],
    );
  }

  private async reasonId(conn: Runner, reason: string, type: string) {
    const code = reason.startsWith("Procedimento") ? "procedimento" : reason.startsWith("Compra") ? "compra" : reason.startsWith("Devolução") ? "devolucao" : reason.startsWith("Perda") ? "perda" : reason.startsWith("Descarte") ? "vencimento" : reason.includes("Ajuste") ? "ajuste_inventario" : type === "transferencia" ? "transferencia" : reason.startsWith("Consumo") ? "consumo" : null;
    if (!code) return null;
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM movement_reasons WHERE code = ?", [code]);
    return rows[0]?.id ?? null;
  }

  private async settings(conn: Runner) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT approval_limit, expiry_alert_days FROM stock_settings WHERE id = 1");
    return { limit: num(rows[0]?.approval_limit ?? 500), alertDays: num(rows[0]?.expiry_alert_days ?? 60) };
  }

  private async scopeOf(conn: Runner, scope: string) {
    if (scope === "Completo") return { scope: "completo", categoryId: null };
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM material_categories WHERE name = ? LIMIT 1", [scope]);
    if (!rows[0]) throw new StockError("VALIDATION", "Escopo inválido.");
    return { scope: "categoria", categoryId: rows[0].id };
  }

  private async insertInventory(conn: Runner, input: { branchId: string; scope: string; categoryId: unknown; blind: boolean; userId: string; status: string; rows: { baseline: number; counted: number; cost: number }[] }) {
    const divergences = input.rows.filter((row) => Math.abs(row.counted - row.baseline) > 0.001).length;
    const valueIn = roundMoney(input.rows.filter((row) => row.counted > row.baseline).reduce((sum, row) => sum + (row.counted - row.baseline) * row.cost, 0));
    const valueOut = roundMoney(input.rows.filter((row) => row.counted < row.baseline).reduce((sum, row) => sum + (row.baseline - row.counted) * row.cost, 0));
    const [created] = await conn.query<ResultSetHeader>(
      `INSERT INTO inventories (number, branch_id, scope, category_id, blind_count, status, counted_items, divergences, value_in, value_out, responsible_id, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), IF(? = 'concluido', UTC_TIMESTAMP(), NULL))`,
      [temporaryNumber(), input.branchId, input.scope, input.categoryId, input.blind ? 1 : 0, input.status, input.rows.length, divergences, valueIn, valueOut, input.userId, input.status],
    );
    await conn.query("UPDATE inventories SET number = ? WHERE id = ?", [`INV-${String(created.insertId).padStart(6, "0")}`, created.insertId]);
    return created.insertId;
  }

  private async inventoryNumber(conn: Runner, id: number) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT number FROM inventories WHERE id = ?", [id]);
    return text(rows[0]?.number);
  }

  private async finishInventory(conn: Runner, id: string, rows: { baseline: number; counted: number; cost: number }[]) {
    const divergences = rows.filter((row) => Math.abs(row.counted - row.baseline) > 0.001).length;
    const valueIn = roundMoney(rows.filter((row) => row.counted > row.baseline).reduce((sum, row) => sum + (row.counted - row.baseline) * row.cost, 0));
    const valueOut = roundMoney(rows.filter((row) => row.counted < row.baseline).reduce((sum, row) => sum + (row.baseline - row.counted) * row.cost, 0));
    await conn.query("UPDATE inventories SET status = 'concluido', counted_items = ?, divergences = ?, value_in = ?, value_out = ?, finished_at = UTC_TIMESTAMP() WHERE id = ?", [rows.length, divergences, valueIn, valueOut, id]);
  }

  private async insertAdjustment(conn: Runner, input: { branchId: string; inventoryId: number; userId: string; value: number; status: string; rows: { materialId: string; baseline: number; counted: number; cost: number }[] }) {
    const [created] = await conn.query<ResultSetHeader>(
      `INSERT INTO stock_adjustments (number, branch_id, inventory_id, reason, total_value, status, requester_id)
       VALUES (?, ?, ?, 'Contagem de inventário', ?, ?, ?)`,
      [temporaryNumber(), input.branchId, input.inventoryId, input.value, input.status, input.userId],
    );
    await conn.query("UPDATE stock_adjustments SET number = ? WHERE id = ?", [`AJU-${String(created.insertId).padStart(6, "0")}`, created.insertId]);
    for (const row of input.rows) {
      await conn.query("INSERT INTO stock_adjustment_items (adjustment_id, material_id, baseline_qty, counted_qty, unit_cost) VALUES (?, ?, ?, ?, ?)", [created.insertId, row.materialId, row.baseline, row.counted, row.cost]);
    }
    return created.insertId;
  }

  private async applyCount(conn: Runner, userId: string, branchId: string, rows: { materialId: string; baseline: number; counted: number; cost: number }[]) {
    for (const row of rows) {
      const diff = roundQty(row.counted - row.baseline);
      if (Math.abs(diff) < 0.001) continue;
      if (diff > 0) {
        const before = await this.totalQty(conn, row.materialId, branchId);
        await this.receive(conn, row.materialId, branchId, diff, row.cost);
        await this.postMovement(conn, { userId, type: "entrada", branchId, reason: "Ajuste de inventário", document: null, materialId: row.materialId, qty: diff, unitCost: row.cost, lotId: null, before, after: roundQty(before + diff), source: "inventario" });
      } else {
        const plan = await this.issue(conn, row.materialId, branchId, Math.abs(diff), false);
        if (plan.error) throw new StockError("INSUFFICIENT", plan.error);
        for (const part of plan.allocations) {
          await this.postMovement(conn, { userId, type: "saida", branchId, reason: "Ajuste de inventário", document: null, materialId: row.materialId, qty: part.qty, unitCost: row.cost, lotId: part.lotId, before: part.before, after: part.after, source: "inventario" });
        }
      }
    }
  }

  private async event(conn: Runner, type: string, id: number, action: string, from: string | null, to: string, userId: string) {
    await conn.query(
      "INSERT INTO document_events (document_type, document_id, action, from_status, to_status, user_id) VALUES (?, ?, ?, ?, ?, ?)",
      [type, id, action, from, to, userId],
    );
  }

  private async audit(conn: Runner, userId: string, table: string, recordId: string, operation: "INSERT" | "UPDATE", event: string, ip: string | null) {
    try {
      await conn.query(
        "INSERT INTO audit_logs (user_id, table_name, record_id, operation, new_values, ip) VALUES (?, ?, ?, ?, JSON_OBJECT('event', ?), ?)",
        [userId, table, recordId, operation, event, ip],
      );
    } catch {
      // A trilha não desfaz a operação de estoque.
    }
  }
}

function blank(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isDuplicate(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ER_DUP_ENTRY";
}

function suggestionsFor(snap: Awaited<ReturnType<StockRepository["snapshot"]>>, branchId: string, channel: "pedido" | "compra", cdId?: string) {
  const since = Date.now() - 30 * 86400000;
  return snap.materials.flatMap((material) => {
    const balance = snap.balances.find((row) => row.materialId === material.id && row.clinicId === branchId);
    const available = Math.max(0, (balance?.qty ?? 0) - (balance?.reserved ?? 0));
    const incoming = snap.advanced.incoming.filter((row) => row.materialId === material.id && row.clinicId === branchId).reduce((sum, row) => sum + row.qty, 0);
    const consumption = snap.movements.filter((row) => row.type === "saida" && row.materialId === material.id && row.clinicId === branchId && !/Ajuste|Expedição/.test(row.reason) && Date.parse(row.date) >= since).reduce((sum, row) => sum + row.qty, 0);
    const daily = consumption / 30;
    const coverage = daily > 0 ? Math.floor(available / daily) : null;
    const qty = replenishmentQty(material.min, material.max, available, incoming);
    if (qty <= 0) return [];
    const source = cdId ? Math.max(0, (snap.balances.find((row) => row.materialId === material.id && row.clinicId === cdId)?.qty ?? 0)) : 0;
    const suggested = branchId !== cdId && source > 0 ? "pedido" : "compra";
    if (suggested !== channel) return [];
    return [{ materialId: material.id, available, daily: roundQty(daily), coverage, qty }];
  });
}
