import { useSyncExternalStore } from "react";
import { tasks as initialTasks, projects as initialProjects, users as initialUsers, type Task, type TaskStatus, type Project, type User } from "./mock-data";

// User profiles store (with page access)
export const ACCESS_PAGES = ["/", "/projetos", "/kanban", "/minhas-tarefas", "/calendario", "/equipe", "/relatorios", "/configuracoes", "/perfis"] as const;
export interface UserProfile extends User { access: Record<string, boolean>; profileId?: string; }

const fullAccess = (): Record<string, boolean> => Object.fromEntries(ACCESS_PAGES.map(p => [p, true]));

// Access profiles store (perfis de acesso — funções com permissões de páginas)
export interface AccessProfile {
  id: string;
  name: string;
  description: string;
  color: string;
  access: Record<string, boolean>;
}

const accessOf = (allowed: string[]): Record<string, boolean> =>
  Object.fromEntries(ACCESS_PAGES.map(p => [p, allowed.includes(p)]));

let accessProfilesState: AccessProfile[] = [
  { id: "ap_colaborador", name: "Colaborador(a)", description: "Executa tarefas e atualiza o progresso do dia a dia", color: "oklch(0.65 0.14 230)", access: accessOf(["/", "/kanban", "/minhas-tarefas", "/calendario", "/equipe"]) },
  { id: "ap_supervisor", name: "Supervisor(a)", description: "Acompanha a equipe e garante a qualidade das entregas", color: "oklch(0.62 0.16 155)", access: accessOf(["/", "/projetos", "/kanban", "/minhas-tarefas", "/calendario", "/equipe", "/relatorios"]) },
  { id: "ap_gerente", name: "Gerente", description: "Gerencia projetos, prazos e distribui as demandas", color: "oklch(0.7 0.15 70)", access: accessOf(["/", "/projetos", "/kanban", "/minhas-tarefas", "/calendario", "/equipe", "/relatorios", "/configuracoes"]) },
  { id: "ap_diretor", name: "Diretor(a)", description: "Visão estratégica e decisões de alto nível", color: "oklch(0.6 0.2 295)", access: fullAccess() },
];
const accessProfileListeners = new Set<() => void>();
const notifyAccessProfiles = () => accessProfileListeners.forEach(l => l());

export const accessProfilesStore = {
  getSnapshot: () => accessProfilesState,
  subscribe: (l: () => void) => { accessProfileListeners.add(l); return () => accessProfileListeners.delete(l); },
  addProfile(p: AccessProfile) { accessProfilesState = [...accessProfilesState, p]; notifyAccessProfiles(); },
  updateProfile(id: string, patch: Partial<AccessProfile>) {
    accessProfilesState = accessProfilesState.map(p => p.id === id ? { ...p, ...patch } : p);
    notifyAccessProfiles();
  },
  setAccess(id: string, page: string, value: boolean) {
    accessProfilesState = accessProfilesState.map(p => p.id === id ? { ...p, access: { ...p.access, [page]: value } } : p);
    notifyAccessProfiles();
  },
};

export function useAccessProfiles() {
  return useSyncExternalStore(accessProfilesStore.subscribe, accessProfilesStore.getSnapshot, accessProfilesStore.getSnapshot);
}

let profilesState: UserProfile[] = initialUsers.map(u => ({ ...u, access: fullAccess() }));
const profileListeners = new Set<() => void>();
const notifyProfiles = () => profileListeners.forEach(l => l());

export const usersStore = {
  getSnapshot: () => profilesState,
  subscribe: (l: () => void) => { profileListeners.add(l); return () => profileListeners.delete(l); },
  addUser(u: User & { profileId?: string }, access?: Record<string, boolean>) {
    profilesState = [...profilesState, { ...u, access: access ?? fullAccess() }];
    notifyProfiles();
  },
  updateUser(id: string, patch: Partial<UserProfile>) {
    profilesState = profilesState.map(u => u.id === id ? { ...u, ...patch } : u);
    notifyProfiles();
  },
  setAccess(id: string, page: string, value: boolean) {
    profilesState = profilesState.map(u => u.id === id ? { ...u, access: { ...u.access, [page]: value } } : u);
    notifyProfiles();
  },
};

export function useUserProfiles() {
  return useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot, usersStore.getSnapshot);
}

let state: Task[] = [...initialTasks];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export const tasksStore = {
  getSnapshot: () => state,
  subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
  moveTask(id: string, newStatus: TaskStatus) {
    state = state.map(t => t.id === id ? { ...t, status: newStatus, completedAt: newStatus === "concluido" ? new Date().toISOString() : undefined } : t);
    notify();
  },
  updateTask(id: string, patch: Partial<Task>) {
    state = state.map(t => t.id === id ? { ...t, ...patch } : t);
    notify();
  },
  addTask(t: Task) { state = [t, ...state]; notify(); },
};

export function useTasks() {
  return useSyncExternalStore(tasksStore.subscribe, tasksStore.getSnapshot, tasksStore.getSnapshot);
}

// Projects store
let projectsState: Project[] = [...initialProjects];
const projectListeners = new Set<() => void>();
const notifyProjects = () => projectListeners.forEach(l => l());

export const projectsStore = {
  getSnapshot: () => projectsState,
  subscribe: (l: () => void) => { projectListeners.add(l); return () => projectListeners.delete(l); },
  addProject(p: Project) { projectsState = [p, ...projectsState]; notifyProjects(); },
  updateProject(id: string, patch: Partial<Project>) {
    projectsState = projectsState.map(p => p.id === id ? { ...p, ...patch } : p);
    notifyProjects();
  },
};

export function useProjects() {
  return useSyncExternalStore(projectsStore.subscribe, projectsStore.getSnapshot, projectsStore.getSnapshot);
}

// Theme store
const THEME_KEY = "gs-theme";
type Theme = "light" | "dark";
let theme: Theme = "dark";
const themeListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  const saved = localStorage.getItem(THEME_KEY) as Theme | null;
  theme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
}
export const themeStore = {
  getSnapshot: () => theme,
  subscribe: (l: () => void) => { themeListeners.add(l); return () => themeListeners.delete(l); },
  toggle() {
    theme = theme === "dark" ? "light" : "dark";
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_KEY, theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
    themeListeners.forEach(l => l());
  }
};
export function useTheme() {
  return useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot, () => "dark" as Theme);
}
