import { useSyncExternalStore } from "react";
import { addClinic } from "./stock";

export const PERMISSIONS = [
  "estoque.visualizar", "estoque.movimentar", "estoque.ajustar",
  "pedidos.criar", "pedidos.visualizar", "pedidos.aprovar", "pedidos.separar", "pedidos.expedir", "pedidos.receber",
  "compras.gerenciar", "inventario.realizar", "usuarios.gerenciar", "filiais.gerenciar", "relatorios.exportar",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type Warehouse = { id: string; name: string; locations: string[] };
export type BranchType = "administracao" | "cd" | "clinica";
export type Branch = {
  id: string; code: string; name: string; type: BranchType; legalName: string; cnpj: string;
  address: string; city: string; state: string; phone: string; email: string; manager: string;
  costCenter: string; region: string; active: boolean; openedAt: string; warehouses: Warehouse[];
};
/** scope "all": the role applies to every branch; "assigned": only to branches in the user's memberships. */
export type ErpRole = { id: string; name: string; description: string; scope: "all" | "assigned"; permissions: Permission[] };
export type Membership = { branchId: string; roleId: string };
export type ErpUser = { id: string; name: string; initials: string; color: string; email: string; memberships: Membership[] };

const P = (...p: Permission[]) => p;
export const seedRoles: ErpRole[] = [
  { id: "superadmin", name: "Superadministrador", description: "Gerencia a plataforma e configurações", scope: "all", permissions: [...PERMISSIONS] },
  { id: "diretoria", name: "Diretoria", description: "Consulta consolidada e aprova processos", scope: "all", permissions: P("estoque.visualizar", "pedidos.visualizar", "pedidos.aprovar", "relatorios.exportar") },
  { id: "regional", name: "Gestor regional", description: "Gerencia filiais da sua região", scope: "assigned", permissions: P("estoque.visualizar", "estoque.movimentar", "pedidos.criar", "pedidos.visualizar", "pedidos.aprovar", "pedidos.receber", "relatorios.exportar", "inventario.realizar") },
  { id: "gerente", name: "Gerente de filial", description: "Gerencia a operação da unidade", scope: "assigned", permissions: P("estoque.visualizar", "estoque.movimentar", "pedidos.criar", "pedidos.visualizar", "pedidos.aprovar", "pedidos.receber", "inventario.realizar") },
  { id: "estoquista-central", name: "Estoquista central", description: "Opera o centro de distribuição", scope: "assigned", permissions: P("estoque.visualizar", "estoque.movimentar", "estoque.ajustar", "pedidos.visualizar", "pedidos.separar", "pedidos.expedir", "inventario.realizar") },
  { id: "estoquista-local", name: "Estoquista local", description: "Opera o estoque da filial", scope: "assigned", permissions: P("estoque.visualizar", "estoque.movimentar", "pedidos.criar", "pedidos.visualizar", "pedidos.receber", "inventario.realizar") },
  { id: "comprador", name: "Comprador", description: "Compras e fornecedores", scope: "all", permissions: P("estoque.visualizar", "pedidos.visualizar", "compras.gerenciar") },
  { id: "colaborador", name: "Colaborador", description: "Solicita materiais", scope: "assigned", permissions: P("pedidos.criar", "pedidos.visualizar", "estoque.visualizar") },
  { id: "auditor", name: "Auditor", description: "Consulta sem modificar", scope: "all", permissions: P("estoque.visualizar", "pedidos.visualizar", "relatorios.exportar") },
];

const wh = (id: string, name: string, locs: string[]): Warehouse => ({ id, name, locations: locs });
const br = (id: string, code: string, name: string, type: BranchType, city: string, region: string, manager: string): Branch => ({
  id, code, name, type, legalName: `${name} Odontologia Ltda`, cnpj: "00.000.000/0001-00", address: "Endereço fictício", city, state: "SP",
  phone: "(11) 0000-0000", email: `${id}@exemplo.com`, manager, costCenter: `CC-${code}`, region, active: true, openedAt: "2022-01-10",
  warehouses: type === "cd" ? [wh(`${id}-w1`, "Almoxarifado Principal", ["Rua A", "Rua B", "Câmara fria"]), wh(`${id}-w2`, "Equipamentos", ["Galpão 2"])] : type === "clinica" ? [wh(`${id}-w1`, "Almoxarifado", ["Armário 1", "Armário 2"])] : [],
});
/** Example units (fictitious, per the client's spec — confirm before using real data). */
export const seedBranches: Branch[] = [
  br("hq", "ADM", "Grupo Sorrisos · Administração Central", "administracao", "São Paulo", "Capital", "Carlos Lima"),
  br("cd", "CD01", "Centro de Distribuição", "cd", "São Paulo", "Capital", "João Pereira"),
  br("c1", "PAU", "Sorrisos Paulista", "clinica", "São Paulo", "Capital", "Maria Silva"),
  br("c2", "MOE", "Sorrisos Moema", "clinica", "São Paulo", "Capital", "Ana Souza"),
  br("c3", "CAM", "Sorrisos Campinas", "clinica", "Campinas", "Interior", "Bruna Reis"),
  br("c4", "SAN", "Sorrisos Santos", "clinica", "Santos", "Litoral", "Pedro Alves"),
];

export const seedErpUsers: ErpUser[] = [
  { id: "u-carlos", name: "Carlos Lima", initials: "CL", color: "#0f766e", email: "carlos@exemplo.com", memberships: [{ branchId: "hq", roleId: "superadmin" }] },
  { id: "u-maria", name: "Maria Silva", initials: "MS", color: "#dc2626", email: "maria@exemplo.com", memberships: [{ branchId: "c1", roleId: "gerente" }] },
  { id: "u-joao", name: "João Pereira", initials: "JP", color: "#2563eb", email: "joao@exemplo.com", memberships: [{ branchId: "cd", roleId: "estoquista-central" }] },
  { id: "u-ana", name: "Ana Souza", initials: "AS", color: "#9333ea", email: "ana@exemplo.com", memberships: [{ branchId: "c1", roleId: "regional" }, { branchId: "c2", roleId: "regional" }] },
  { id: "u-lucas", name: "Lucas Rocha", initials: "LR", color: "#ea580c", email: "lucas@exemplo.com", memberships: [{ branchId: "c2", roleId: "colaborador" }] },
  { id: "u-bia", name: "Beatriz Nunes", initials: "BN", color: "#16a34a", email: "bia@exemplo.com", memberships: [{ branchId: "hq", roleId: "comprador" }] },
];

/* ---------- pure access rules (tested) ---------- */
export function can(user: ErpUser, roles: ErpRole[], perm: Permission, branchId?: string): boolean {
  return user.memberships.some(m => {
    const role = roles.find(r => r.id === m.roleId);
    if (!role || !role.permissions.includes(perm)) return false;
    return !branchId || role.scope === "all" || m.branchId === branchId;
  });
}
export function visibleBranchIds(user: ErpUser, roles: ErpRole[], branches: Branch[]): string[] {
  const global = user.memberships.some(m => roles.find(r => r.id === m.roleId)?.scope === "all");
  return global ? branches.map(b => b.id) : branches.filter(b => user.memberships.some(m => m.branchId === b.id)).map(b => b.id);
}

/* ---------- store ---------- */
type AuditEntry = { at: string; userId: string; action: string };
type ErpState = { branches: Branch[]; roles: ErpRole[]; users: ErpUser[]; currentUserId: string; branchFilter: string; audit: AuditEntry[] };
let state: ErpState = { branches: seedBranches, roles: seedRoles, users: seedErpUsers, currentUserId: "u-carlos", branchFilter: "all", audit: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const useErp = () => useSyncExternalStore(subscribe, () => state, () => state);
export const getErp = () => state;
const audit = (action: string) => { state = { ...state, audit: [{ at: new Date().toISOString(), userId: state.currentUserId, action }, ...state.audit] }; };

export function currentUser(s = state) { return s.users.find(u => u.id === s.currentUserId)!; }
export function useSession() {
  const s = useErp();
  const user = currentUser(s);
  const visible = visibleBranchIds(user, s.roles, s.branches);
  const filter = s.branchFilter === "all" || visible.includes(s.branchFilter) ? s.branchFilter : "all";
  return {
    user, visible, filter,
    /** Branch ids the screen should show: the header filter intersected with what the user may see. */
    scope: filter === "all" ? visible : [filter],
    can: (p: Permission, branchId?: string) => can(user, s.roles, p, branchId),
  };
}
export function setCurrentUser(id: string) { state = { ...state, currentUserId: id, branchFilter: "all" }; persist(); emit(); }
export function setBranchFilter(id: string) { state = { ...state, branchFilter: id }; persist(); emit(); }
function persist() { try { localStorage.setItem("erp-session", JSON.stringify({ u: state.currentUserId, b: state.branchFilter })); } catch { /* ignore */ } }
export function restoreSession() {
  try { const v = JSON.parse(localStorage.getItem("erp-session") || "null"); if (v?.u && state.users.some(u => u.id === v.u)) { state = { ...state, currentUserId: v.u, branchFilter: v.b ?? "all" }; emit(); } } catch { /* ignore */ }
}

export function saveBranch(b: Branch): string | null {
  if (!can(currentUser(), state.roles, "filiais.gerenciar")) return "Sem permissão para gerenciar filiais";
  if (!b.name.trim() || !b.code.trim()) return "Nome e código são obrigatórios";
  const exists = state.branches.some(x => x.id === b.id);
  state = { ...state, branches: exists ? state.branches.map(x => x.id === b.id ? b : x) : [...state.branches, b] };
  if (b.type !== "administracao") addClinic({ id: b.id, name: b.name, city: b.city });
  audit(`${exists ? "Editou" : "Criou"} filial ${b.name}`);
  emit();
  return null;
}
export function toggleBranch(id: string) {
  if (!can(currentUser(), state.roles, "filiais.gerenciar")) return "Sem permissão";
  state = { ...state, branches: state.branches.map(b => b.id === id ? { ...b, active: !b.active } : b) };
  audit(`Alterou status da filial ${id}`); emit(); return null;
}
export function saveErpUser(u: ErpUser): string | null {
  if (!can(currentUser(), state.roles, "usuarios.gerenciar")) return "Sem permissão para gerenciar usuários";
  if (!u.name.trim() || u.memberships.length === 0) return "Informe nome e ao menos uma filial";
  const exists = state.users.some(x => x.id === u.id);
  state = { ...state, users: exists ? state.users.map(x => x.id === u.id ? u : x) : [...state.users, u] };
  audit(`${exists ? "Alterou vínculos de" : "Cadastrou"} ${u.name}`); emit(); return null;
}
export function toggleRolePermission(roleId: string, p: Permission): string | null {
  if (!can(currentUser(), state.roles, "usuarios.gerenciar")) return "Sem permissão";
  state = { ...state, roles: state.roles.map(r => r.id !== roleId ? r : { ...r, permissions: r.permissions.includes(p) ? r.permissions.filter(x => x !== p) : [...r.permissions, p] }) };
  audit(`Alterou permissão ${p} do papel ${roleId}`); emit(); return null;
}
export const branchName = (id: string) => state.branches.find(b => b.id === id)?.name ?? id;
export const userName = (id: string) => state.users.find(u => u.id === id)?.name ?? id;
