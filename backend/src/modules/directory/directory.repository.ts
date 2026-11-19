import { randomBytes } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "../../database/pool.js";
import { transaction } from "../../database/pool.js";
import { hashPassword } from "../auth/password.js";
import { initialsFrom, profileCodeForRoles, profileCodeFromName, temporaryPassword } from "./directory.rules.js";

export type MembershipInput = { branchId: string; roleId: string };

export type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  profileId: string | null;
  department: string | null;
  memberships: MembershipInput[];
  seesAllBranches: boolean;
};

export type DirectoryRole = {
  id: string;
  name: string;
  description: string;
  scope: "all" | "assigned";
  permissions: string[];
};

export type DirectoryProfile = {
  id: string;
  name: string;
  description: string;
  color: string;
  access: Record<string, boolean>;
};

export type DirectorySnapshot = {
  users: DirectoryUser[];
  roles: DirectoryRole[];
  branches: { id: string; name: string }[];
  profiles: DirectoryProfile[];
  audit: { at: string; userId: string; action: string }[];
};

type IdRow = RowDataPacket & { id: number | string; code?: string };
type UserRow = RowDataPacket & {
  id: number | string;
  name: string;
  email: string;
  initials: string | null;
  color: string | null;
  profile_id: number | string | null;
  department: string | null;
  sees_all_branches: number;
};
type MembershipRow = RowDataPacket & { user_id: number | string; branch_id: number | string | null; role_id: number | string };
type RoleRow = RowDataPacket & { id: number | string; code: string; name: string; description: string | null; scope: "all" | "assigned" };
type PermRow = RowDataPacket & { role_id: number | string; code: string };
type ProfileRow = RowDataPacket & { id: number | string; name: string; description: string | null; color: string | null };
type GrantRow = RowDataPacket & { profile_id: number | string; path: string; allowed: number };
type PageRow = RowDataPacket & { path: string };
type BranchRow = RowDataPacket & { id: number | string; name: string };
type AuditRow = RowDataPacket & { created_at: string; user_id: number | string | null; operation: string; table_name: string; event: string | null };

const asId = (value: number | string | null | undefined) => (value == null ? null : String(value));

function iso(value: string) {
  if (!value) return new Date().toISOString();
  if (value.includes("T")) return value.endsWith("Z") ? value : `${value}Z`;
  return `${value.replace(" ", "T")}Z`;
}

export class DirectoryRepository {
  constructor(private readonly pool: Pool) {}

