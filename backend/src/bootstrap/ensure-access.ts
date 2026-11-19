import type { Pool, ResultSetHeader, RowDataPacket } from "../database/pool.js";
import type { Env } from "../config/env.js";
import { hashPassword } from "../modules/auth/password.js";

type CountRow = RowDataPacket & { n: number };
type IdRow = RowDataPacket & { id: number | string };

async function tableExists(pool: Pool, name: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [name],
  );
  return rows.length > 0;
}

/**
 * Não altera senha de quem já existe. Só cria o administrador inicial
 * quando o banco de acesso está vazio.
 */
export async function ensureAccess(pool: Pool, env: Env, log: (message: string) => void) {
  if (!(await tableExists(pool, "users")) || !(await tableExists(pool, "user_sessions"))) {
    throw new Error("O banco não tem as tabelas de acesso (users, user_sessions). Importe o script SQL em gruposorrisosnew.");
  }

  const [counts] = await pool.query<CountRow[]>(
    "SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND password_hash IS NOT NULL",
  );
  const existing = Number(counts[0]?.n ?? 0);
  if (existing > 0) {
    log(`Acesso já provisionado (${existing} usuário(s) com senha).`);
    return;
  }

  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!password) throw new Error("Defina BOOTSTRAP_ADMIN_PASSWORD para criar o primeiro administrador.");

  const passwordHash = await hashPassword(password);
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (name, email, password_hash, user_type, job_title, initials, color, active, email_verified_at)
     VALUES (?, ?, ?, 'interno', 'Administrador', 'AD', '#0f766e', 1, UTC_TIMESTAMP())`,
    [env.BOOTSTRAP_ADMIN_NAME, env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase(), passwordHash],
  );

  if (await tableExists(pool, "erp_roles") && (await tableExists(pool, "user_branch_memberships"))) {
    const [roles] = await pool.query<IdRow[]>("SELECT id FROM erp_roles WHERE code = 'superadmin' LIMIT 1");
    const roleId = roles[0]?.id;
    if (roleId != null) {
      await pool.query(
        `INSERT INTO user_branch_memberships (user_id, branch_id, role_id)
         SELECT ?, NULL, ? FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM user_branch_memberships WHERE user_id = ? AND role_id = ? AND branch_id IS NULL
         )`,
        [result.insertId, roleId, result.insertId, roleId],
      );
    }
  }

  log(`Administrador inicial criado: ${env.BOOTSTRAP_ADMIN_EMAIL}`);
}
