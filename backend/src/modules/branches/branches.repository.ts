import type { Pool, ResultSetHeader, RowDataPacket } from "../../database/pool.js";
import { transaction } from "../../database/pool.js";

export type WarehouseInput = { id?: string; name: string; locations?: string[] };

export type BranchInput = {
  id?: string;
  code: string;
  name: string;
  type: "administracao" | "cd" | "clinica";
  legalName?: string;
  cnpj?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  manager?: string;
  costCenter?: string;
  region?: string;
  openedAt?: string;
  warehouses?: WarehouseInput[];
};

type BranchRow = RowDataPacket & {
  id: number | string;
  code: string;
  name: string;
  type: "administracao" | "cd" | "clinica";
  legal_name: string | null;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  manager_name: string | null;
  active: number;
  opened_at: string | null;
  cost_center: string | null;
  region: string | null;
};

const text = (value: unknown) => (value == null ? "" : String(value));
const digits = (value: string) => value.replace(/\D/g, "");

function formatCnpj(value: string) {
  if (value.length !== 14) return value;
  return `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12)}`;
}

export class BranchesRepository {
  constructor(private readonly pool: Pool) {}

  async list() {
    const [rows] = await this.pool.query<BranchRow[]>(`
      SELECT b.id, b.code, b.name, b.type, b.legal_name, b.cnpj, b.address, b.city, b.state, b.phone, b.email,
             b.manager_name, b.active, b.opened_at, COALESCE(cc.code, '') AS cost_center, COALESCE(r.name, '') AS region
      FROM branches b
      LEFT JOIN cost_centers cc ON cc.id = b.cost_center_id
      LEFT JOIN regions r ON r.id = b.region_id
      WHERE b.deleted_at IS NULL
      ORDER BY b.name
    `);
    const branches = rows.map((row) => this.mapBranch(row, []));
    const warehouses = await this.warehouses(branches.map((branch) => branch.id));
    return branches.map((branch) => ({ ...branch, warehouses: warehouses.get(branch.id) ?? [] }));
  }

  async detail(id: string) {
    const branches = await this.list();
    const branch = branches.find((item) => item.id === id);
    if (!branch) return null;
    const [stockRows] = await this.pool.query<RowDataPacket[]>(`
      SELECT m.name, u.code AS unit, m.standard_cost AS cost, m.min_qty, SUM(sb.qty) AS qty
      FROM stock_balances sb
      JOIN materials m ON m.id = sb.material_id AND m.deleted_at IS NULL AND m.active = 1
      JOIN units_of_measure u ON u.id = m.unit_id
      WHERE sb.branch_id = ?
      GROUP BY m.id, m.name, u.code, m.standard_cost, m.min_qty
      HAVING SUM(sb.qty) <> 0
      ORDER BY m.name
    `, [id]);
    const stock = stockRows.map((row) => ({
      name: text(row.name),
      unit: text(row.unit),
      qty: Number(row.qty) || 0,
      min: Number(row.min_qty) || 0,
      cost: Number(row.cost) || 0,
    }));
    const [peopleRows] = await this.pool.query<RowDataPacket[]>(`
      SELECT u.id, u.name, r.name AS role_name
      FROM user_branch_memberships m
      JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
      JOIN erp_roles r ON r.id = m.role_id
      WHERE m.branch_id = ?
      ORDER BY u.name
    `, [id]);
    const [orderRows] = await this.pool.query<RowDataPacket[]>(`
      SELECT id, number, status
      FROM material_orders
      WHERE branch_id = ? OR source_branch_id = ?
      ORDER BY id DESC
      LIMIT 40
    `, [id, id]);
    return {
      ...branch,
      stockValue: stock.reduce((sum, item) => sum + item.qty * item.cost, 0),
      stock: stock.map(({ cost: _cost, ...item }) => item),
      people: peopleRows.map((row) => ({ id: String(row.id), name: text(row.name), role: text(row.role_name) })),
      orders: orderRows.map((row) => ({ id: String(row.id), number: text(row.number), status: text(row.status) })),
    };
  }

