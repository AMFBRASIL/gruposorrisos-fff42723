import { AppError } from "../../shared/errors.js";
import type { AuthUser } from "../auth/auth.types.js";
import { initialsFrom } from "./directory.rules.js";
import { DirectoryRepository, type MembershipInput } from "./directory.repository.js";

function assertManager(actor: AuthUser) {
  if (!actor.permissions.includes("usuarios.gerenciar")) {
    throw new AppError(403, "FORBIDDEN", "Sem permissão para gerenciar usuários.");
  }
}

function translate(error: unknown): never {
  const code = error instanceof Error ? error.message : "";
  if (code === "EMAIL_IN_USE") throw new AppError(409, "EMAIL_IN_USE", "Já existe um usuário com este e-mail.");
  if (code === "NAME_IN_USE") throw new AppError(409, "NAME_IN_USE", "Já existe um perfil com este nome.");
  if (code === "NOT_FOUND") throw new AppError(404, "NOT_FOUND", "Registro não encontrado.");
  if (code === "PAGE_NOT_FOUND") throw new AppError(404, "PAGE_NOT_FOUND", "Página não encontrada.");
  if (code === "PERMISSION_NOT_FOUND") throw new AppError(404, "PERMISSION_NOT_FOUND", "Permissão não encontrada.");
  if (code === "LOCKED_PERMISSION") throw new AppError(409, "LOCKED_PERMISSION", "O superadministrador precisa manter a gestão de usuários.");
  if (code === "MEMBERSHIP_UNAVAILABLE") throw new AppError(409, "MEMBERSHIP_UNAVAILABLE", "Não há filial ou papel disponível para o vínculo.");
  throw error;
}

export type DirectoryHooks = {
  assertNewEmail?: (email: string) => Promise<void>;
  userCreated?: (input: { name: string; email: string; temporaryPassword: string }) => Promise<void>;
};

export class DirectoryService {
  constructor(
    private readonly repository: DirectoryRepository,
    private readonly hooks?: DirectoryHooks,
  ) {}

  snapshot() {
    return this.repository.snapshot();
  }

  async saveUser(actor: AuthUser, input: {
    id?: string;
    name: string;
    email: string;
    initials?: string;
    color?: string;
    profileId?: string | null;
    department?: string | null;
    memberships?: MembershipInput[];
    seesAllBranches?: boolean;
    password?: string;
  }, ip: string | null) {
    assertManager(actor);
    if (!input.id) await this.hooks?.assertNewEmail?.(input.email.trim().toLowerCase());
    const password = input.password?.trim();
    if (password && password.length < 8) {
      throw new AppError(400, "VALIDATION", "A senha precisa ter ao menos 8 caracteres.");
    }
    try {
      const created = await this.repository.saveUser({
        id: input.id,
        actorId: actor.id,
        name: input.name.trim(),
        email: input.email,
        initials: (input.initials?.trim() || initialsFrom(input.name)).slice(0, 4),
        color: (input.color?.trim() || "#2563eb").slice(0, 40),
        profileId: input.profileId,
        department: input.department,
        memberships: input.memberships ?? [],
        seesAllBranches: input.seesAllBranches,
        password: password || undefined,
        ip,
      });
      if (created.temporaryPassword) {
        await this.hooks?.userCreated?.({
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          temporaryPassword: created.temporaryPassword,
        }).catch(() => undefined);
      }
      return created;
    } catch (error) {
      translate(error);
    }
  }

  async saveProfile(actor: AuthUser, input: { id?: string; name: string; description?: string; color?: string }, ip: string | null) {
    assertManager(actor);
    try {
      const id = await this.repository.saveProfile({
        id: input.id,
        actorId: actor.id,
        name: input.name,
        description: input.description ?? "",
        color: input.color?.trim() || "oklch(0.6 0.18 260)",
        ip,
      });
      return { id };
    } catch (error) {
      translate(error);
    }
  }

  async setPageAccess(actor: AuthUser, profileId: string, path: string, allowed: boolean, ip: string | null) {
    assertManager(actor);
    try {
      await this.repository.setPageAccess({ actorId: actor.id, profileId, path, allowed, ip });
    } catch (error) {
      translate(error);
    }
  }

  async setRolePermission(actor: AuthUser, roleId: string, code: string, allowed: boolean, ip: string | null) {
    assertManager(actor);
    try {
      await this.repository.setRolePermission({ actorId: actor.id, roleId, code, allowed, ip });
    } catch (error) {
      translate(error);
    }
  }
}
