import type { Pool, ResultSetHeader, RowDataPacket } from "../../database/pool.js";
import { transaction } from "../../database/pool.js";
import type { StockRepository } from "../stock/stock.repository.js";
import type { StageRole } from "../mail/mail.rules.js";
import { validEmail } from "../mail/mail.rules.js";
import { digits, quoteTotal, rankQuotes, stepApplies } from "./procurement.rules.js";

export class ProcurementError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ProcurementError";
  }
}

type Step = { id: string; name: string; assigneeType: "user" | "role"; assigneeId: string; hours: number; requireNote: boolean; minValue?: number; maxValue?: number; branchId?: string; category?: string; color?: string };
export type StageNotice = {
  documentType: "material_order" | "supplier_request";
  documentId: number;
  actorId: string;
  number: string;
  branch: string;
  supplier?: string;
  fromStage: string;
  toStage: string;
  note: string;
  actor: string;
  recipients: { email: string; roles: StageRole[] }[];
  missing: StageRole[];
};
type Workflow = { candidates?: Step[]; name: string; steps: Step[]; index: number; startedAt: string; decisions: { stepId: string; userId: string; at: string; note: string }[]; situation?: number; moves?: { stepId: string; userId: string; at: string; note?: string }[] };
type Runner = Parameters<Parameters<typeof transaction>[1]>[0];

const text = (value: unknown) => (value == null ? "" : String(value));
const num = (value: unknown) => Number(value ?? 0);
const day = (value: unknown) => text(value).slice(0, 10);
const stamp = (value: unknown) => {
  const raw = text(value);
  if (!raw) return new Date().toISOString();
  if (raw.includes("T")) return raw;
  return `${raw.replace(" ", "T")}Z`;
};
const json = <T>(value: unknown, fallback: T): T => {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
};
const cnpjMask = (value: string) => value.length === 14 ? `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12)}` : value;
const month = () => new Date().toISOString().slice(0, 7);
const keyOf = (prefix: string, id: unknown) => `${prefix}${text(id)}`;
const plainId = (value: string, prefix: string) => {
  if (!value.startsWith(prefix) || !/^\d+$/.test(value.slice(prefix.length))) throw new ProcurementError("VALIDATION", "Identificador inválido.");
  return value.slice(prefix.length);
};

export class ProcurementRepository {
  constructor(private readonly pool: Pool, private readonly stock: StockRepository) {}

