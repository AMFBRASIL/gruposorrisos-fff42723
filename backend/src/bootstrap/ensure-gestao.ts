import type { Pool, RowDataPacket } from "../database/pool.js";

export async function ensureGestao(pool: Pool, log: (message: string) => void) {
  const [columns] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'sees_all_branches'`,
  );
  if (!columns.length) {
    await pool.query(`ALTER TABLE users ADD COLUMN sees_all_branches tinyint(1) NOT NULL DEFAULT 0`);
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_projects (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      name varchar(160) NOT NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_tasks (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      project_id bigint unsigned DEFAULT NULL,
      assignee_id bigint unsigned DEFAULT NULL,
      title varchar(200) NOT NULL,
      department varchar(80) NOT NULL DEFAULT '',
      status varchar(40) NOT NULL,
      due_date date DEFAULT NULL,
      completed_at datetime DEFAULT NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_work_tasks_project (project_id),
      KEY idx_work_tasks_assignee (assignee_id),
      CONSTRAINT fk_work_tasks_project FOREIGN KEY (project_id) REFERENCES work_projects (id),
      CONSTRAINT fk_work_tasks_user FOREIGN KEY (assignee_id) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_records (
      kind varchar(40) NOT NULL,
      record_id varchar(80) NOT NULL,
      payload json NOT NULL,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (kind, record_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  log("Gestão verificada.");
}
