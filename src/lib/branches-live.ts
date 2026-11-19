import { useSyncExternalStore } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type { Branch } from "@/lib/erp";

export type BranchStockLine = { name: string; unit: string; qty: number; min: number };
export type BranchPerson = { id: string; name: string; role: string };
export type BranchOrderLine = { id: string; number: string; status: string };
export type BranchDetail = Branch & {
  stockValue: number;
  stock: BranchStockLine[];
  people: BranchPerson[];
  orders: BranchOrderLine[];
};

let branches: Branch[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function authed<T>(path: string, init?: RequestInit) {
  return apiRequest<T>(path, init ?? {}, getAccessToken());
}

function message(error: unknown) {
  return error instanceof ApiError ? error.message : "Não foi possível salvar a filial.";
}

export function useBranches() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => branches, () => []);
}

export function resetBranches() {
  branches = [];
  emit();
}

export async function loadBranches() {
  const result = await authed<{ branches: Branch[] }>("/api/branches");
  branches = result.branches;
  emit();
}

export async function loadBranchDetail(id: string) {
  return authed<BranchDetail>(`/api/branches/${id}`);
}

export async function saveLiveBranch(branch: Branch) {
  try {
    const exists = branches.some((item) => item.id === branch.id);
    await authed<BranchDetail>(exists ? `/api/branches/${branch.id}` : "/api/branches", {
      method: exists ? "PATCH" : "POST",
      body: JSON.stringify(branch),
    });
    await loadBranches();
    return null;
  } catch (error) {
    return message(error);
  }
}

export async function toggleLiveBranch(id: string) {
  const current = branches.find((branch) => branch.id === id);
  if (!current) return "Filial não encontrada.";
  try {
    await authed(`/api/branches/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ active: !current.active }),
    });
    await loadBranches();
    return null;
  } catch (error) {
    return message(error);
  }
}