  async save(input: BranchInput) {
    const code = input.code.trim().slice(0, 20);
    const name = input.name.trim().slice(0, 150);
    if (!code || !name) throw new Error("REQUIRED");
    const legalName = input.legalName ?? "";
    const address = input.address ?? "";
    const city = input.city ?? "";
    const stateValue = input.state ?? "";
    const phone = input.phone ?? "";
    const emailValue = input.email ?? "";
    const manager = input.manager ?? "";
    const cnpj = digits(input.cnpj ?? "");
    if (cnpj && cnpj.length !== 14) throw new Error("CNPJ");
    const email = emailValue.trim().slice(0, 190);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("EMAIL");
    const [duplicates] = await this.pool.query<RowDataPacket[]>(
      `SELECT id FROM branches WHERE code = ? AND deleted_at IS NULL AND (? IS NULL OR id <> ?) LIMIT 1`,
      [code, input.id || null, input.id || null],
    );
    if (duplicates.length) throw new Error("CODE_IN_USE");
    const state = stateValue.trim().toUpperCase().slice(0, 2);
    const openedAt = /^\d{4}-\d{2}-\d{2}$/.test(input.openedAt ?? "") ? input.openedAt ?? null : null;
    const costCenterId = await this.costCenterId(input.costCenter ?? "");
    const regionId = await this.regionId(input.region ?? "");
    const managerId = await this.managerId(manager);
    const values = [
      code, name, input.type, legalName.trim().slice(0, 200) || null, cnpj || null,
      address.trim().slice(0, 250) || null, city.trim().slice(0, 100) || null, state || null,
      phone.trim().slice(0, 30) || null, email || null, managerId, manager.trim().slice(0, 150) || null,
      costCenterId, regionId, openedAt,
    ];
    const id = await transaction(this.pool, async (connection) => {
      let branchId = input.id ?? "";
      if (!branchId) {
        const [created] = await connection.query<ResultSetHeader>(
          `INSERT INTO branches (code, name, type, legal_name, cnpj, address, city, state, phone, email, manager_user_id, manager_name, cost_center_id, region_id, active, opened_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          values,
        );
        branchId = String(created.insertId);
      } else {
        const [updated] = await connection.query<ResultSetHeader>(
          `UPDATE branches
           SET code = ?, name = ?, type = ?, legal_name = ?, cnpj = ?, address = ?, city = ?, state = ?, phone = ?, email = ?,
               manager_user_id = ?, manager_name = ?, cost_center_id = ?, region_id = ?, opened_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
          [...values, branchId],
        );
        if (!updated.affectedRows) throw new Error("NOT_FOUND");
      }
      await this.saveWarehouses(connection, branchId, input.warehouses ?? []);
      return branchId;
    });
    return id;
  }

  async setActive(id: string, active: boolean) {
    const [updated] = await this.pool.query<ResultSetHeader>(
      `UPDATE branches SET active = ? WHERE id = ? AND deleted_at IS NULL`,
      [active ? 1 : 0, id],
    );
    if (!updated.affectedRows) throw new Error("NOT_FOUND");
  }

  private mapBranch(row: BranchRow, warehouses: WarehouseInput[]) {
    return {
      id: String(row.id),
      code: text(row.code),
      name: text(row.name),
      type: row.type,
      legalName: text(row.legal_name),
      cnpj: formatCnpj(text(row.cnpj)),
      address: text(row.address),
      city: text(row.city),
      state: text(row.state),
      phone: text(row.phone),
      email: text(row.email),
      manager: text(row.manager_name),
      costCenter: text(row.cost_center),
      region: text(row.region),
      active: Number(row.active) === 1,
      openedAt: text(row.opened_at).slice(0, 10),
      warehouses,
    };
  }