  async allowed(userId: string, permission: string, branchId?: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1 AS ok FROM user_branch_memberships m
       JOIN erp_roles r ON r.id = m.role_id
       JOIN erp_role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE m.user_id = ? AND p.code = ? AND (? IS NULL OR r.scope = 'all' OR m.branch_id = ?) LIMIT 1`,
      [userId, permission, branchId ?? null, branchId ?? null],
    );
    return Boolean(rows[0]);
  }

  async snapshot() {
    const [branches, users, memberships, roles, suppliers, categories, portals, orders, orderItems, purchases, purchaseItems, quotes, receipts, receiptItems, requests, requestItems, responses, responseItems, budgets, commitments, templates, metas, events, links] = await Promise.all([
      this.pool.query<RowDataPacket[]>(`SELECT b.id, b.name, b.type, b.active, COALESCE(cc.code, b.code) AS cost_center FROM branches b LEFT JOIN cost_centers cc ON cc.id = b.cost_center_id WHERE b.deleted_at IS NULL ORDER BY b.name`),
      this.pool.query<RowDataPacket[]>("SELECT id, name, email, COALESCE(initials, '') AS initials FROM users WHERE deleted_at IS NULL AND user_type = 'interno' ORDER BY name"),
      this.pool.query<RowDataPacket[]>("SELECT user_id, branch_id, role_id FROM user_branch_memberships"),
      this.pool.query<RowDataPacket[]>(`SELECT r.id, r.name, COALESCE(r.description, '') AS description, r.scope, p.code AS permission
        FROM erp_roles r LEFT JOIN erp_role_permissions rp ON rp.role_id = r.id LEFT JOIN permissions p ON p.id = rp.permission_id ORDER BY r.name`),
      this.pool.query<RowDataPacket[]>("SELECT id, name, cnpj, contact_name, email, phone, address, city, state, lead_days, rating, notes, portal_enabled FROM suppliers WHERE deleted_at IS NULL ORDER BY name"),
      this.pool.query<RowDataPacket[]>(`SELECT sc.supplier_id, c.name FROM supplier_categories sc JOIN material_categories c ON c.id = sc.category_id`),
      this.pool.query<RowDataPacket[]>("SELECT supplier_id, contact_name, email FROM supplier_portal_profiles"),
      this.pool.query<RowDataPacket[]>("SELECT id, number, branch_id, source_branch_id, requester_id, priority, status, desired_date, notes, created_at FROM material_orders ORDER BY id DESC"),
      this.pool.query<RowDataPacket[]>("SELECT order_id, material_id, requested_qty, approved_qty, picked_qty, shipped_qty, received_qty, note FROM material_order_items"),
      this.pool.query<RowDataPacket[]>("SELECT id, number, branch_id, status, created_at, supplier_request_id FROM purchase_orders ORDER BY id DESC"),
      this.pool.query<RowDataPacket[]>("SELECT id, purchase_order_id, material_id, qty, received_qty, chosen_supplier_id FROM purchase_order_items"),
      this.pool.query<RowDataPacket[]>("SELECT purchase_order_item_id, supplier_id, unit_price, delivery_days, freight FROM purchase_quotes"),
      this.pool.query<RowDataPacket[]>("SELECT r.id, r.purchase_order_id, r.notes, r.received_at, u.name AS user_name FROM purchase_receipts r JOIN users u ON u.id = r.user_id ORDER BY r.id"),
      this.pool.query<RowDataPacket[]>("SELECT ri.receipt_id, poi.material_id, ri.accepted_qty, ri.damaged_qty, ri.actual_price FROM purchase_receipt_items ri JOIN purchase_order_items poi ON poi.id = ri.purchase_order_item_id"),
      this.pool.query<RowDataPacket[]>("SELECT id, number, branch_id, supplier_id, priority, status, desired_date, notes, purchase_order_id, created_at FROM supplier_requests ORDER BY id DESC"),
      this.pool.query<RowDataPacket[]>("SELECT request_id, material_id, requested_qty, reference_price, supplier_code FROM supplier_request_items"),
      this.pool.query<RowDataPacket[]>("SELECT id, request_id, notes, file_name, created_at, responded_by FROM supplier_responses ORDER BY version"),
      this.pool.query<RowDataPacket[]>(`SELECT ri.response_id, sri.material_id, ri.offered_qty, ri.unit_price, ri.supplier_code
        FROM supplier_response_items ri JOIN supplier_request_items sri ON sri.id = ri.request_item_id`),
      this.pool.query<RowDataPacket[]>("SELECT branch_id, period, limit_value, block_on_exceed FROM purchase_budgets"),
      this.pool.query<RowDataPacket[]>("SELECT ref_key, branch_id, period, committed_value, spent_value FROM procurement_commitments"),
      this.pool.query<RowDataPacket[]>("SELECT kind, name, steps FROM procurement_workflow_templates"),
      this.pool.query<RowDataPacket[]>("SELECT doc_type, doc_id, workflow FROM procurement_meta"),
      this.pool.query<RowDataPacket[]>("SELECT document_type, document_id, action, note, user_id, created_at FROM document_events WHERE document_type IN ('material_order','supplier_request','purchase_order') ORDER BY created_at, id"),
      this.pool.query<RowDataPacket[]>("SELECT supplier_id, supplier_code, material_id FROM supplier_material_codes"),
    ]);

    const roleMap = new Map<string, { id: string; name: string; description: string; scope: "all" | "assigned"; permissions: string[] }>();
    for (const row of roles[0]) {
      const id = text(row.id);
      const role = roleMap.get(id) ?? { id, name: text(row.name), description: text(row.description), scope: text(row.scope) === "all" ? "all" as const : "assigned" as const, permissions: [] };
      if (row.permission) role.permissions.push(text(row.permission));
      roleMap.set(id, role);
    }
    const membershipMap = new Map<string, { branchId: string; roleId: string }[]>();
    for (const row of memberships[0]) {
      const list = membershipMap.get(text(row.user_id)) ?? [];
      list.push({ branchId: text(row.branch_id), roleId: text(row.role_id) });
      membershipMap.set(text(row.user_id), list);
    }
    const categoryMap = new Map<string, string[]>();
    for (const row of categories[0]) {
      const list = categoryMap.get(text(row.supplier_id)) ?? [];
      list.push(text(row.name));
      categoryMap.set(text(row.supplier_id), list);
    }
    const portalMap = new Map(portals[0].map((row) => [text(row.supplier_id), row]));
    const eventMap = new Map<string, { at: string; userId: string; action: string; note?: string }[]>();
    for (const row of events[0]) {
      const key = `${text(row.document_type)}:${text(row.document_id)}`;
      const list = eventMap.get(key) ?? [];
      list.push({ at: stamp(row.created_at), userId: text(row.user_id), action: text(row.action), note: row.note ? text(row.note) : undefined });
      eventMap.set(key, list);
    }
    const metaMap = new Map(metas[0].map((row) => [`${text(row.doc_type)}:${text(row.doc_id)}`, json<Workflow | null>(row.workflow, null)]));
    const orderItemMap = new Map<string, RowDataPacket[]>();
    for (const row of orderItems[0]) {
      const list = orderItemMap.get(text(row.order_id)) ?? [];
      list.push(row);
      orderItemMap.set(text(row.order_id), list);
    }
    const quoteMap = new Map<string, RowDataPacket[]>();
    for (const row of quotes[0]) {
      const list = quoteMap.get(text(row.purchase_order_item_id)) ?? [];
      list.push(row);
      quoteMap.set(text(row.purchase_order_item_id), list);
    }
    const purchaseItemMap = new Map<string, RowDataPacket[]>();
    for (const row of purchaseItems[0]) {
      const list = purchaseItemMap.get(text(row.purchase_order_id)) ?? [];
      list.push(row);
      purchaseItemMap.set(text(row.purchase_order_id), list);
    }
    const receiptLineMap = new Map<string, RowDataPacket[]>();
    for (const row of receiptItems[0]) {
      const list = receiptLineMap.get(text(row.receipt_id)) ?? [];
      list.push(row);
      receiptLineMap.set(text(row.receipt_id), list);
    }
    const receiptMap = new Map<string, RowDataPacket[]>();
    for (const row of receipts[0]) {
      const list = receiptMap.get(text(row.purchase_order_id)) ?? [];
      list.push(row);
      receiptMap.set(text(row.purchase_order_id), list);
    }
    const requestItemMap = new Map<string, RowDataPacket[]>();
    for (const row of requestItems[0]) {
      const list = requestItemMap.get(text(row.request_id)) ?? [];
      list.push(row);
      requestItemMap.set(text(row.request_id), list);
    }
    const responseItemMap = new Map<string, RowDataPacket[]>();
    for (const row of responseItems[0]) {
      const list = responseItemMap.get(text(row.response_id)) ?? [];
      list.push(row);
      responseItemMap.set(text(row.response_id), list);
    }
    const responseMap = new Map<string, RowDataPacket[]>();
    for (const row of responses[0]) {
      const list = responseMap.get(text(row.request_id)) ?? [];
      list.push(row);
      responseMap.set(text(row.request_id), list);
    }
    const userName = new Map(users[0].map((row) => [text(row.id), text(row.name)]));
    const linkMap: Record<string, Record<string, string>> = {};
    for (const row of links[0]) {
      const supplierId = keyOf("s", row.supplier_id);
      linkMap[supplierId] = { ...(linkMap[supplierId] ?? {}), [text(row.supplier_code)]: text(row.material_id) };
    }
    const workflowTemplates = { cd: { name: "Aprovação de materiais", steps: [] as Step[] }, supplier: { name: "Conferência de compra", steps: [] as Step[] } };
    for (const row of templates[0]) {
      const kind = text(row.kind) === "supplier" ? "supplier" : "cd";
      workflowTemplates[kind] = { name: text(row.name), steps: json<Step[]>(row.steps, []) };
    }

    return {
      orders: orders[0].map((row) => ({
        id: keyOf("o", row.id), number: text(row.number), branchId: text(row.branch_id), sourceId: text(row.source_branch_id), requesterId: text(row.requester_id),
        priority: text(row.priority), createdAt: stamp(row.created_at), desiredDate: day(row.desired_date), notes: text(row.notes), status: text(row.status),
        items: (orderItemMap.get(text(row.id)) ?? []).map((item) => ({ materialId: text(item.material_id), requested: num(item.requested_qty), approved: num(item.approved_qty), picked: num(item.picked_qty), shipped: num(item.shipped_qty), received: num(item.received_qty), note: item.note ? text(item.note) : undefined })),
        events: (eventMap.get(`material_order:${text(row.id)}`) ?? []).map((event) => ({ ...event, userId: event.userId })),
        workflow: metaMap.get(`order:${text(row.id)}`) ?? undefined,
      })),
      suppliers: suppliers[0].map((row) => {
        const portal = portalMap.get(text(row.id));
        return {
          id: keyOf("s", row.id), name: text(row.name), cnpj: cnpjMask(text(row.cnpj)), contact: text(row.contact_name), email: text(row.email),
          phone: text(row.phone), address: text(row.address), city: text(row.city), state: text(row.state), notes: text(row.notes),
          leadDays: num(row.lead_days), rating: num(row.rating), categories: categoryMap.get(text(row.id)) ?? [],
          portalEnabled: Boolean(row.portal_enabled), portalContact: portal?.contact_name ? text(portal.contact_name) : undefined, portalEmail: portal?.email ? text(portal.email) : undefined,
        };
      }),
      purchases: purchases[0].map((row) => ({
        id: keyOf("p", row.id), number: text(row.number), branchId: text(row.branch_id), status: text(row.status), createdAt: day(row.created_at),
        items: (purchaseItemMap.get(text(row.id)) ?? []).map((item) => ({
          materialId: text(item.material_id), qty: num(item.qty), received: num(item.received_qty), chosen: item.chosen_supplier_id ? keyOf("s", item.chosen_supplier_id) : undefined,
          quotes: (quoteMap.get(text(item.id)) ?? []).map((quote) => ({ supplierId: keyOf("s", quote.supplier_id), unitPrice: num(quote.unit_price), days: num(quote.delivery_days), freight: num(quote.freight) })),
        })),
        receipts: (receiptMap.get(text(row.id)) ?? []).map((receipt) => ({
          id: text(receipt.id), at: stamp(receipt.received_at), user: text(receipt.user_name), notes: text(receipt.notes),
          lines: Object.fromEntries((receiptLineMap.get(text(receipt.id)) ?? []).map((line) => [text(line.material_id), { accepted: num(line.accepted_qty), damaged: num(line.damaged_qty), actualPrice: line.actual_price == null ? undefined : num(line.actual_price) }])),
        })),
        events: (eventMap.get(`purchase_order:${text(row.id)}`) ?? []).map((event) => ({ at: event.at, action: event.action, user: userName.get(event.userId) ?? "Usuário", notes: event.note })),
      })),
      requests: requests[0].map((row) => ({
        id: keyOf("r", row.id), number: text(row.number), branchId: text(row.branch_id), supplierId: keyOf("s", row.supplier_id),
        desiredDate: day(row.desired_date), priority: text(row.priority), notes: text(row.notes), status: text(row.status),
        createdAt: stamp(row.created_at), purchaseId: row.purchase_order_id ? keyOf("p", row.purchase_order_id) : undefined,
        items: (requestItemMap.get(text(row.id)) ?? []).map((item) => ({ materialId: text(item.material_id), requested: num(item.requested_qty), unitPrice: item.reference_price == null ? undefined : num(item.reference_price), supplierCode: item.supplier_code ? text(item.supplier_code) : undefined })),
        versions: (responseMap.get(text(row.id)) ?? []).map((response) => ({
          at: stamp(response.created_at), user: userName.get(text(response.responded_by)) ?? "Usuário", file: response.file_name ? text(response.file_name) : undefined, notes: response.notes ? text(response.notes) : undefined,
          items: (responseItemMap.get(text(response.id)) ?? []).map((item) => ({ materialId: text(item.material_id), requested: num(item.offered_qty), unitPrice: num(item.unit_price), supplierCode: item.supplier_code ? text(item.supplier_code) : undefined })),
        })),
        workflow: metaMap.get(`request:${text(row.id)}`) ?? undefined,
        events: eventMap.get(`supplier_request:${text(row.id)}`) ?? [],
      })),
      budgets: budgets[0].map((row) => ({ branchId: text(row.branch_id), period: text(row.period), limit: num(row.limit_value), block: Boolean(row.block_on_exceed) })),
      commitments: commitments[0].map((row) => ({ id: text(row.ref_key), branchId: text(row.branch_id), period: text(row.period), value: num(row.committed_value), spent: num(row.spent_value) })),
      workflows: workflowTemplates,
      links: linkMap,
      directory: {
        branches: branches[0].map((row) => ({ id: text(row.id), name: text(row.name), type: text(row.type), active: Boolean(row.active), costCenter: text(row.cost_center), city: "", legalName: "", code: "", cnpj: "", address: "", state: "", phone: "", email: "", manager: "", region: "", openedAt: "", warehouses: [] })),
        users: users[0].map((row) => ({ id: text(row.id), name: text(row.name), email: text(row.email), initials: text(row.initials) || text(row.name).slice(0, 2).toUpperCase(), color: "#0f766e", memberships: membershipMap.get(text(row.id)) ?? [] })),
        roles: [...roleMap.values()],
      },
    };
  }

  async saveSupplier(userId: string, input: { id?: string; name: string; cnpj: string; contact: string; email: string; phone?: string; address?: string; city?: string; state?: string; notes?: string; leadDays: number; rating: number; categories: string[]; portalEnabled?: boolean; portalContact?: string; portalEmail?: string }, ip: string | null) {
    const document = digits(input.cnpj);
    if (!input.name.trim()) throw new ProcurementError("VALIDATION", "Informe o nome.");
    if (document && document.length !== 14) throw new ProcurementError("VALIDATION", "CNPJ deve ter 14 dígitos.");
    if (input.rating < 0 || input.rating > 5) throw new ProcurementError("VALIDATION", "A avaliação fica entre 0 e 5.");
    return transaction(this.pool, async (conn) => {
      const cnpj = document || `9${String(Date.now()).slice(-13)}`;
      let id = input.id ? plainId(input.id, "s") : "";
      try {
        if (id) {
          const [updated] = await conn.query<ResultSetHeader>("UPDATE suppliers SET name = ?, cnpj = ?, contact_name = ?, email = ?, phone = ?, address = ?, city = ?, state = ?, notes = ?, lead_days = ?, rating = ?, portal_enabled = ? WHERE id = ? AND deleted_at IS NULL", [input.name.trim(), cnpj, input.contact.trim() || null, input.email.trim() || null, input.phone?.trim() || null, input.address?.trim() || null, input.city?.trim() || null, input.state?.trim().slice(0, 2) || null, input.notes?.trim() || null, input.leadDays, input.rating, input.portalEnabled ? 1 : 0, id]);
          if (!updated.affectedRows) throw new ProcurementError("NOT_FOUND", "Fornecedor não encontrado.");
        } else {
          const [created] = await conn.query<ResultSetHeader>("INSERT INTO suppliers (name, cnpj, contact_name, email, phone, address, city, state, notes, lead_days, rating, portal_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [input.name.trim(), cnpj, input.contact.trim() || null, input.email.trim() || null, input.phone?.trim() || null, input.address?.trim() || null, input.city?.trim() || null, input.state?.trim().slice(0, 2) || null, input.notes?.trim() || null, input.leadDays, input.rating, input.portalEnabled ? 1 : 0]);
          id = String(created.insertId);
        }
      } catch (error) {
        if (error instanceof ProcurementError) throw error;
        if (duplicate(error)) throw new ProcurementError("CONFLICT", "CNPJ já cadastrado.");
        throw error;
      }
      await conn.query("DELETE FROM supplier_categories WHERE supplier_id = ?", [id]);
      for (const name of input.categories.map((item) => item.trim()).filter(Boolean)) {
        const [found] = await conn.query<RowDataPacket[]>("SELECT id FROM material_categories WHERE LOWER(name) = LOWER(?) LIMIT 1", [name]);
        if (found[0]) await conn.query("INSERT IGNORE INTO supplier_categories (supplier_id, category_id) VALUES (?, ?)", [id, found[0].id]);
      }
      await conn.query("INSERT INTO supplier_portal_profiles (supplier_id, contact_name, email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE contact_name = VALUES(contact_name), email = VALUES(email)", [id, input.portalContact?.trim() || null, input.portalEmail?.trim() || null]);
      await this.event(conn, "purchase_order", 0, "fornecedor", null, null, input.id ? "Fornecedor atualizado" : "Fornecedor cadastrado", userId);
      return keyOf("s", id);
    });
  }

  async createPurchase(userId: string, input: { branchId: string; items: { materialId: string; qty: number }[]; confirmed?: { supplierId: string; prices: Record<string, number> } }) {
    if (!input.items.length || input.items.some((item) => !(item.qty > 0))) throw new ProcurementError("VALIDATION", "Adicione materiais e quantidades válidas.");
    return transaction(this.pool, async (conn) => this.insertPurchase(conn, userId, input));
  }

  async addQuote(userId: string, purchaseId: string, materialId: string, quote: { supplierId: string; unitPrice: number; days: number; freight?: number }) {
    const id = plainId(purchaseId, "p");
    return transaction(this.pool, async (conn) => {
      const purchase = await this.purchase(conn, id);
      if (!["requisicao", "cotacao"].includes(purchase.status)) throw new ProcurementError("VALIDATION", "Compra não está aberta para cotação.");
      const [item] = await conn.query<RowDataPacket[]>("SELECT id FROM purchase_order_items WHERE purchase_order_id = ? AND material_id = ?", [id, materialId]);
      if (!item[0]) throw new ProcurementError("VALIDATION", "Material não pertence à compra.");
      const supplierId = plainId(quote.supplierId, "s");
      await conn.query("INSERT INTO purchase_quotes (purchase_order_item_id, supplier_id, unit_price, delivery_days, freight) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE unit_price = VALUES(unit_price), delivery_days = VALUES(delivery_days), freight = VALUES(freight)", [item[0].id, supplierId, quote.unitPrice, quote.days, quote.freight ?? 0]);
      await conn.query("UPDATE purchase_orders SET status = 'cotacao' WHERE id = ?", [id]);
      await this.event(conn, "purchase_order", Number(id), "Cotação registrada", purchase.status, "cotacao", null, userId);
    });
  }

  async approvePurchase(userId: string, purchaseId: string, mode: "cost" | "balanced") {
    const id = plainId(purchaseId, "p");
    return transaction(this.pool, async (conn) => {
      const purchase = await this.purchase(conn, id);
      if (!["requisicao", "cotacao"].includes(purchase.status)) throw new ProcurementError("VALIDATION", "Compra não está em cotação.");
      const [items] = await conn.query<RowDataPacket[]>("SELECT id, material_id, qty FROM purchase_order_items WHERE purchase_order_id = ?", [id]);
      const [quoteRows] = await conn.query<RowDataPacket[]>(`SELECT q.purchase_order_item_id, q.supplier_id, q.unit_price, q.delivery_days, q.freight, s.rating
        FROM purchase_quotes q JOIN suppliers s ON s.id = q.supplier_id WHERE q.purchase_order_item_id IN (?)`, [items.map((item) => item.id)]);
      let total = 0;
      let supplierId = "";
      for (const item of items) {
        const options = quoteRows.filter((row) => text(row.purchase_order_item_id) === text(item.id)).map((row) => ({ supplierId: text(row.supplier_id), unitPrice: num(row.unit_price), days: num(row.delivery_days), freight: num(row.freight), rating: num(row.rating) }));
        if (!options.length) throw new ProcurementError("VALIDATION", "Todos os itens precisam de ao menos uma cotação.");
        const winner = rankQuotes(options, num(item.qty), mode)[0];
        total += winner.total;
        supplierId = winner.supplierId;
        await conn.query("UPDATE purchase_order_items SET chosen_supplier_id = ?, unit_price = ? WHERE id = ?", [winner.supplierId, winner.unitPrice, item.id]);
      }
      await this.commit(conn, keyOf("p", id), purchase.branchId, total, 0);
      await conn.query("UPDATE purchase_orders SET status = 'aprovado', supplier_id = ?, quote_mode = ? WHERE id = ?", [supplierId, mode, id]);
      await this.event(conn, "purchase_order", Number(id), "Cotação aprovada", purchase.status, "aprovado", mode === "cost" ? "Menor custo total" : "Custo, prazo e avaliação", userId);
    });
  }

  async sendPurchase(userId: string, purchaseId: string) {
    const id = plainId(purchaseId, "p");
    return transaction(this.pool, async (conn) => {
      const purchase = await this.purchase(conn, id);
      if (purchase.status !== "aprovado") throw new ProcurementError("VALIDATION", "Compra não está aprovada.");
      await conn.query("UPDATE purchase_orders SET status = 'enviado', sent_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
      await this.event(conn, "purchase_order", Number(id), "Ordem enviada ao fornecedor", "aprovado", "enviado", null, userId);
    });
  }

  async receivePurchase(userId: string, userName: string, purchaseId: string, input: { qty: Record<string, number>; damaged: Record<string, number>; prices: Record<string, number | undefined>; notes: string }, ip: string | null) {
    const id = plainId(purchaseId, "p");
    return transaction(this.pool, async (conn) => {
      const purchase = await this.purchase(conn, id);
      if (!["enviado", "recebido_parcial"].includes(purchase.status)) throw new ProcurementError("VALIDATION", "Pedido de compra não está aguardando entrega.");
      const [items] = await conn.query<RowDataPacket[]>("SELECT id, material_id, qty, received_qty, chosen_supplier_id, unit_price FROM purchase_order_items WHERE purchase_order_id = ?", [id]);
      let divergent = false;
      let total = 0;
      const accepted: { item: RowDataPacket; qty: number; damaged: number; price?: number }[] = [];
      for (const item of items) {
        const materialId = text(item.material_id);
        const line = { accepted: input.qty[materialId] ?? 0, damaged: input.damaged[materialId] ?? 0, price: input.prices[materialId] };
        if (line.accepted < 0 || line.damaged < 0 || line.accepted + line.damaged > num(item.qty) - num(item.received_qty)) throw new ProcurementError("VALIDATION", "Quantidade acima da pendente ou inválida.");
        if (line.price !== undefined && line.price < 0) throw new ProcurementError("VALIDATION", "Preço recebido inválido.");
        divergent ||= line.damaged > 0 || (line.price !== undefined && line.price !== num(item.unit_price));
        total += line.accepted + line.damaged;
        accepted.push({ item, qty: line.accepted, damaged: line.damaged, price: line.price });
      }
      if (!total) throw new ProcurementError("VALIDATION", "Informe ao menos uma quantidade recebida ou danificada.");
      if (divergent && !input.notes.trim()) throw new ProcurementError("VALIDATION", "Informe o motivo dos danos ou da diferença de preço.");
      const [receipt] = await conn.query<ResultSetHeader>("INSERT INTO purchase_receipts (purchase_order_id, notes, has_divergence, user_id) VALUES (?, ?, ?, ?)", [id, input.notes.trim() || null, divergent ? 1 : 0, userId]);
      let spent = 0;
      for (const line of accepted) {
        await conn.query("INSERT INTO purchase_receipt_items (receipt_id, purchase_order_item_id, accepted_qty, damaged_qty, actual_price) VALUES (?, ?, ?, ?, ?)", [receipt.insertId, line.item.id, line.qty, line.damaged, line.price ?? null]);
        await conn.query("UPDATE purchase_order_items SET received_qty = received_qty + ?, damaged_qty = damaged_qty + ? WHERE id = ?", [line.qty, line.damaged, line.item.id]);
        if (line.qty > 0) await this.stock.moveOn(conn, userId, { type: "entrada", clinicId: purchase.branchId, materialId: text(line.item.material_id), qty: line.qty, reason: `Compra ${purchase.number}`, source: "compra" });
        spent += line.qty * (line.price ?? num(line.item.unit_price));
      }
      const [fresh] = await conn.query<RowDataPacket[]>("SELECT qty, received_qty, unit_price FROM purchase_order_items WHERE purchase_order_id = ?", [id]);
      const complete = fresh.every((row) => num(row.received_qty) >= num(row.qty));
      const status = complete ? "recebido" : "recebido_parcial";
      await conn.query("UPDATE purchase_orders SET status = ? WHERE id = ?", [status, id]);
      const outstanding = fresh.reduce((sum, row) => sum + Math.max(0, num(row.qty) - num(row.received_qty)) * num(row.unit_price), 0);
      const [current] = await conn.query<RowDataPacket[]>("SELECT spent_value FROM procurement_commitments WHERE ref_key = ?", [keyOf("p", id)]);
      await this.commit(conn, keyOf("p", id), purchase.branchId, num(current[0]?.spent_value) + spent + outstanding, num(current[0]?.spent_value) + spent, false);
      await this.event(conn, "purchase_order", Number(id), status === "recebido" ? "Recebimento completo" : "Recebimento parcial / divergência", purchase.status, status, input.notes.trim() || null, userId);
      void userName; void ip;
    });
  }

  async saveRequest(userId: string, input: { branchId: string; supplierId: string; desiredDate: string; priority: string; notes: string; file?: string; items: { materialId: string; requested: number; unitPrice?: number; supplierCode?: string }[] }, send: boolean) {
    return transaction(this.pool, async (conn) => {
      await this.assertBranch(conn, input.branchId);
      const materials = await this.materials(conn, input.items.map((item) => item.materialId));
      const supplierId = plainId(input.supplierId, "s");
      const [created] = await conn.query<ResultSetHeader>("INSERT INTO supplier_requests (number, branch_id, supplier_id, requester_id, priority, status, desired_date, notes, published_at) VALUES ('T', ?, ?, ?, ?, ?, ?, ?, IF(? = 1, UTC_TIMESTAMP(), NULL))", [input.branchId, supplierId, userId, input.priority, send ? "aguardando" : "rascunho", input.desiredDate, input.notes || null, send ? 1 : 0]);
      const id = String(created.insertId);
      await conn.query("UPDATE supplier_requests SET number = ? WHERE id = ?", [`FOR-${id.padStart(6, "0")}`, id]);
      for (const item of input.items) await conn.query("INSERT INTO supplier_request_items (request_id, material_id, requested_qty, reference_price, supplier_code) VALUES (?, ?, ?, ?, ?)", [id, item.materialId, item.requested, item.unitPrice ?? null, item.supplierCode || null]);
      const value = input.items.reduce((sum, item) => sum + item.requested * (item.unitPrice ?? materials.get(item.materialId)?.cost ?? 0), 0);
      await this.workflowFor(conn, "request", id, "supplier", { value, branchId: input.branchId, categories: [...new Set([...materials.values()].map((item) => item.category))] });
      await this.event(conn, "supplier_request", Number(id), send ? "Pedido criado e enviado ao fornecedor" : "Rascunho criado", null, send ? "aguardando" : "rascunho", null, userId);
      return keyOf("r", id);
    });
  }

  async respondRequest(userId: string, requestId: string, items: { materialId: string; requested: number; unitPrice?: number; supplierCode?: string }[], file?: string) {
    const id = plainId(requestId, "r");
    return transaction(this.pool, async (conn) => {
      const [request] = await conn.query<RowDataPacket[]>("SELECT id, branch_id, supplier_id, status FROM supplier_requests WHERE id = ?", [id]);
      if (!request[0] || !["aguardando", "resposta", "correcao"].includes(text(request[0].status))) throw new ProcurementError("VALIDATION", "Pedido não está aberto para preços.");
      const [current] = await conn.query<RowDataPacket[]>("SELECT id, material_id, requested_qty FROM supplier_request_items WHERE request_id = ?", [id]);
      if (items.length !== current.length || items.some((item) => !current.some((row) => text(row.material_id) === item.materialId && num(row.requested_qty) === item.requested) || (item.unitPrice ?? -1) < 0)) throw new ProcurementError("VALIDATION", "Material, quantidade ou preço inválido.");
      const [versionRow] = await conn.query<RowDataPacket[]>("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM supplier_responses WHERE request_id = ?", [id]);
      const [response] = await conn.query<ResultSetHeader>("INSERT INTO supplier_responses (request_id, version, responded_by, channel, source, file_name, total_value, notes) VALUES (?, ?, ?, 'interno', ?, ?, ?, ?)", [id, versionRow[0].version, userId, file ? "csv" : "manual", file ?? null, items.reduce((sum, item) => sum + item.requested * (item.unitPrice ?? 0), 0), file ?? null]);
      for (const item of items) {
        const source = current.find((row) => text(row.material_id) === item.materialId);
        await conn.query("INSERT INTO supplier_response_items (response_id, request_item_id, offered_qty, unit_price, supplier_code) VALUES (?, ?, ?, ?, ?)", [response.insertId, source?.id, item.requested, item.unitPrice ?? 0, item.supplierCode || null]);
        if (item.supplierCode) await conn.query("INSERT INTO supplier_material_codes (supplier_id, material_id, supplier_code, last_price, last_price_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE material_id = VALUES(material_id), last_price = VALUES(last_price), last_price_at = UTC_TIMESTAMP()", [request[0].supplier_id, item.materialId, item.supplierCode, item.unitPrice ?? 0]);
      }
      const materials = await this.materials(conn, items.map((item) => item.materialId));
      const workflow = await this.readWorkflow(conn, "request", id);
      const next = workflow ? { ...workflow, candidates: workflow.candidates ?? workflow.steps, steps: (workflow.candidates ?? workflow.steps).filter((step) => stepApplies(step, { value: items.reduce((sum, item) => sum + item.requested * (item.unitPrice ?? 0), 0), branchId: text(request[0].branch_id), categories: [...materials.values()].map((item) => item.category) })), index: 0, startedAt: new Date().toISOString(), decisions: [] } : null;
      await this.persistWorkflow(conn, "request", id, next);
      await conn.query("UPDATE supplier_requests SET status = 'resposta' WHERE id = ?", [id]);
      await this.event(conn, "supplier_request", Number(id), "Preços registrados", text(request[0].status), "resposta", file ?? null, userId);
    });
  }

  async requestAction(userId: string, requestId: string, action: "send" | "correction" | "approve" | "advance", note: string) {
    const id = plainId(requestId, "r");
    return transaction(this.pool, async (conn) => {
      const [request] = await conn.query<RowDataPacket[]>("SELECT * FROM supplier_requests WHERE id = ?", [id]);
      if (!request[0]) throw new ProcurementError("NOT_FOUND", "Pedido não encontrado.");
      const status = text(request[0].status);
      if (action === "advance") {
        const moved = this.moveSituation(await this.readWorkflow(conn, "request", id), userId, note);
        await this.persistWorkflow(conn, "request", id, moved.workflow);
        await this.event(conn, "supplier_request", Number(id), `Situação atualizada para ${moved.name}`, status, status, note || null, userId);
        return this.stageNotice(conn, "request", id, userId, moved, note);
      }
      if (action === "send" && status !== "rascunho") throw new ProcurementError("VALIDATION", "Somente rascunhos podem ser enviados.");
      if (action !== "send" && status !== "resposta") throw new ProcurementError("VALIDATION", "Confira uma resposta antes de prosseguir.");
      if (action === "approve") {
        const workflow = await this.readWorkflow(conn, "request", id);
        if (workflow && workflow.index < workflow.steps.length) {
          const step = workflow.steps[workflow.index];
          if (!(await this.matches(conn, userId, step, text(request[0].branch_id)))) throw new ProcurementError("FORBIDDEN", "Somente o responsável da etapa pode aprovar.");
          if (step.requireNote && !note.trim()) throw new ProcurementError("VALIDATION", "Esta etapa exige uma observação.");
          workflow.index += 1;
          workflow.startedAt = new Date().toISOString();
          workflow.decisions.push({ stepId: step.id, userId, at: workflow.startedAt, note: note.trim() });
          await this.persistWorkflow(conn, "request", id, workflow);
          if (workflow.index < workflow.steps.length) {
            await this.event(conn, "supplier_request", Number(id), `Etapa aprovada: ${step.name}`, status, status, note || null, userId);
            return;
          }
        }
        const [latest] = await conn.query<RowDataPacket[]>("SELECT id FROM supplier_responses WHERE request_id = ? ORDER BY version DESC LIMIT 1", [id]);
        if (!latest[0]) throw new ProcurementError("VALIDATION", "Sem preços confirmados.");
        const [lines] = await conn.query<RowDataPacket[]>(`SELECT sri.material_id, sri.requested_qty, ri.unit_price FROM supplier_response_items ri JOIN supplier_request_items sri ON sri.id = ri.request_item_id WHERE ri.response_id = ?`, [latest[0].id]);
        const prices = Object.fromEntries(lines.map((line) => [text(line.material_id), num(line.unit_price)]));
        const purchaseId = await this.insertPurchase(conn, userId, { branchId: text(request[0].branch_id), items: lines.map((line) => ({ materialId: text(line.material_id), qty: num(line.requested_qty) })), confirmed: { supplierId: keyOf("s", request[0].supplier_id), prices } });
        await conn.query("UPDATE supplier_requests SET status = 'aprovado', purchase_order_id = ? WHERE id = ?", [plainId(purchaseId, "p"), id]);
        await conn.query("UPDATE purchase_orders SET supplier_request_id = ? WHERE id = ?", [id, plainId(purchaseId, "p")]);
        await this.event(conn, "supplier_request", Number(id), "Compra aprovada", status, "aprovado", note || null, userId);
        return;
      }
      const next = action === "send" ? "aguardando" : "correcao";
      await conn.query("UPDATE supplier_requests SET status = ?, published_at = IF(? = 'aguardando', UTC_TIMESTAMP(), published_at) WHERE id = ?", [next, next, id]);
      await this.event(conn, "supplier_request", Number(id), action === "send" ? "Pedido enviado ao fornecedor" : "Correção solicitada", status, next, note || null, userId);
    });
  }

  async comment(userId: string, kind: "order" | "request", publicId: string, note: string) {
    if (!note.trim() || note.length > 2000) throw new ProcurementError("VALIDATION", "Informe uma observação de até 2.000 caracteres.");
    const prefix = kind === "order" ? "o" : "r";
    const id = plainId(publicId, prefix);
    const table = kind === "order" ? "material_orders" : "supplier_requests";
    const type = kind === "order" ? "material_order" : "supplier_request";
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT id FROM ${table} WHERE id = ?`, [id]);
    if (!rows[0]) throw new ProcurementError("NOT_FOUND", "Pedido não encontrado.");
    await this.pool.query("INSERT INTO document_events (document_type, document_id, action, note, is_comment, user_id) VALUES (?, ?, 'Observação adicionada', ?, 1, ?)", [type, id, note.trim(), userId]);
  }

  async saveOrder(userId: string, input: { id?: string; branchId: string; priority: string; desiredDate: string; notes: string; items: { materialId: string; requested: number }[] }) {
    return transaction(this.pool, async (conn) => {
      await this.assertBranch(conn, input.branchId);
      const source = await this.distribution(conn);
      const materials = await this.materials(conn, input.items.map((item) => item.materialId));
      const value = input.items.reduce((sum, item) => sum + item.requested * (materials.get(item.materialId)?.cost ?? 0), 0);
      let id = input.id ? plainId(input.id, "o") : "";
      if (id) {
        const [current] = await conn.query<RowDataPacket[]>("SELECT status FROM material_orders WHERE id = ?", [id]);
        if (!current[0] || !["rascunho", "correcao"].includes(text(current[0].status))) throw new ProcurementError("VALIDATION", "Somente rascunhos ou correções podem ser editados.");
        await conn.query("UPDATE material_orders SET branch_id = ?, priority = ?, desired_date = ?, notes = ?, estimated_value = ? WHERE id = ?", [input.branchId, input.priority, input.desiredDate, input.notes || null, value, id]);
        await conn.query("DELETE FROM material_order_items WHERE order_id = ?", [id]);
      } else {
        const [created] = await conn.query<ResultSetHeader>("INSERT INTO material_orders (number, branch_id, source_branch_id, requester_id, priority, status, desired_date, notes, estimated_value) VALUES ('T', ?, ?, ?, ?, 'rascunho', ?, ?, ?)", [input.branchId, source, userId, input.priority, input.desiredDate, input.notes || null, value]);
        id = String(created.insertId);
        await conn.query("UPDATE material_orders SET number = ? WHERE id = ?", [`PED-${id.padStart(6, "0")}`, id]);
        await this.event(conn, "material_order", Number(id), "Pedido criado", null, "rascunho", null, userId);
      }
      for (const item of input.items) await conn.query("INSERT INTO material_order_items (order_id, material_id, requested_qty, unit_cost) VALUES (?, ?, ?, ?)", [id, item.materialId, item.requested, materials.get(item.materialId)?.cost ?? 0]);
      if (!input.id) await this.workflowFor(conn, "order", id, "cd", { value, branchId: input.branchId, categories: [...new Set([...materials.values()].map((item) => item.category))] });
      return keyOf("o", id);
    });
  }

  async orderAction(userId: string, orderId: string, action: "submit" | "approve" | "reject" | "correct" | "pick" | "ship" | "receive" | "close" | "cancel" | "advance", input: { quantities?: Record<string, number>; note?: string }) {
    const id = plainId(orderId, "o");
    let stockChanged = false;
    let notice: StageNotice | null = null;
    await transaction(this.pool, async (conn) => {
      const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM material_orders WHERE id = ? FOR UPDATE", [id]);
      const order = rows[0];
      if (!order) throw new ProcurementError("NOT_FOUND", "Pedido não encontrado.");
      const status = text(order.status);
      const [items] = await conn.query<RowDataPacket[]>("SELECT * FROM material_order_items WHERE order_id = ?", [id]);
      const note = input.note?.trim() ?? "";
      if (action === "advance") {
        if (["cancelado", "rejeitado", "concluido"].includes(status)) throw new ProcurementError("VALIDATION", "Pedido encerrado não muda de etapa.");
        const moved = this.moveSituation(await this.readWorkflow(conn, "order", id), userId, note);
        await this.persistWorkflow(conn, "order", id, moved.workflow);
        await this.event(conn, "material_order", Number(id), `Situação atualizada para ${moved.name}`, status, status, note || null, userId);
        notice = await this.stageNotice(conn, "order", id, userId, moved, note);
        return;
      }
      if (action === "submit") {
        if (!["rascunho", "correcao"].includes(status)) throw new ProcurementError("VALIDATION", "Só é possível enviar rascunhos ou pedidos em correção.");
        await conn.query("UPDATE material_orders SET status = 'enviado', submitted_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
        await this.event(conn, "material_order", Number(id), "Pedido enviado", status, "enviado", null, userId);
      } else if (action === "approve") {
        if (status !== "enviado") throw new ProcurementError("VALIDATION", "Pedido não está aguardando aprovação.");
        const workflow = await this.readWorkflow(conn, "order", id);
        if (workflow && workflow.index < workflow.steps.length) {
          const step = workflow.steps[workflow.index];
          if (!(await this.matches(conn, userId, step, text(order.branch_id)))) throw new ProcurementError("FORBIDDEN", "Somente o responsável da etapa pode aprovar.");
          if (step.requireNote && !note) throw new ProcurementError("VALIDATION", "Esta etapa exige uma observação.");
          workflow.index += 1;
          workflow.startedAt = new Date().toISOString();
          workflow.decisions.push({ stepId: step.id, userId, at: workflow.startedAt, note });
          await this.persistWorkflow(conn, "order", id, workflow);
          await this.event(conn, "material_order", Number(id), `Etapa aprovada: ${step.name}`, status, status, note || null, userId);
          if (workflow.index < workflow.steps.length) return;
        } else if (!(await this.allowed(userId, "pedidos.aprovar", text(order.branch_id)))) throw new ProcurementError("FORBIDDEN", "Sem permissão para aprovar pedidos desta filial.");
        let value = 0;
        let any = false;
        for (const item of items) {
          const approved = Math.max(0, Math.min(input.quantities?.[text(item.material_id)] ?? num(item.requested_qty), num(item.requested_qty)));
          if (approved > 0) any = true;
          value += approved * num(item.unit_cost);
          await conn.query("UPDATE material_order_items SET approved_qty = ? WHERE id = ?", [approved, item.id]);
          if (approved > 0) {
            const [slot] = await conn.query<RowDataPacket[]>("SELECT id, qty, reserved_qty FROM stock_balances WHERE material_id = ? AND branch_id = ? ORDER BY id LIMIT 1", [item.material_id, order.source_branch_id]);
            if (!slot[0] || num(slot[0].reserved_qty) + approved > num(slot[0].qty)) throw new ProcurementError("VALIDATION", "Estoque insuficiente no Centro de Distribuição para reservar a quantidade aprovada.");
            await conn.query("UPDATE stock_balances SET reserved_qty = reserved_qty + ? WHERE id = ?", [approved, slot[0].id]);
          }
        }
        if (!any) throw new ProcurementError("VALIDATION", "Aprove ao menos um item.");
        await this.commit(conn, keyOf("o", id), text(order.branch_id), value, 0);
        await conn.query("UPDATE material_orders SET status = 'aprovado', approved_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
        await this.event(conn, "material_order", Number(id), "Pedido aprovado", status, "aprovado", note || null, userId);
      } else if (action === "reject" || action === "correct") {
        if (status !== "enviado") throw new ProcurementError("VALIDATION", "Pedido não está aguardando aprovação.");
        if (!note) throw new ProcurementError("VALIDATION", "Informe o motivo da correção ou rejeição.");
        const next = action === "correct" ? "correcao" : "rejeitado";
        await conn.query("UPDATE material_orders SET status = ?, rejection_reason = ? WHERE id = ?", [next, note, id]);
        await this.event(conn, "material_order", Number(id), action === "correct" ? "Correção solicitada" : "Pedido rejeitado", status, next, note, userId);
      } else if (action === "pick") {
        if (!["aprovado", "separacao"].includes(status)) throw new ProcurementError("VALIDATION", "Pedido não está liberado para separação.");
        let any = false;
        for (const item of items) {
          const picked = input.quantities?.[text(item.material_id)] ?? 0;
          if (picked < 0 || picked > num(item.approved_qty)) throw new ProcurementError("VALIDATION", "Quantidade separada acima da aprovada.");
          const [balance] = await conn.query<RowDataPacket[]>("SELECT COALESCE(SUM(qty), 0) AS qty FROM stock_balances WHERE material_id = ? AND branch_id = ?", [item.material_id, order.source_branch_id]);
          if (picked > num(balance[0]?.qty)) throw new ProcurementError("INSUFFICIENT", "Estoque insuficiente no depósito para separar.");
          if (picked > 0) any = true;
          await conn.query("UPDATE material_order_items SET picked_qty = ? WHERE id = ?", [picked, item.id]);
        }
        if (!any) throw new ProcurementError("VALIDATION", "Separe ao menos um item.");
        await conn.query("UPDATE material_orders SET status = 'separacao' WHERE id = ?", [id]);
        await this.event(conn, "material_order", Number(id), "Separação registrada", status, "separacao", null, userId);
      } else if (action === "ship") {
        if (status !== "separacao") throw new ProcurementError("VALIDATION", "Separe os materiais antes de expedir.");
        for (const item of items) {
          const picked = num(item.picked_qty);
          if (picked > 0) {
            await this.stock.moveOn(conn, userId, { type: "saida", clinicId: text(order.source_branch_id), materialId: text(item.material_id), qty: picked, reason: `Expedição ${text(order.number)}`, source: "pedido" });
            stockChanged = true;
          }
          await conn.query("UPDATE material_order_items SET shipped_qty = picked_qty WHERE id = ?", [item.id]);
          await conn.query("UPDATE stock_balances SET reserved_qty = GREATEST(0, reserved_qty - ?) WHERE material_id = ? AND branch_id = ? ORDER BY id LIMIT 1", [num(item.approved_qty), item.material_id, order.source_branch_id]);
        }
        await conn.query("UPDATE material_orders SET status = 'transporte', shipped_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
        await this.event(conn, "material_order", Number(id), "Pedido expedido", status, "transporte", null, userId);
      } else if (action === "receive") {
        if (!["transporte", "recebido_parcial"].includes(status)) throw new ProcurementError("VALIDATION", "Pedido não está em transporte.");
        let any = false;
        let complete = true;
        for (const item of items) {
          const received = input.quantities?.[text(item.material_id)] ?? 0;
          if (received < 0 || num(item.received_qty) + received > num(item.shipped_qty)) throw new ProcurementError("VALIDATION", "Quantidade recebida acima da expedida.");
          if (received > 0) {
            any = true;
            await this.stock.moveOn(conn, userId, { type: "entrada", clinicId: text(order.branch_id), materialId: text(item.material_id), qty: received, reason: `Recebimento ${text(order.number)}`, source: "pedido" });
            stockChanged = true;
            await conn.query("UPDATE material_order_items SET received_qty = received_qty + ? WHERE id = ?", [received, item.id]);
          }
          if (num(item.received_qty) + received !== num(item.shipped_qty)) complete = false;
        }
        if (!any) throw new ProcurementError("VALIDATION", "Informe ao menos uma quantidade recebida.");
        const next = complete ? "concluido" : "recebido_parcial";
        await conn.query("UPDATE material_orders SET status = ?, completed_at = IF(? = 'concluido', UTC_TIMESTAMP(), completed_at) WHERE id = ?", [next, next, id]);
        await this.event(conn, "material_order", Number(id), complete ? "Recebimento concluído" : "Recebimento parcial", status, next, note || null, userId);
      } else if (action === "close") {
        if (status !== "recebido_parcial") throw new ProcurementError("VALIDATION", "Só pedidos parcialmente recebidos.");
        if (!note) throw new ProcurementError("VALIDATION", "Informe a divergência para encerrar.");
        await conn.query("UPDATE material_orders SET status = 'concluido', completed_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
        await this.event(conn, "material_order", Number(id), "Encerrado com divergência", status, "concluido", note, userId);
      } else if (action === "cancel") {
        if (!["rascunho", "enviado", "correcao", "aprovado"].includes(status)) throw new ProcurementError("VALIDATION", "Pedido não pode ser cancelado nesta etapa.");
        if (status === "aprovado") {
          for (const item of items) await conn.query("UPDATE stock_balances SET reserved_qty = GREATEST(0, reserved_qty - ?) WHERE material_id = ? AND branch_id = ? ORDER BY id LIMIT 1", [num(item.approved_qty), item.material_id, order.source_branch_id]);
        }
        await conn.query("DELETE FROM procurement_commitments WHERE ref_key = ?", [keyOf("o", id)]);
        await conn.query("UPDATE material_orders SET status = 'cancelado' WHERE id = ?", [id]);
        await this.event(conn, "material_order", Number(id), "Pedido cancelado", status, "cancelado", note || null, userId);
      }
    });
    return notice ?? stockChanged;
  }

  async noteStageMail(notice: StageNotice, message: string) {
    await this.pool.query("INSERT INTO document_events (document_type, document_id, action, note, user_id) VALUES (?, ?, 'E-mail da etapa', ?, ?)", [notice.documentType, notice.documentId, message.slice(0, 2000), notice.actorId]);
  }

  async duplicateOrder(userId: string, orderId: string) {
    const id = plainId(orderId, "o");
    const [order] = await this.pool.query<RowDataPacket[]>("SELECT branch_id, priority, desired_date, notes FROM material_orders WHERE id = ?", [id]);
    if (!order[0]) throw new ProcurementError("NOT_FOUND", "Pedido não encontrado.");
    const [items] = await this.pool.query<RowDataPacket[]>("SELECT material_id, requested_qty FROM material_order_items WHERE order_id = ?", [id]);
    return this.saveOrder(userId, { branchId: text(order[0].branch_id), priority: text(order[0].priority), desiredDate: day(order[0].desired_date), notes: text(order[0].notes), items: items.map((item) => ({ materialId: text(item.material_id), requested: num(item.requested_qty) })) });
  }

  async saveBudget(userId: string, input: { branchId: string; period: string; limit: number; block: boolean }) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period) || input.limit < 0) throw new ProcurementError("VALIDATION", "Confira filial, mês e limite.");
    await this.assertBranch(this.pool, input.branchId);
    await this.pool.query("INSERT INTO purchase_budgets (branch_id, period, limit_value, block_on_exceed, updated_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE limit_value = VALUES(limit_value), block_on_exceed = VALUES(block_on_exceed), updated_by = VALUES(updated_by)", [input.branchId, input.period, input.limit, input.block ? 1 : 0, userId]);
  }

  async saveWorkflow(userId: string, kind: "cd" | "supplier", template: { name: string; steps: Step[] }) {
    if (!template.name.trim() || !template.steps.length) throw new ProcurementError("VALIDATION", "Informe o nome do fluxo e ao menos uma etapa.");
    await this.pool.query("INSERT INTO procurement_workflow_templates (kind, name, steps) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), steps = VALUES(steps)", [kind, template.name.trim(), JSON.stringify(template.steps)]);
    void userId;
  }

  private async insertPurchase(conn: Runner, userId: string, input: { branchId: string; items: { materialId: string; qty: number }[]; confirmed?: { supplierId: string; prices: Record<string, number> } }) {
    await this.assertBranch(conn, input.branchId);
    await this.materials(conn, input.items.map((item) => item.materialId));
    const supplierId = input.confirmed ? plainId(input.confirmed.supplierId, "s") : null;
    const total = input.confirmed ? input.items.reduce((sum, item) => sum + item.qty * (input.confirmed?.prices[item.materialId] ?? 0), 0) : 0;
    const [created] = await conn.query<ResultSetHeader>("INSERT INTO purchase_orders (number, branch_id, supplier_id, status, created_by) VALUES ('T', ?, ?, ?, ?)", [input.branchId, supplierId, input.confirmed ? "aprovado" : "requisicao", userId]);
    const id = String(created.insertId);
    await conn.query("UPDATE purchase_orders SET number = ? WHERE id = ?", [`OC-${id.padStart(6, "0")}`, id]);
    for (const item of input.items) {
      const [line] = await conn.query<ResultSetHeader>("INSERT INTO purchase_order_items (purchase_order_id, material_id, qty, chosen_supplier_id, unit_price) VALUES (?, ?, ?, ?, ?)", [id, item.materialId, item.qty, supplierId, input.confirmed?.prices[item.materialId] ?? null]);
      if (input.confirmed) await conn.query("INSERT INTO purchase_quotes (purchase_order_item_id, supplier_id, unit_price, delivery_days, freight) VALUES (?, ?, ?, 0, 0)", [line.insertId, supplierId, input.confirmed.prices[item.materialId] ?? 0]);
    }
    if (input.confirmed) await this.commit(conn, keyOf("p", id), input.branchId, total, 0);
    await this.event(conn, "purchase_order", Number(id), input.confirmed ? "Compra aprovada" : "Requisição criada", null, input.confirmed ? "aprovado" : "requisicao", null, userId);
    return keyOf("p", id);
  }

  private async purchase(conn: Runner, id: string) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id, number, branch_id, status FROM purchase_orders WHERE id = ? FOR UPDATE", [id]);
    if (!rows[0]) throw new ProcurementError("NOT_FOUND", "Compra não encontrada.");
    return { id, number: text(rows[0].number), branchId: text(rows[0].branch_id), status: text(rows[0].status) };
  }

  private async materials(conn: Runner, ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) throw new ProcurementError("VALIDATION", "Materiais duplicados.");
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT m.id, m.standard_cost AS cost, c.name AS category FROM materials m JOIN material_categories c ON c.id = m.category_id WHERE m.id IN (${unique.map(() => "?").join(",")}) AND m.deleted_at IS NULL`, unique);
    if (rows.length !== unique.length) throw new ProcurementError("VALIDATION", "Material inválido.");
    return new Map(rows.map((row) => [text(row.id), { cost: num(row.cost), category: text(row.category) }]));
  }

  private async assertBranch(conn: Runner | Pool, id: string) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM branches WHERE id = ? AND deleted_at IS NULL AND active = 1", [id]);
    if (!rows[0]) throw new ProcurementError("VALIDATION", "Filial inválida.");
  }

  private async distribution(conn: Runner) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM branches WHERE type = 'cd' AND deleted_at IS NULL AND active = 1 ORDER BY id LIMIT 1");
    if (!rows[0]) throw new ProcurementError("VALIDATION", "Centro de distribuição não encontrado.");
    return text(rows[0].id);
  }

  private async commit(conn: Runner, ref: string, branchId: string, value: number, spent: number, check = true) {
    if (check) {
      const [budget] = await conn.query<RowDataPacket[]>("SELECT limit_value, block_on_exceed FROM purchase_budgets WHERE branch_id = ? AND period = ?", [branchId, month()]);
      if (budget[0]?.block_on_exceed) {
        const [sum] = await conn.query<RowDataPacket[]>("SELECT COALESCE(SUM(committed_value), 0) AS total FROM procurement_commitments WHERE branch_id = ? AND period = ? AND ref_key <> ?", [branchId, month(), ref]);
        if (num(sum[0]?.total) + value > num(budget[0].limit_value)) throw new ProcurementError("CONFLICT", "O pedido excede o orçamento do centro de custo.");
      }
    }
    await conn.query("INSERT INTO procurement_commitments (ref_key, branch_id, period, committed_value, spent_value) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE committed_value = VALUES(committed_value), spent_value = VALUES(spent_value)", [ref, branchId, month(), value, spent]);
  }

  private async workflowFor(conn: Runner, type: "order" | "request", id: string, kind: "cd" | "supplier", context: { value: number; branchId: string; categories: string[] }) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT name, steps FROM procurement_workflow_templates WHERE kind = ?", [kind]);
    const steps = json<Step[]>(rows[0]?.steps, []).filter((step) => stepApplies(step, context));
    const workflow: Workflow = { candidates: json<Step[]>(rows[0]?.steps, []), name: text(rows[0]?.name) || "Aprovação", steps, index: 0, startedAt: new Date().toISOString(), decisions: [] };
    await this.persistWorkflow(conn, type, id, workflow);
  }

  private async readWorkflow(conn: Runner, type: string, id: string) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT workflow FROM procurement_meta WHERE doc_type = ? AND doc_id = ?", [type, id]);
    return json<Workflow | null>(rows[0]?.workflow, null);
  }

  private async persistWorkflow(conn: Runner, type: string, id: string, workflow: Workflow | null) {
    await conn.query("INSERT INTO procurement_meta (doc_type, doc_id, workflow) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE workflow = VALUES(workflow)", [type, id, workflow ? JSON.stringify(workflow) : null]);
  }

  private async stageNotice(conn: Runner, kind: "order" | "request", id: string, userId: string, moved: { workflow: Workflow; name: string }, note: string): Promise<StageNotice> {
    const entered = moved.workflow.situation ?? 0;
    const fromStep = moved.workflow.steps[entered - 1];
    const responsible = entered < moved.workflow.steps.length ? moved.workflow.steps[entered] : fromStep;
    const [docs] = await conn.query<RowDataPacket[]>(
      kind === "request"
        ? `SELECT d.number, d.branch_id, b.name AS branch_name, u.email AS requester_email, s.name AS supplier_name, s.email AS supplier_email, p.email AS portal_email, a.name AS actor_name
           FROM supplier_requests d
           JOIN branches b ON b.id = d.branch_id
           JOIN users u ON u.id = d.requester_id
           JOIN users a ON a.id = ?
           JOIN suppliers s ON s.id = d.supplier_id
           LEFT JOIN supplier_portal_profiles p ON p.supplier_id = s.id
           WHERE d.id = ?`
        : `SELECT d.number, d.branch_id, b.name AS branch_name, u.email AS requester_email, a.name AS actor_name
           FROM material_orders d
           JOIN branches b ON b.id = d.branch_id
           JOIN users u ON u.id = d.requester_id
           JOIN users a ON a.id = ?
           WHERE d.id = ?`,
      [userId, id],
    );
    const row = docs[0];
    const people = new Map<string, { email: string; roles: StageRole[] }>();
    const add = (email: unknown, role: StageRole) => {
      const value = text(email).trim();
      if (!validEmail(value)) return;
      const key = value.toLowerCase();
      const current = people.get(key) ?? { email: value, roles: [] };
      if (!current.roles.includes(role)) current.roles.push(role);
      people.set(key, current);
    };
    if (kind === "request") add(text(row?.portal_email) || text(row?.supplier_email), "supplier");
    add(row?.requester_email, "opener");
    if (responsible?.assigneeType === "user") {
      const [users] = await conn.query<RowDataPacket[]>("SELECT email FROM users WHERE id = ? AND deleted_at IS NULL", [responsible.assigneeId]);
      add(users[0]?.email, "assignee");
    } else if (responsible) {
      const [users] = await conn.query<RowDataPacket[]>(
        `SELECT DISTINCT u.email FROM users u
         JOIN user_branch_memberships m ON m.user_id = u.id
         JOIN erp_roles r ON r.id = m.role_id
         WHERE u.deleted_at IS NULL AND r.id = ? AND (r.scope = 'all' OR m.branch_id = ?)`,
        [responsible.assigneeId, text(row?.branch_id)],
      );
      for (const user of users) add(user.email, "assignee");
    }
    const recipients = [...people.values()];
    const wanted: StageRole[] = kind === "request" ? ["supplier", "assignee", "opener"] : ["assignee", "opener"];
    const covered = new Set(recipients.flatMap((person) => person.roles));
    return {
      documentType: kind === "order" ? "material_order" : "supplier_request",
      documentId: Number(id),
      actorId: userId,
      number: text(row?.number),
      branch: text(row?.branch_name),
      supplier: kind === "request" ? text(row?.supplier_name) || undefined : undefined,
      fromStage: fromStep?.name ?? "Início",
      toStage: moved.name,
      note: note.trim(),
      actor: text(row?.actor_name) || "Equipe",
      recipients,
      missing: wanted.filter((role) => !covered.has(role)),
    };
  }

  private moveSituation(workflow: Workflow | null, userId: string, note: string) {
    if (!note.trim()) throw new ProcurementError("VALIDATION", "Informe uma observação para mudar a etapa.");
    if (!workflow?.steps.length) throw new ProcurementError("VALIDATION", "Este pedido não tem etapas para atualizar.");
    const cursor = workflow.situation ?? workflow.index;
    if (cursor >= workflow.steps.length) throw new ProcurementError("VALIDATION", "O pedido já percorreu todas as etapas.");
    const leaving = workflow.steps[cursor];
    const next = cursor + 1;
    const updated: Workflow = { ...workflow, situation: next, moves: [...(workflow.moves ?? []), { stepId: leaving.id, userId, at: new Date().toISOString(), note: note.trim() }] };
    return { workflow: updated, name: workflow.steps[next]?.name ?? "Concluído" };
  }

  private async matches(conn: Runner, userId: string, step: Step, branchId: string) {
    if (step.assigneeType === "user") return step.assigneeId === userId;
    const [rows] = await conn.query<RowDataPacket[]>("SELECT r.id, r.scope, m.branch_id FROM user_branch_memberships m JOIN erp_roles r ON r.id = m.role_id WHERE m.user_id = ?", [userId]);
    return rows.some((row) => text(row.id) === step.assigneeId && (text(row.scope) === "all" || text(row.branch_id) === branchId));
  }

  private async event(conn: Runner, type: string, id: number, action: string, from: string | null, to: string | null, note: string | null, userId: string) {
    if (!id) return;
    await conn.query("INSERT INTO document_events (document_type, document_id, action, from_status, to_status, note, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)", [type, id, action, from, to, note, userId]);
  }
}

function duplicate(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ER_DUP_ENTRY";
}