  async snapshot(): Promise<DirectorySnapshot> {
    const [users] = await this.pool.query<UserRow[]>(
      `SELECT u.id, u.name, u.email, u.initials, u.color, u.access_profile_id AS profile_id, d.name AS department, u.sees_all_branches
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.deleted_at IS NULL AND u.user_type = 'interno'
       ORDER BY u.name`,
    );
    const [memberships] = await this.pool.query<MembershipRow[]>(
      `SELECT user_id, branch_id, role_id FROM user_branch_memberships ORDER BY id`,
    );
    const [roles] = await this.pool.query<RoleRow[]>(
      `SELECT id, code, name, description, scope FROM erp_roles ORDER BY id`,
    );
    const [permissions] = await this.pool.query<PermRow[]>(
      `SELECT rp.role_id, p.code
       FROM erp_role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id`,
    );
    const [branches] = await this.pool.query<BranchRow[]>(
      `SELECT id, name FROM branches WHERE deleted_at IS NULL ORDER BY name`,
    );
    const [profiles] = await this.pool.query<ProfileRow[]>(
      `SELECT id, name, description, color FROM access_profiles ORDER BY id`,
    );
    const [pages] = await this.pool.query<PageRow[]>(`SELECT path FROM system_pages ORDER BY sort_order`);
    const [grants] = await this.pool.query<GrantRow[]>(
      `SELECT g.access_profile_id AS profile_id, sp.path, g.allowed
       FROM access_profile_pages g
       JOIN system_pages sp ON sp.id = g.page_id`,
    );
    const [audit] = await this.pool.query<AuditRow[]>(
      `SELECT created_at, user_id, operation, table_name,
              JSON_UNQUOTE(JSON_EXTRACT(new_values, '$.event')) AS event
       FROM audit_logs
       WHERE table_name IN ('users', 'access_profiles', 'access_profile_pages', 'erp_role_permissions', 'user_branch_memberships')
       ORDER BY created_at DESC
       LIMIT 40`,
    );

    const membershipsByUser = new Map<string, MembershipInput[]>();
    for (const row of memberships) {
      const list = membershipsByUser.get(String(row.user_id)) ?? [];
      if (row.branch_id != null) list.push({ branchId: String(row.branch_id), roleId: String(row.role_id) });
      membershipsByUser.set(String(row.user_id), list);
    }
    const permissionsByRole = new Map<string, string[]>();
    for (const row of permissions) {
      const list = permissionsByRole.get(String(row.role_id)) ?? [];
      list.push(row.code);
      permissionsByRole.set(String(row.role_id), list);
    }
    const grantsByProfile = new Map<string, Map<string, boolean>>();
    for (const row of grants) {
      const map = grantsByProfile.get(String(row.profile_id)) ?? new Map<string, boolean>();
      map.set(row.path, Number(row.allowed) === 1);
      grantsByProfile.set(String(row.profile_id), map);
    }

    return {
      users: users.map((row) => ({
        id: String(row.id),
        name: row.name,
        email: row.email,
        initials: row.initials?.trim() || initialsFrom(row.name),
        color: row.color?.trim() || "#0f766e",
        profileId: asId(row.profile_id),
        department: row.department,
        memberships: membershipsByUser.get(String(row.id)) ?? [],
        seesAllBranches: Number(row.sees_all_branches) === 1,
      })),
      roles: roles.map((row) => ({
        id: String(row.id),
        name: row.name,
        description: row.description ?? "",
        scope: row.scope,
        permissions: (permissionsByRole.get(String(row.id)) ?? []).sort(),
      })),
      branches: branches.map((row) => ({ id: String(row.id), name: row.name })),
      profiles: profiles.map((row) => {
        const granted = grantsByProfile.get(String(row.id)) ?? new Map<string, boolean>();
        const access: Record<string, boolean> = {};
        for (const page of pages) access[page.path] = granted.get(page.path) ?? false;
        return {
          id: String(row.id),
          name: row.name,
          description: row.description ?? "",
          color: row.color?.trim() || "oklch(0.6 0.18 260)",
          access,
        };
      }),
      audit: audit.map((row) => ({
        at: iso(String(row.created_at)),
        userId: asId(row.user_id) ?? "",
        action: row.event || `${row.operation} ${row.table_name}`,
      })),
    };
  }

  async saveUser(input: {
    id?: string;
    actorId: string;
    name: string;
    email: string;
    initials: string;
    color: string;
    profileId?: string | null;
    department?: string | null;
    memberships: MembershipInput[];
    seesAllBranches?: boolean;
    ip: string | null;
  }) {
    const email = input.email.trim().toLowerCase();
    const [duplicates] = await this.pool.query<IdRow[]>(
      `SELECT id FROM users WHERE email = ? AND deleted_at IS NULL AND (? IS NULL OR id <> ?) LIMIT 1`,
      [email, input.id ?? null, input.id ?? null],
    );
    if (duplicates.length) throw new Error("EMAIL_IN_USE");

    const memberships = await this.normalizeMemberships(input.memberships);
    const profileId = input.profileId === undefined ? await this.profileForMemberships(input.id, memberships) : input.profileId;
    const departmentId = input.department === undefined ? undefined : await this.departmentId(input.department);
    const temporary = input.id ? undefined : temporaryPassword(randomBytes(12));
    const passwordHash = temporary ? await hashPassword(temporary) : null;

    const userId = await transaction(this.pool, async (connection) => {
      if (!input.id) {
        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO users (name, email, password_hash, user_type, initials, color, access_profile_id, department_id, sees_all_branches, active, email_verified_at)
           VALUES (?, ?, ?, 'interno', ?, ?, ?, ?, ?, 1, UTC_TIMESTAMP())`,
          [input.name.trim(), email, passwordHash, input.initials, input.color, profileId, departmentId ?? null, input.seesAllBranches ? 1 : 0],
        );
        await this.replaceMemberships(connection, String(result.insertId), memberships);
        await this.audit(connection, input.actorId, "users", String(result.insertId), "INSERT", `Cadastrou ${input.name.trim()}`, input.ip);
        return String(result.insertId);
      }

      const fields = ["name = ?", "email = ?", "initials = ?", "color = ?"];
      const params: Array<string | null> = [input.name.trim(), email, input.initials, input.color];
      if (input.profileId !== undefined) {
        fields.push("access_profile_id = ?");
        params.push(profileId);
      }
      if (departmentId !== undefined) {
        fields.push("department_id = ?");
        params.push(departmentId);
      }
      if (input.seesAllBranches !== undefined) {
        fields.push("sees_all_branches = ?");
        params.push(input.seesAllBranches ? "1" : "0");
      }
      params.push(input.id);
      const [updated] = await connection.query<ResultSetHeader>(
        `UPDATE users SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
        params,
      );
      if (!updated.affectedRows) throw new Error("NOT_FOUND");
      await this.replaceMemberships(connection, input.id, memberships);
      await this.audit(connection, input.actorId, "users", input.id, "UPDATE", `Alterou ${input.name.trim()}`, input.ip);
      return input.id;
    });

    return { id: userId, temporaryPassword: temporary };
  }

