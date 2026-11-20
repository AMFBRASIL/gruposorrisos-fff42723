import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api";
import { getAccessToken, reloadSessionUser } from "@/lib/auth";
import { bindPeople } from "@/lib/live-lookup";

export interface AccessProfile {
  id: string;
  name: string;
  description: string;
  color: string;
  access: Record<string, boolean>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  role: string;
  department: string;
  profileId?: string;
  access: Record<string, boolean>;
  branch?: string;
}

export type DirectoryMembership = { branchId: string; roleId: string };

export type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  profileId: string | null;
  department: string | null;
  memberships: DirectoryMembership[];
  seesAllBranches?: boolean;
};

export type DirectoryRole = {
  id: string;
  name: string;
  description: string;
  scope: "all" | "assigned";
  permissions: string[];
};

export type DirectoryBranch = { id: string; name: string };

export type DirectoryAudit = { at: string; userId: string; action: string };

type Snapshot = {
  users: DirectoryUser[];
  roles: DirectoryRole[];
  branches: DirectoryBranch[];
  profiles: AccessProfile[];
  audit: DirectoryAudit[];
};

const empty: Snapshot = { users: [], roles: [], branches: [], profiles: [], audit: [] };
let state: Snapshot = empty;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function authed<T>(path: string, init?: RequestInit) {
  return apiRequest<T>(path, init ?? {}, getAccessToken());
}

function message(error: unknown) {
  return error instanceof ApiError ? error.message : "Não foi possível salvar. Tente novamente.";
}

export function useDirectory() {
  return useSyncExternalStore(subscribe, () => state, () => empty);
}

export function resetDirectory() {
  state = empty;
  emit();
}

export async function refreshDirectory() {
  const snapshot = await authed<Snapshot>("/api/directory");
  state = snapshot;
  bindPeople(snapshot.users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: snapshot.profiles.find((profile) => profile.id === user.profileId)?.name ?? "",
    department: user.department ?? "",
    initials: user.initials,
    color: user.color,
  })));
  emit();
}

export function loadDirectory() {
  return refreshDirectory().catch((error) => {
    toast.error(message(error));
  });
}

export function branchName(id: string) {
  return state.branches.find((branch) => branch.id === id)?.name ?? id;
}

export function userName(id: string) {
  return state.users.find((user) => user.id === id)?.name ?? "Usuário";
}

export async function saveDirectoryUser(user: DirectoryUser & { department?: string | null; profileId?: string | null; seesAllBranches?: boolean }) {
  const exists = state.users.some((item) => item.id === user.id);
  const payload = {
    name: user.name,
    email: user.email,
    initials: user.initials,
    color: user.color,
    department: user.department ?? null,
    profileId: user.profileId ?? null,
    memberships: user.memberships,
    seesAllBranches: Boolean(user.seesAllBranches),
  };
  const result = await authed<{ id: string; temporaryPassword?: string }>(exists ? `/api/directory/users/${user.id}` : "/api/directory/users", {
    method: exists ? "PATCH" : "POST",
    body: JSON.stringify(payload),
  });
  await refreshDirectory();
  await reloadSessionUser().catch(() => undefined);
  return result;
}

