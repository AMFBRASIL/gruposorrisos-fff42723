import { useSyncExternalStore } from "react";
import { tasks as initialTasks, projects as initialProjects, users as initialUsers, projectTemplates as initialTemplates, automationRules as initialAutomations, seedTimeEntries, clients as initialClients, deals as initialDeals, invoices as initialInvoices, type Task, type TaskStatus, type Project, type User, type ProjectTemplate, type AutomationRule, type TimeEntry, type Client, type Deal, type DealStage, type Invoice } from "./mock-data";

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

// ============== Templates ==============
let templatesState: ProjectTemplate[] = [...initialTemplates];
const tplListeners = new Set<() => void>();
const notifyTpl = () => tplListeners.forEach(l => l());
export const templatesStore = {
  getSnapshot: () => templatesState,
  subscribe: (l: () => void) => { tplListeners.add(l); return () => tplListeners.delete(l); },
  addTemplate(t: ProjectTemplate) { templatesState = [t, ...templatesState]; notifyTpl(); },
  updateTemplate(id: string, patch: Partial<ProjectTemplate>) {
    templatesState = templatesState.map(t => t.id === id ? { ...t, ...patch } : t);
    notifyTpl();
  },
  removeTemplate(id: string) { templatesState = templatesState.filter(t => t.id !== id); notifyTpl(); },
};
export function useTemplates() {
  return useSyncExternalStore(templatesStore.subscribe, templatesStore.getSnapshot, templatesStore.getSnapshot);
}

// Apply template to a newly created project: spawns tasks with offset dates and dependencies
export function applyTemplateToProject(template: ProjectTemplate, projectId: string, projectStart: string, assigneeId: string) {
  const start = new Date(projectStart + "T00:00:00");
  const addD = (days: number) => {
    const d = new Date(start); d.setDate(d.getDate() + (days || 0));
    return d.toISOString().slice(0, 10);
  };
  const createdIds: string[] = [];
  template.tasks.forEach((tt, idx) => {
    const id = `t_${Date.now().toString(36)}_${idx}`;
    createdIds.push(id);
    const dependsOn = (tt.dependsOnIndex || []).map(i => createdIds[i]).filter(Boolean);
    tasksStore.addTask({
      id, title: tt.title, description: "", projectId,
      assigneeId, participantIds: [], department: tt.department || "Geral",
      tags: [], priority: tt.priority || "normal", status: tt.status || "backlog",
      createdAt: new Date().toISOString().slice(0, 10),
      startDate: addD(tt.offsetStartDays ?? 0),
      dueDate: addD(tt.offsetDueDays ?? (tt.offsetStartDays ?? 0) + 5),
      checklist: [], comments: [], attachments: [],
      estimatedHours: tt.estimatedHours ?? 8, loggedHours: 0,
      dependsOn, timeEntries: [],
    });
  });
}

// ============== Automações ==============
let autoState: AutomationRule[] = [...initialAutomations];
const autoListeners = new Set<() => void>();
const notifyAuto = () => autoListeners.forEach(l => l());
export const automationsStore = {
  getSnapshot: () => autoState,
  subscribe: (l: () => void) => { autoListeners.add(l); return () => autoListeners.delete(l); },
  addRule(r: AutomationRule) { autoState = [r, ...autoState]; notifyAuto(); },
  toggleRule(id: string) {
    autoState = autoState.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    notifyAuto();
  },
  updateRule(id: string, patch: Partial<AutomationRule>) {
    autoState = autoState.map(r => r.id === id ? { ...r, ...patch } : r);
    notifyAuto();
  },
  removeRule(id: string) { autoState = autoState.filter(r => r.id !== id); notifyAuto(); },
};
export function useAutomations() {
  return useSyncExternalStore(automationsStore.subscribe, automationsStore.getSnapshot, automationsStore.getSnapshot);
}

// ============== Time tracker (apenas 1 ativo por vez) ==============
interface ActiveTimer { taskId: string; userId: string; startedAt: string; }
let activeTimer: ActiveTimer | null = null;
let entriesState: TimeEntry[] = [...seedTimeEntries];
const timerListeners = new Set<() => void>();
const notifyTimer = () => timerListeners.forEach(l => l());

export const timerStore = {
  getActive: () => activeTimer,
  getEntries: () => entriesState,
  subscribe: (l: () => void) => { timerListeners.add(l); return () => timerListeners.delete(l); },
  start(taskId: string, userId: string) {
    if (activeTimer) timerStore.stop();
    activeTimer = { taskId, userId, startedAt: new Date().toISOString() };
    notifyTimer();
  },
  stop(note?: string) {
    if (!activeTimer) return;
    const end = new Date();
    const start = new Date(activeTimer.startedAt);
    const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    const entry: TimeEntry = {
      id: `te_${Date.now().toString(36)}`,
      userId: activeTimer.userId,
      start: activeTimer.startedAt,
      end: end.toISOString(),
      minutes, note,
    };
    entriesState = [entry, ...entriesState];
    // anexa à tarefa e atualiza loggedHours
    const task = state.find(t => t.id === activeTimer!.taskId);
    if (task) {
      const newEntries = [...(task.timeEntries || []), entry];
      const totalMin = newEntries.reduce((s, e) => s + e.minutes, 0);
      tasksStore.updateTask(task.id, {
        timeEntries: newEntries,
        loggedHours: Math.round((totalMin / 60) * 10) / 10,
      });
    }
    activeTimer = null;
    notifyTimer();
  },
};

export function useActiveTimer() {
  return useSyncExternalStore(timerStore.subscribe, timerStore.getActive, () => null);
}
export function useTimeEntries() {
  return useSyncExternalStore(timerStore.subscribe, timerStore.getEntries, timerStore.getEntries);
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