  async saveProfile(input: {
    id?: string;
    actorId: string;
    name: string;
    description: string;
    color: string;
    ip: string | null;
  }) {
    const name = input.name.trim();
    const description = input.description.trim().slice(0, 300);
    const color = input.color.trim().slice(0, 40);
    const [sameName] = await this.pool.query<IdRow[]>(
      `SELECT id FROM access_profiles WHERE LOWER(name) = LOWER(?) AND (? IS NULL OR id <> ?) LIMIT 1`,
      [name, input.id ?? null, input.id ?? null],
    );
    if (sameName.length) throw new Error("NAME_IN_USE");

    return transaction(this.pool, async (connection) => {
      if (!input.id) {
        const code = await this.uniqueCode(name);
        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO access_profiles (code, name, description, color, is_system) VALUES (?, ?, ?, ?, 0)`,
          [code, name, description, color],
        );
        await connection.query(
          `INSERT INTO access_profile_pages (access_profile_id, page_id, allowed)
           SELECT ?, id, 1 FROM system_pages`,
          [result.insertId],
        );
        await this.audit(connection, input.actorId, "access_profiles", String(result.insertId), "INSERT", `Criou o perfil ${name}`, input.ip);
        return String(result.insertId);
      }
      const [updated] = await connection.query<ResultSetHeader>(
        `UPDATE access_profiles SET name = ?, description = ?, color = ? WHERE id = ?`,
        [name, description, color, input.id],
      );
      if (!updated.affectedRows) throw new Error("NOT_FOUND");
      await this.audit(connection, input.actorId, "access_profiles", input.id, "UPDATE", `Alterou o perfil ${name}`, input.ip);
      return input.id;
    });
  }

  async setPageAccess(input: { actorId: string; profileId: string; path: string; allowed: boolean; ip: string | null }) {
    const [pages] = await this.pool.query<IdRow[]>(`SELECT id FROM system_pages WHERE path = ? LIMIT 1`, [input.path]);
    const page = pages[0];
    if (!page) throw new Error("PAGE_NOT_FOUND");
    const [profiles] = await this.pool.query<ProfileRow[]>(`SELECT id, name FROM access_profiles WHERE id = ? LIMIT 1`, [input.profileId]);
    const profile = profiles[0];
    if (!profile) throw new Error("NOT_FOUND");
    await this.pool.query(
      `INSERT INTO access_profile_pages (access_profile_id, page_id, allowed)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)`,
      [input.profileId, page.id, input.allowed ? 1 : 0],
    );
    await this.audit(
      this.pool,
      input.actorId,
      "access_profile_pages",
      input.profileId,
      "UPDATE",
      `${input.allowed ? "Liberou" : "Bloqueou"} ${input.path} para ${profile.name}`,
      input.ip,
    );
  }

  async setRolePermission(input: { actorId: string; roleId: string; code: string; allowed: boolean; ip: string | null }) {
    const [roles] = await this.pool.query<RoleRow[]>(`SELECT id, code, name FROM erp_roles WHERE id = ? LIMIT 1`, [input.roleId]);
    const role = roles[0];
    if (!role) throw new Error("NOT_FOUND");
    if (!input.allowed && input.code === "usuarios.gerenciar" && role.code === "superadmin") throw new Error("LOCKED_PERMISSION");
    const [permissions] = await this.pool.query<IdRow[]>(`SELECT id FROM permissions WHERE code = ? LIMIT 1`, [input.code]);
    const permission = permissions[0];
    if (!permission) throw new Error("PERMISSION_NOT_FOUND");
    if (input.allowed) {
      await this.pool.query(
        `INSERT IGNORE INTO erp_role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [input.roleId, permission.id],
      );
    } else {
      await this.pool.query(
        `DELETE FROM erp_role_permissions WHERE role_id = ? AND permission_id = ?`,
        [input.roleId, permission.id],
      );
    }
    await this.audit(
      this.pool,
      input.actorId,
      "erp_role_permissions",
      input.roleId,
      "UPDATE",
      `${input.allowed ? "Concedeu" : "Removeu"} ${input.code} de ${role.name}`,
      input.ip,
    );
  }

