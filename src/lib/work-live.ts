import { useSyncExternalStore } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

export type WorkProject = { id: string; name: string };
export type WorkTask = { id: string; projectId: string; assigneeId: string; department: string; status: string; dueDate: string };

const empty = { projects: [] as WorkProject[], tasks: [] as WorkTask[] };
let state = empty;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function useWork() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => state, () => empty);
}

export function resetWork() {
  state = empty;
  emit();
}

export async function loadWork() {
  state = await apiRequest<typeof empty>("/api/work/summary", {}, getAccessToken());
  emit();
}