export async function toggleRolePermission(roleId: string, code: string) {
  const role = state.roles.find((item) => item.id === roleId);
  if (!role) return "Perfil não encontrado.";
  const allowed = !role.permissions.includes(code);
  const previous = state;
  state = {
    ...state,
    roles: state.roles.map((item) => item.id !== roleId ? item : {
      ...item,
      permissions: allowed ? [...item.permissions, code] : item.permissions.filter((permission) => permission !== code),
    }),
  };
  emit();
  try {
    await authed(`/api/directory/roles/${roleId}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ code, allowed }),
    });
    await reloadSessionUser().catch(() => undefined);
    return null;
  } catch (error) {
    state = previous;
    emit();
    return message(error);
  }
}

export const accessProfilesStore = {
  getSnapshot: () => state.profiles,
  subscribe,
  async addProfile(profile: AccessProfile) {
    const created = await authed<{ id: string }>("/api/directory/profiles", {
      method: "POST",
      body: JSON.stringify({ name: profile.name, description: profile.description, color: profile.color }),
    });
    await refreshDirectory();
    await reloadSessionUser().catch(() => undefined);
    return created.id;
  },
  async updateProfile(id: string, patch: Partial<AccessProfile>) {
    const current = state.profiles.find((profile) => profile.id === id);
    await authed(`/api/directory/profiles/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: patch.name ?? current?.name ?? "",
        description: patch.description ?? current?.description ?? "",
        color: patch.color ?? current?.color ?? "",
      }),
    });
    await refreshDirectory();
  },
  setAccess(id: string, page: string, value: boolean) {
    const previous = state;
    state = {
      ...state,
      profiles: state.profiles.map((profile) => profile.id === id ? { ...profile, access: { ...profile.access, [page]: value } } : profile),
    };
    emit();
    void authed(`/api/directory/profiles/${id}/pages`, {
      method: "PATCH",
      body: JSON.stringify({ path: page, allowed: value }),
    }).then(() => reloadSessionUser()).catch((error) => {
      state = previous;
      emit();
      toast.error(message(error));
    });
  },
};

export function useAccessProfiles() {
  return useDirectory().profiles;
}

function branchLabel(user: DirectoryUser, snapshot: Snapshot) {
  if (user.seesAllBranches) return "Todas as filiais";
  if (!user.memberships.length) return "Sem filial";
  const global = user.memberships.some((item) => snapshot.roles.find((role) => role.id === item.roleId)?.scope === "all");
  if (global || (snapshot.branches.length > 1 && user.memberships.length >= snapshot.branches.length)) return "Todas as filiais";
  const names = [...new Set(user.memberships.map((item) => snapshot.branches.find((branch) => branch.id === item.branchId)?.name).filter(Boolean))];
  return names.join(", ") || "Sem filial";
}

function toMembers(snapshot: Snapshot): UserProfile[] {
  return snapshot.users.map((user) => {
    const profile = snapshot.profiles.find((item) => item.id === user.profileId);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      initials: user.initials,
      color: user.color,
      role: profile?.name ?? "Sem perfil",
      department: user.department ?? "Sem departamento",
      profileId: user.profileId ?? undefined,
      access: profile?.access ?? {},
      branch: branchLabel(user, snapshot),
    };
  });
}

export function useUserProfiles() {
  return toMembers(useDirectory());
}

type MemberInput = {
  name: string;
  email: string;
  initials: string;
  color: string;
  department: string;
  profileId?: string;
  role?: string;
  id?: string;
  memberships?: { branchId: string; roleId: string }[];
  seesAllBranches?: boolean;
  password?: string;
};

function memberBody(user: MemberInput) {
  return {
    name: user.name,
    email: user.email,
    initials: user.initials,
    color: user.color,
    department: user.department,
    profileId: user.profileId ?? null,
    memberships: user.memberships ?? [],
    seesAllBranches: Boolean(user.seesAllBranches),
    ...(user.password?.trim() ? { password: user.password.trim() } : {}),
  };
}

export const usersStore = {
  getSnapshot: () => toMembers(state),
  subscribe,
  async addUser(user: MemberInput, _access?: Record<string, boolean>) {
    const result = await authed<{ temporaryPassword?: string }>("/api/directory/users", {
      method: "POST",
      body: JSON.stringify(memberBody(user)),
    });
    await refreshDirectory();
    return result.temporaryPassword;
  },
  async updateUser(user: MemberInput & { id: string }, _access?: Record<string, boolean>) {
    await authed(`/api/directory/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      body: JSON.stringify(memberBody(user)),
    });
    await refreshDirectory();
    await reloadSessionUser().catch(() => undefined);
  },
};