  private async normalizeMemberships(memberships: MembershipInput[]) {
    const unique = new Map<string, MembershipInput>();
    for (const item of memberships) {
      if (!item.branchId || !item.roleId) continue;
      unique.set(`${item.branchId}:${item.roleId}`, item);
    }
    const chosen = [...unique.values()];
    if (chosen.length) {
      const [branches] = await this.pool.query<IdRow[]>(
        `SELECT id FROM branches WHERE id IN (${chosen.map(() => "?").join(",")}) AND deleted_at IS NULL`,
        chosen.map((item) => item.branchId),
      );
      const [roles] = await this.pool.query<IdRow[]>(
        `SELECT id FROM erp_roles WHERE id IN (${chosen.map(() => "?").join(",")})`,
        chosen.map((item) => item.roleId),
      );
      const branchIds = new Set(branches.map((row) => String(row.id)));
      const roleIds = new Set(roles.map((row) => String(row.id)));
      const valid = chosen.filter((item) => branchIds.has(item.branchId) && roleIds.has(item.roleId));
      if (valid.length) return valid;
    }
    const [branch] = await this.pool.query<IdRow[]>(
      `SELECT id FROM branches WHERE deleted_at IS NULL AND active = 1 ORDER BY id LIMIT 1`,
    );
    const [role] = await this.pool.query<IdRow[]>(`SELECT id FROM erp_roles WHERE code = 'colaborador' LIMIT 1`);
    if (!branch[0] || !role[0]) throw new Error("MEMBERSHIP_UNAVAILABLE");
    return [{ branchId: String(branch[0].id), roleId: String(role[0].id) }];
  }

  private async profileForMemberships(userId: string | undefined, memberships: MembershipInput[]) {
    if (userId) return null;
    const [roles] = await this.pool.query<IdRow[]>(
      `SELECT code FROM erp_roles WHERE id IN (${memberships.map(() => "?").join(",")})`,
      memberships.map((item) => item.roleId),
    );
    const code = profileCodeForRoles(roles.map((row) => String(row.code)));
    const [profiles] = await this.pool.query<IdRow[]>(`SELECT id FROM access_profiles WHERE code = ? LIMIT 1`, [code]);
    return asId(profiles[0]?.id);
  }

  private async departmentId(name: string | null) {
    if (!name?.trim()) return null;
    const label = name.trim().slice(0, 80);
    const [rows] = await this.pool.query<IdRow[]>(`SELECT id FROM departments WHERE name = ? LIMIT 1`, [label]);
    if (rows[0]) return asId(rows[0].id);
    const [created] = await this.pool.query<ResultSetHeader>(`INSERT INTO departments (name, active) VALUES (?, 1)`, [label]);
    return String(created.insertId);
  }

  private async replaceMemberships(connection: PoolConnection, userId: string, memberships: MembershipInput[]) {
    await connection.query(`DELETE FROM user_branch_memberships WHERE user_id = ?`, [userId]);
    for (const item of memberships) {
      await connection.query(
        `INSERT INTO user_branch_memberships (user_id, branch_id, role_id) VALUES (?, ?, ?)`,
        [userId, item.branchId, item.roleId],
      );
    }
  }

  private async uniqueCode(name: string) {
    const base = profileCodeFromName(name);
    let code = base;
    for (let attempt = 2; attempt < 50; attempt += 1) {
      const [rows] = await this.pool.query<IdRow[]>(`SELECT id FROM access_profiles WHERE code = ? LIMIT 1`, [code]);
      if (!rows.length) return code;
      code = `${base.slice(0, 36)}-${attempt}`;
    }
    return `${base.slice(0, 32)}-${Date.now().toString(36)}`;
  }

  private async audit(
    runner: Pool | PoolConnection,
    actorId: string,
    table: string,
    recordId: string,
    operation: "INSERT" | "UPDATE",
    event: string,
    ip: string | null,
  ) {
    try {
      await runner.query(
        `INSERT INTO audit_logs (user_id, table_name, record_id, operation, new_values, ip)
         VALUES (?, ?, ?, ?, JSON_OBJECT('event', ?), ?)`,
        [actorId, table, recordId, operation, event, ip],
      );
    } catch {
      // A auditoria não desfaz o cadastro.
    }
  }
}
