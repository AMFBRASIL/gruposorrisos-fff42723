import type { Pool, ResultSetHeader, RowDataPacket } from "../database/pool.js";

const CATEGORIES: [string, number][] = [
  ["Materiais odontológicos", 0],
  ["Descartáveis", 0],
  ["Equipamentos", 0],
  ["Instrumentais", 0],
  ["Limpeza", 0],
  ["Escritório", 0],
  ["EPIs", 1],
  ["Administrativos", 0],
  ["Outros", 0],
];

const EXTRA_UNITS: [string, string, number][] = [
  ["un", "Unidade", 0],
  ["cx", "Caixa", 0],
  ["pct", "Pacote", 0],
  ["fr", "Frasco", 0],
  ["tb", "Tubo", 0],
  ["ml", "Mililitro", 1],
  ["l", "Litro", 1],
  ["g", "Grama", 1],
  ["kg", "Quilograma", 1],
  ["par", "Par", 0],
  ["kit", "Kit", 0],
  ["rolo", "Rolo", 0],
];

const REASONS: [string, string, string, number, number][] = [
  ["compra", "Entrada por compra", "entrada", 0, 0],
  ["devolucao", "Devolução", "entrada", 1, 0],
  ["recebimento_cd", "Recebimento do CD", "entrada", 0, 0],
  ["consumo", "Consumo clínico", "saida", 0, 0],
  ["procedimento", "Consumo por procedimento", "saida", 0, 0],
  ["perda", "Perda / avaria", "saida", 1, 1],
  ["vencimento", "Descarte por vencimento", "saida", 1, 1],
  ["transferencia", "Transferência entre filiais", "transferencia", 0, 0],
  ["ajuste_inventario", "Ajuste de inventário", "ajuste", 1, 1],
];

export async function ensureStock(pool: Pool, log: (message: string) => void) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_settings (
      id TINYINT UNSIGNED PRIMARY KEY,
      approval_limit DECIMAL(15,2) NOT NULL DEFAULT 500,
      expiry_alert_days SMALLINT UNSIGNED NOT NULL DEFAULT 60
    ) ENGINE=InnoDB
  `);
  await pool.query("INSERT IGNORE INTO stock_settings (id, approval_limit, expiry_alert_days) VALUES (1, 500, 60)");

  for (const [name, requiresCa] of CATEGORIES) {
    const [found] = await pool.query<RowDataPacket[]>("SELECT id FROM material_categories WHERE name = ? AND parent_id IS NULL LIMIT 1", [name]);
    if (!found.length) {
      await pool.query("INSERT INTO material_categories (parent_id, name, requires_ca) VALUES (NULL, ?, ?)", [name, requiresCa]);
    }
  }

  for (const [code, name, fraction] of EXTRA_UNITS) {
    await pool.query("INSERT IGNORE INTO units_of_measure (code, name, allows_fraction) VALUES (?, ?, ?)", [code, name, fraction]);
  }
  for (const [code, name, direction, note, approval] of REASONS) {
    await pool.query(
      "INSERT IGNORE INTO movement_reasons (code, name, direction, requires_note, requires_approval) VALUES (?, ?, ?, ?, ?)",
      [code, name, direction, note, approval],
    );
  }

  const [cd] = await pool.query<RowDataPacket[]>("SELECT id FROM branches WHERE type = 'cd' AND deleted_at IS NULL LIMIT 1");
  if (!cd.length) {
    const [created] = await pool.query<ResultSetHeader>(
      `INSERT INTO branches (code, name, type, city, state, active) VALUES ('CD', 'Centro de Distribuição', 'cd', 'São Paulo', 'SP', 1)`,
    );
    log(`Filial de distribuição criada (${created.insertId}) para o fluxo de transferências.`);
  }

  const [branches] = await pool.query<RowDataPacket[]>("SELECT id FROM branches WHERE deleted_at IS NULL AND active = 1");
  for (const branch of branches) {
    const [warehouse] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM warehouses WHERE branch_id = ? AND active = 1 LIMIT 1",
      [branch.id],
    );
    if (!warehouse.length) {
      await pool.query(
        "INSERT INTO warehouses (branch_id, code, name, is_default, active) VALUES (?, 'PRIN', 'Principal', 1, 1)",
        [branch.id],
      );
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_alert_rules (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      branch_id BIGINT UNSIGNED NULL,
      type ENUM('abaixo_minimo','acima_maximo','vencimento','ruptura','pedido_duplicado','ca_vencendo') NOT NULL,
      days_before SMALLINT UNSIGNED NULL,
      notify_role_id BIGINT UNSIGNED NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      CONSTRAINT fk_sar_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
      CONSTRAINT fk_sar_role FOREIGN KEY (notify_role_id) REFERENCES erp_roles(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_alerts (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      rule_id BIGINT UNSIGNED NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      material_id BIGINT UNSIGNED NULL,
      lot_id BIGINT UNSIGNED NULL,
      type VARCHAR(40) NOT NULL,
      severity ENUM('info','atencao','critico') NOT NULL DEFAULT 'atencao',
      message VARCHAR(300) NOT NULL,
      resolved_at DATETIME NULL,
      resolved_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_sa_open (branch_id, resolved_at),
      CONSTRAINT fk_sa_rule FOREIGN KEY (rule_id) REFERENCES stock_alert_rules(id) ON DELETE SET NULL,
      CONSTRAINT fk_sa_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
      CONSTRAINT fk_sa_mat FOREIGN KEY (material_id) REFERENCES materials(id),
      CONSTRAINT fk_sa_lot FOREIGN KEY (lot_id) REFERENCES stock_lots(id),
      CONSTRAINT fk_sa_user FOREIGN KEY (resolved_by) REFERENCES users(id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS replenishment_suggestions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      branch_id BIGINT UNSIGNED NOT NULL,
      material_id BIGINT UNSIGNED NOT NULL,
      current_qty DECIMAL(15,3) NOT NULL,
      avg_daily_consumption DECIMAL(15,4) NOT NULL DEFAULT 0,
      coverage_days DECIMAL(9,2) NULL,
      suggested_qty DECIMAL(15,3) NOT NULL,
      status ENUM('aberta','convertida','descartada') NOT NULL DEFAULT 'aberta',
      material_order_id BIGINT UNSIGNED NULL,
      generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_rs (branch_id, status),
      CONSTRAINT fk_rs_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
      CONSTRAINT fk_rs_mat FOREIGN KEY (material_id) REFERENCES materials(id),
      CONSTRAINT fk_rs_mo FOREIGN KEY (material_order_id) REFERENCES material_orders(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_events (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      document_type ENUM('material_order','supplier_request','purchase_order','transfer','inventory','adjustment') NOT NULL,
      document_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(80) NOT NULL,
      from_status VARCHAR(40) NULL,
      to_status VARCHAR(40) NULL,
      note VARCHAR(2000) NULL,
      is_comment TINYINT(1) NOT NULL DEFAULT 0,
      user_id BIGINT UNSIGNED NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_de_doc (document_type, document_id, created_at),
      CONSTRAINT fk_de_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

  const [rules] = await pool.query<RowDataPacket[]>("SELECT id FROM stock_alert_rules LIMIT 1");
  if (!rules.length) {
    await pool.query(
      `INSERT INTO stock_alert_rules (branch_id, type, days_before, active) VALUES
       (NULL, 'abaixo_minimo', NULL, 1), (NULL, 'vencimento', 60, 1)`,
    );
  }

  log("Catálogo de estoque verificado.");
}
