import type { Pool, ResultSetHeader, RowDataPacket } from "../../database/pool.js";
import { toMysqlUtc, transaction } from "../../database/pool.js";
import type { AuthMembership, AuthUser } from "./auth.types.js";

type CredentialRow = RowDataPacket & {
  id: number | string;
  password_hash: string | null;
  active: number;
  failed_logins: number;
  is_locked: number;
};

type UserRow = RowDataPacket & {
  id: number | string;
  name: string;
  email: string;
  initials: string | null;
  color: string | null;
  job_title: string | null;
  user_type: AuthUser["userType"];
  profile_name: string | null;
  profile_code: string | null;
  sees_all_branches: number;
};

type MembershipRow = RowDataPacket & {
  branch_id: number | string | null;
  branch_code: string | null;
  branch_name: string | null;
  role_code: string;
  role_name: string;
  scope: "all" | "assigned";
};

type CodeRow = RowDataPacket & { code: string };
type PageRow = RowDataPacket & { path: string };
type SessionRow = RowDataPacket & { id: number | string; user_id: number | string };

const asId = (value: number | string | null | undefined) => (value == null ? null : String(value));

function initialsOf(name: string, stored: string | null) {
  if (stored?.trim()) return stored.trim().slice(0, 4);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GS";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export class AuthRepository {
  constructor(private readonly pool: Pool) {}

  async findCredentials(email: string) {
    const [rows] = await this.pool.query<CredentialRow[]>(
      `SELECT id, password_hash, active, failed_logins,
              (locked_until IS NOT NULL AND locked_until > UTC_TIMESTAMP()) AS is_locked
       FROM users
       WHERE email = ? AND deleted_at IS NULL
       LIMIT 1`,
      [email],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      passwordHash: row.password_hash,
      active: Number(row.active) === 1,
      failedLogins: Number(row.failed_logins),
      locked: Number(row.is_locked) === 1,
    };
  }

  async passwordHash(userId: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    const hash = rows[0]?.password_hash;
    return typeof hash === "string" && hash ? hash : null;
  }

  async setPassword(userId: string, passwordHash: string) {
    const [updated] = await this.pool.query<ResultSetHeader>(
      `UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ? AND deleted_at IS NULL`,
      [passwordHash, userId],
    );
    if (!updated.affectedRows) throw new Error("NOT_FOUND");
  }

  async registerFailure(userId: string) {
    await this.pool.query(
      `UPDATE users
       SET failed_logins = failed_logins + 1,
           locked_until = IF(failed_logins + 1 >= 5, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), locked_until)
       WHERE id = ? AND deleted_at IS NULL`,
      [userId],
    );
  }

  async ipStatus(userId: string, ip: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, SUM(ip = ?) AS matches FROM user_sessions WHERE user_id = ?`,
      [ip, userId],
    );
    const total = Number(rows[0]?.total ?? 0);
    const matches = Number(rows[0]?.matches ?? 0);
    return total === 0 || matches > 0 ? "known" as const : "new" as const;
  }

  async openSession(input: {
    userId: string;
    tokenHash: string;
    ip: string | null;
    userAgent: string | null;
    expiresAt: Date;
  }) {
    return transaction(this.pool, async (connection) => {
      await connection.query(
        `UPDATE users
         SET failed_logins = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [input.userId],
      );
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO user_sessions (user_id, token_hash, ip, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [input.userId, input.tokenHash, input.ip, input.userAgent, toMysqlUtc(input.expiresAt)],
      );
      return String(result.insertId);
    });
  }

  async findActiveSession(sessionId: string) {
    const [rows] = await this.pool.query<SessionRow[]>(
      `SELECT id, user_id
       FROM user_sessions
       WHERE id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      [sessionId],
    );
    const row = rows[0];
    return row ? { id: String(row.id), userId: String(row.user_id) } : null;
  }

  async findActiveSessionByHash(tokenHash: string) {
    const [rows] = await this.pool.query<SessionRow[]>(
      `SELECT id, user_id
       FROM user_sessions
       WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      [tokenHash],
    );
    const row = rows[0];
    return row ? { id: String(row.id), userId: String(row.user_id) } : null;
  }

  async extendSession(sessionId: string, expiresAt: Date) {
    await this.pool.query(
      `UPDATE user_sessions SET expires_at = ? WHERE id = ? AND revoked_at IS NULL`,
      [toMysqlUtc(expiresAt), sessionId],
    );
  }

  async revokeByHash(tokenHash: string) {
    await this.pool.query(
      `UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP()
       WHERE token_hash = ? AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  async recordAudit(userId: string, sessionId: string, event: "login" | "logout", ip: string | null) {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (user_id, table_name, record_id, operation, new_values, ip)
         VALUES (?, 'user_sessions', ?, ?, JSON_OBJECT('event', ?), ?)`,
        [userId, sessionId, event === "login" ? "INSERT" : "UPDATE", event, ip],
      );
    } catch {
      // Auditoria não pode impedir o acesso.
    }
  }

  async loadProfile(userId: string): Promise<AuthUser | null> {
    const [users] = await this.pool.query<UserRow[]>(
      `SELECT u.id, u.name, u.email, u.initials, u.color, u.job_title, u.user_type,
              ap.name AS profile_name, ap.code AS profile_code, u.sees_all_branches
       FROM users u
       LEFT JOIN access_profiles ap ON ap.id = u.access_profile_id
       WHERE u.id = ? AND u.deleted_at IS NULL
       LIMIT 1`,
      [userId],
    );
    const user = users[0];
    if (!user) return null;

    const [memberships] = await this.pool.query<MembershipRow[]>(
      `SELECT m.branch_id, b.code AS branch_code, b.name AS branch_name,
              r.code AS role_code, r.name AS role_name, r.scope
       FROM user_branch_memberships m
       JOIN erp_roles r ON r.id = m.role_id
       LEFT JOIN branches b ON b.id = m.branch_id
       WHERE m.user_id = ?
       ORDER BY m.id`,
      [userId],
    );

    const [permissions] = await this.pool.query<CodeRow[]>(
      `SELECT DISTINCT p.code
       FROM user_branch_memberships m
       JOIN erp_role_permissions rp ON rp.role_id = m.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE m.user_id = ?
       ORDER BY p.code`,
      [userId],
    );

    const [pages] = await this.pool.query<PageRow[]>(
      `SELECT sp.path
       FROM system_pages sp
       JOIN users u ON u.id = ?
       LEFT JOIN access_profile_pages app
         ON app.page_id = sp.id AND app.access_profile_id = u.access_profile_id
       LEFT JOIN user_page_access upa
         ON upa.page_id = sp.id AND upa.user_id = u.id
       WHERE COALESCE(upa.allowed, app.allowed, 0) = 1
       ORDER BY sp.sort_order`,
      [userId],
    );

    const seesAll = Number(user.sees_all_branches) === 1;
    const mappedMemberships: AuthMembership[] = memberships.map((row) => ({
      branchId: asId(row.branch_id),
      branchCode: row.branch_code,
      branchName: row.branch_name,
      roleCode: row.role_code,
      roleName: row.role_name,
      scope: seesAll ? "all" : row.scope,
    }));

    return {
      id: String(user.id),
      name: user.name,
      email: user.email,
      initials: initialsOf(user.name, user.initials),
      color: user.color?.trim() || "#0f766e",
      jobTitle: user.job_title,
      userType: user.user_type,
      profileName: user.profile_name,
      profileCode: user.profile_code,
      permissions: permissions.map((row) => row.code),
      pages: pages.map((row) => row.path),
      memberships: mappedMemberships,
    };
  }
}