  private async warehouses(ids: string[]) {
    const grouped = new Map<string, WarehouseInput[]>();
    if (!ids.length) return grouped;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT w.id, w.branch_id, w.name, l.description
       FROM warehouses w
       LEFT JOIN warehouse_locations l ON l.warehouse_id = w.id AND l.active = 1
       WHERE w.active = 1 AND w.branch_id IN (${ids.map(() => "?").join(",")})
       ORDER BY w.id, l.id`,
      ids,
    );
    for (const row of rows) {
      const branchId = String(row.branch_id);
      const list = grouped.get(branchId) ?? [];
      const id = String(row.id);
      let warehouse = list.find((item) => item.id === id);
      if (!warehouse) {
        warehouse = { id, name: text(row.name), locations: [] };
        list.push(warehouse);
      }
      if (row.description) (warehouse.locations ??= []).push(text(row.description));
      grouped.set(branchId, list);
    }
    return grouped;
  }

  private async costCenterId(code: string) {
    const value = code.trim().slice(0, 30);
    if (!value) return null;
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT id FROM cost_centers WHERE code = ? LIMIT 1`, [value]);
    if (rows[0]) return String(rows[0].id);
    const [created] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO cost_centers (code, name, active) VALUES (?, ?, 1)`,
      [value, value],
    );
    return String(created.insertId);
  }

  private async regionId(name: string) {
    const value = name.trim().slice(0, 80);
    if (!value) return null;
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT id FROM regions WHERE name = ? LIMIT 1`, [value]);
    if (rows[0]) return String(rows[0].id);
    const [created] = await this.pool.query<ResultSetHeader>(`INSERT INTO regions (name) VALUES (?)`, [value]);
    return String(created.insertId);
  }

  private async managerId(name: string) {
    const value = name.trim();
    if (!value) return null;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id FROM users WHERE name = ? AND deleted_at IS NULL LIMIT 1`,
      [value.slice(0, 150)],
    );
    return rows[0] ? String(rows[0].id) : null;
  }

  private async saveWarehouses(connection: { query: Pool["query"] }, branchId: string, warehouses: WarehouseInput[]) {
    const [current] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM warehouses WHERE branch_id = ? AND active = 1`,
      [branchId],
    );
    const kept = new Set<string>();
    let sequence = current.length;
    for (const warehouse of warehouses) {
      const name = warehouse.name.trim().slice(0, 120);
      if (!name) continue;
      const warehouseKey = warehouse.id ?? "";
      const owned = current.some((row) => String(row.id) === warehouseKey);
      let warehouseId = owned ? warehouseKey : "";
      if (!warehouseId) {
        sequence += 1;
        const [created] = await connection.query<ResultSetHeader>(
          `INSERT INTO warehouses (branch_id, code, name, is_default, active) VALUES (?, ?, ?, ?, 1)`,
          [branchId, `W${branchId}-${sequence}`.slice(0, 20), name, sequence === 1 ? 1 : 0],
        );
        warehouseId = String(created.insertId);
      } else {
        await connection.query(`UPDATE warehouses SET name = ? WHERE id = ? AND branch_id = ?`, [name, warehouseId, branchId]);
      }
      kept.add(warehouseId);
      await this.saveLocations(connection, warehouseId, warehouse.locations ?? []);
    }
    for (const row of current) {
      const id = String(row.id);
      if (kept.has(id)) continue;
      const [stock] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(qty), 0) AS qty FROM stock_balances WHERE warehouse_id = ?`,
        [id],
      );
      if (Number(stock[0]?.qty) > 0) throw new Error("WAREHOUSE_STOCK");
      await connection.query(`UPDATE warehouses SET active = 0 WHERE id = ?`, [id]);
    }
  }

  private async saveLocations(connection: { query: Pool["query"] }, warehouseId: string, locations: string[]) {
    const names = [...new Set(locations.map((item) => item.trim().slice(0, 150)).filter(Boolean))];
    const [current] = await connection.query<RowDataPacket[]>(
      `SELECT id, description FROM warehouse_locations WHERE warehouse_id = ? AND active = 1`,
      [warehouseId],
    );
    const kept = new Set<string>();
    let sequence = current.length;
    for (const name of names) {
      const existing = current.find((row) => text(row.description) === name);
      if (existing) {
        kept.add(String(existing.id));
        continue;
      }
      sequence += 1;
      await connection.query(
        `INSERT INTO warehouse_locations (warehouse_id, code, description, active) VALUES (?, ?, ?, 1)`,
        [warehouseId, `L${sequence}`.slice(0, 40), name],
      );
    }
    for (const row of current) {
      if (kept.has(String(row.id))) continue;
      const [used] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM stock_balances WHERE location_id = ? AND qty <> 0 LIMIT 1`,
        [row.id],
      );
      if (!used.length) await connection.query(`UPDATE warehouse_locations SET active = 0 WHERE id = ?`, [row.id]);
    }
  }
}
