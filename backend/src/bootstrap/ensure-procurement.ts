import type { Pool, RowDataPacket } from "../database/pool.js";

export async function ensureProcurement(pool: Pool, log: (message: string) => void) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_workflow_templates (
      kind VARCHAR(20) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      steps JSON NOT NULL
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_meta (
      doc_type VARCHAR(32) NOT NULL,
      doc_id BIGINT UNSIGNED NOT NULL,
      workflow JSON NULL,
      PRIMARY KEY (doc_type, doc_id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_commitments (
      ref_key VARCHAR(40) PRIMARY KEY,
      branch_id BIGINT UNSIGNED NOT NULL,
      period CHAR(7) NOT NULL,
      committed_value DECIMAL(15,2) NOT NULL,
      spent_value DECIMAL(15,2) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_portal_profiles (
      supplier_id BIGINT UNSIGNED PRIMARY KEY,
      contact_name VARCHAR(150) NULL,
      email VARCHAR(190) NULL
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_requests (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      number VARCHAR(30) NOT NULL UNIQUE,
      branch_id BIGINT UNSIGNED NOT NULL,
      supplier_id BIGINT UNSIGNED NOT NULL,
      requester_id BIGINT UNSIGNED NOT NULL,
      priority ENUM('baixa','normal','alta','urgente') NOT NULL DEFAULT 'normal',
      status ENUM('rascunho','aguardando','resposta','correcao','aprovado','cancelado','expirado') NOT NULL DEFAULT 'rascunho',
      desired_date DATE NULL,
      notes TEXT NULL,
      published_at DATETIME NULL,
      purchase_order_id BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_sr_sup_status (supplier_id, status),
      CONSTRAINT fk_sr_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
      CONSTRAINT fk_sr_sup FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      CONSTRAINT fk_sr_req FOREIGN KEY (requester_id) REFERENCES users(id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_request_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      request_id BIGINT UNSIGNED NOT NULL,
      material_id BIGINT UNSIGNED NOT NULL,
      requested_qty DECIMAL(15,3) NOT NULL,
      reference_price DECIMAL(15,4) NULL,
      supplier_code VARCHAR(60) NULL,
      UNIQUE KEY uq_sri (request_id, material_id),
      CONSTRAINT chk_sri CHECK (requested_qty > 0),
      CONSTRAINT fk_sri_req FOREIGN KEY (request_id) REFERENCES supplier_requests(id) ON DELETE CASCADE,
      CONSTRAINT fk_sri_mat FOREIGN KEY (material_id) REFERENCES materials(id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_responses (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      request_id BIGINT UNSIGNED NOT NULL,
      version SMALLINT UNSIGNED NOT NULL,
      responded_by BIGINT UNSIGNED NOT NULL,
      channel ENUM('portal','interno') NOT NULL DEFAULT 'portal',
      source ENUM('manual','csv') NOT NULL DEFAULT 'manual',
      file_name VARCHAR(255) NULL,
      total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_resp_ver (request_id, version),
      CONSTRAINT fk_resp_req FOREIGN KEY (request_id) REFERENCES supplier_requests(id) ON DELETE CASCADE,
      CONSTRAINT fk_resp_user FOREIGN KEY (responded_by) REFERENCES users(id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_response_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      response_id BIGINT UNSIGNED NOT NULL,
      request_item_id BIGINT UNSIGNED NOT NULL,
      offered_qty DECIMAL(15,3) NOT NULL,
      unit_price DECIMAL(15,4) NOT NULL,
      supplier_code VARCHAR(60) NULL,
      UNIQUE KEY uq_respi (response_id, request_item_id),
      CONSTRAINT chk_respi CHECK (offered_qty >= 0 AND unit_price >= 0),
      CONSTRAINT fk_respi_resp FOREIGN KEY (response_id) REFERENCES supplier_responses(id) ON DELETE CASCADE,
      CONSTRAINT fk_respi_item FOREIGN KEY (request_item_id) REFERENCES supplier_request_items(id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      number VARCHAR(30) NOT NULL UNIQUE,
      branch_id BIGINT UNSIGNED NOT NULL,
      supplier_id BIGINT UNSIGNED NULL,
      supplier_request_id BIGINT UNSIGNED NULL,
      status ENUM('requisicao','cotacao','aprovado','enviado','recebido_parcial','recebido','cancelado') NOT NULL DEFAULT 'requisicao',
      quote_mode ENUM('cost','balanced') NOT NULL DEFAULT 'cost',
      subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
      freight DECIMAL(15,2) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_by BIGINT UNSIGNED NOT NULL,
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_po_status (status, branch_id),
      CONSTRAINT fk_po_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
      CONSTRAINT fk_po_sup FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      CONSTRAINT fk_po_sr FOREIGN KEY (supplier_request_id) REFERENCES supplier_requests(id) ON DELETE SET NULL,
      CONSTRAINT fk_po_created FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      purchase_order_id BIGINT UNSIGNED NOT NULL,
      material_id BIGINT UNSIGNED NOT NULL,
      qty DECIMAL(15,3) NOT NULL,
      received_qty DECIMAL(15,3) NOT NULL DEFAULT 0,
      damaged_qty DECIMAL(15,3) NOT NULL DEFAULT 0,
      chosen_supplier_id BIGINT UNSIGNED NULL,
      unit_price DECIMAL(15,4) NULL,
      UNIQUE KEY uq_poi (purchase_order_id, material_id),
      CONSTRAINT chk_poi CHECK (qty > 0 AND received_qty + damaged_qty <= qty),
      CONSTRAINT fk_poi_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_poi_mat FOREIGN KEY (material_id) REFERENCES materials(id),
      CONSTRAINT fk_poi_sup FOREIGN KEY (chosen_supplier_id) REFERENCES suppliers(id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_quotes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      purchase_order_item_id BIGINT UNSIGNED NOT NULL,
      supplier_id BIGINT UNSIGNED NOT NULL,
      unit_price DECIMAL(15,4) NOT NULL,
      delivery_days SMALLINT UNSIGNED NOT NULL,
      freight DECIMAL(15,2) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pq (purchase_order_item_id, supplier_id),
      CONSTRAINT fk_pq_item FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items(id) ON DELETE CASCADE,
      CONSTRAINT fk_pq_sup FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_receipts (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      purchase_order_id BIGINT UNSIGNED NOT NULL,
      notes VARCHAR(1000) NULL,
      has_divergence TINYINT(1) NOT NULL DEFAULT 0,
      user_id BIGINT UNSIGNED NOT NULL,
      received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_prc_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_prc_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_receipt_items (
      receipt_id BIGINT UNSIGNED NOT NULL,
      purchase_order_item_id BIGINT UNSIGNED NOT NULL,
      accepted_qty DECIMAL(15,3) NOT NULL DEFAULT 0,
      damaged_qty DECIMAL(15,3) NOT NULL DEFAULT 0,
      actual_price DECIMAL(15,4) NULL,
      PRIMARY KEY (receipt_id, purchase_order_item_id),
      CONSTRAINT chk_pri CHECK (accepted_qty >= 0 AND damaged_qty >= 0),
      CONSTRAINT fk_prci_rec FOREIGN KEY (receipt_id) REFERENCES purchase_receipts(id) ON DELETE CASCADE,
      CONSTRAINT fk_prci_item FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items(id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_budgets (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      branch_id BIGINT UNSIGNED NOT NULL,
      period CHAR(7) NOT NULL,
      limit_value DECIMAL(15,2) NOT NULL,
      block_on_exceed TINYINT(1) NOT NULL DEFAULT 0,
      updated_by BIGINT UNSIGNED NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_budget (branch_id, period),
      CONSTRAINT chk_budget CHECK (limit_value >= 0),
      CONSTRAINT fk_bud_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
      CONSTRAINT fk_bud_user FOREIGN KEY (updated_by) REFERENCES users(id)
    ) ENGINE=InnoDB
  `);
  const [fileName] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM supplier_responses LIKE 'file_name'");
  if (!fileName.length) await pool.query("ALTER TABLE supplier_responses ADD COLUMN file_name VARCHAR(255) NULL");

  const [templates] = await pool.query<RowDataPacket[]>("SELECT kind FROM procurement_workflow_templates");
  if (!templates.length) {
    const [roles] = await pool.query<RowDataPacket[]>("SELECT id FROM erp_roles WHERE code = 'superadmin' LIMIT 1");
    const roleId = roles[0] ? String(roles[0].id) : "";
    if (roleId) {
      const cd = JSON.stringify([{ id: "approval", name: "Aprovação da filial", assigneeType: "role", assigneeId: roleId, hours: 48, requireNote: false }]);
      const supplier = JSON.stringify([{ id: "review", name: "Conferência de Compras", assigneeType: "role", assigneeId: roleId, hours: 48, requireNote: false }]);
      await pool.query("INSERT INTO procurement_workflow_templates (kind, name, steps) VALUES ('cd', 'Aprovação de materiais', ?), ('supplier', 'Conferência de compra', ?)", [cd, supplier]);
    }
  }
  log("Compras e pedidos verificados.");
}
