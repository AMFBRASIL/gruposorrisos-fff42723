import { AppError } from "../../shared/errors.js";
import type { AuthUser } from "../auth/auth.types.js";
import { BranchesRepository, type BranchInput } from "./branches.repository.js";

function visibleIds(user: AuthUser) {
  if (user.memberships.some((membership) => membership.scope === "all")) return null;
  return new Set(user.memberships.map((membership) => membership.branchId).filter((id): id is string => !!id));
}

function translate(error: unknown): never {
  const code = error instanceof Error ? error.message : "";
  if (code === "REQUIRED") throw new AppError(400, "VALIDATION", "Nome e código são obrigatórios.");
  if (code === "CNPJ") throw new AppError(400, "VALIDATION", "CNPJ precisa ter 14 dígitos.");
  if (code === "EMAIL") throw new AppError(400, "VALIDATION", "Informe um e-mail válido.");
  if (code === "CODE_IN_USE") throw new AppError(409, "CODE_IN_USE", "Já existe uma filial com este código.");
  if (code === "WAREHOUSE_STOCK") throw new AppError(409, "WAREHOUSE_STOCK", "O depósito tem estoque e não pode ser removido.");
  if (code === "NOT_FOUND") throw new AppError(404, "NOT_FOUND", "Filial não encontrada.");
  throw error;
}

export class BranchesService {
  constructor(private readonly repository: BranchesRepository) {}

  async list(user: AuthUser) {
    const branches = await this.repository.list();
    const allowed = visibleIds(user);
    return allowed ? branches.filter((branch) => allowed.has(branch.id)) : branches;
  }

  async detail(user: AuthUser, id: string) {
    const allowed = visibleIds(user);
    if (allowed && !allowed.has(id)) throw new AppError(404, "NOT_FOUND", "Filial não encontrada.");
    const branch = await this.repository.detail(id);
    if (!branch) throw new AppError(404, "NOT_FOUND", "Filial não encontrada.");
    return branch;
  }

  async save(user: AuthUser, input: BranchInput) {
    if (!user.permissions.includes("filiais.gerenciar")) throw new AppError(403, "FORBIDDEN", "Sem permissão para gerenciar filiais.");
    try {
      const id = await this.repository.save(input);
      return this.detail(user, id);
    } catch (error) {
      translate(error);
    }
  }

  async setActive(user: AuthUser, id: string, active: boolean) {
    if (!user.permissions.includes("filiais.gerenciar")) throw new AppError(403, "FORBIDDEN", "Sem permissão para gerenciar filiais.");
    try {
      await this.repository.setActive(id, active);
      return this.detail(user, id);
    } catch (error) {
      translate(error);
    }
  }
}
