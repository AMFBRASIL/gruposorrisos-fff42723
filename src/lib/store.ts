import { useSyncExternalStore } from "react";
import { tasks as initialTasks, projects as initialProjects, users as initialUsers, type Task, type TaskStatus, type Project, type User } from "./mock-data";

// User profiles store (with page access)
export const ACCESS_PAGES = ["/", "/projetos", "/kanban", "/minhas-tarefas", "/calendario", "/equipe", "/relatorios", "/configuracoes", "/perfis"] as const;
export interface UserProfile extends User { access: Record<string, boolean>; }

const fullAccess = (): Record<string, boolean> => Object.fromEntries(ACCESS_PAGES.map(p => [p, true]));

let profilesState: UserProfile[] = initialUsers.map(u => ({ ...u, access: fullAccess() }));
const profileListeners = new Set<() => void>();
const notifyProfiles = () => profileListeners.forEach(l => l());

export const usersStore = {
  getSnapshot: () => profilesState,
  subscribe: (l: () => void) => { profileListeners.add(l); return () => profileListeners.delete(l); },
  addUser(u: User, access?: Record<string, boolean>) {
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
