import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { matchesRule, planAutomation, planDomain, type DomainFact } from "@/lib/automation-engine";
import { onAutomation } from "@/lib/automation-bus";
import { moduleById } from "@/lib/automation-catalog";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { bindClients, bindProjects } from "@/lib/live-lookup";
import { loadWork } from "@/lib/work-live";
import { type Task, type TaskStatus, type Project, type ProjectTemplate, type AutomationRule, type TimeEntry, type Client, type Deal, type DealStage, type Invoice, type Document, type DocumentStatus, type ApprovalRequest, type ApprovalStatus, type Priority } from "./mock-data";

let acceptWrites = false;
const recordWrites = new Map<string, Promise<void>>();

function enqueueRecord(kind: string, id: string, job: () => Promise<void>) {
  const key = `${kind}:${id}`;
  const previous = recordWrites.get(key) ?? Promise.resolve();
  const next = previous.then(job, job);
  recordWrites.set(key, next);
}

function saveRecord(kind: string, row: { id?: string } | null | undefined) {
  if (!acceptWrites || !row?.id) return;
  const id = row.id;
  const body = JSON.stringify(row);
  enqueueRecord(kind, id, () => apiRequest(`/api/workspace/${kind}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body,
  }, getAccessToken()).then(() => {
    if (kind === "task" || kind === "project") void loadWork();
  }).catch(() => undefined));
}

function deleteRecord(kind: string, id: string) {
  if (!acceptWrites) return;
  enqueueRecord(kind, id, () => apiRequest(`/api/workspace/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" }, getAccessToken()).then(() => undefined).catch(() => undefined));
}

function remember<T extends { id: string }>(kind: string, list: T[], id: string) {
  saveRecord(kind, list.find((item) => item.id === id));
}

export type { AccessProfile, UserProfile } from "./directory";
export { ACCESS_PAGES } from "./menu-pages";
export { accessProfilesStore, useAccessProfiles, useUserProfiles, usersStore } from "./directory";

let state: Task[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export const tasksStore = {
  getSnapshot: () => state,
  subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
  moveTask(id: string, newStatus: TaskStatus) {
    const current = state.find((task) => task.id === id);
    if (!current || current.status === newStatus) return;
    const from = current.status;
    state = state.map(t => t.id === id ? { ...t, status: newStatus, completedAt: newStatus === "concluido" ? new Date().toISOString() : undefined } : t);
    notify();
    remember("task", state, id);
    const next = state.find((task) => task.id === id);
    if (next) runAutomations(taskFact(next, "status_change", { from, to: newStatus }), true);
  },
  updateTask(id: string, patch: Partial<Task>) {
    const current = state.find((task) => task.id === id);
    state = state.map(t => t.id === id ? { ...t, ...patch } : t);
    notify();
    remember("task", state, id);
    const next = state.find((task) => task.id === id);
    if (current && next && patch.assigneeId && patch.assigneeId !== current.assigneeId) runAutomations(taskFact(next, "assigned"), true);
  },
  addTask(t: Task) {
    state = [t, ...state];
    notify();
    saveRecord("task", t);
    runAutomations(taskFact(t, "task_created"), true);
  },
};

export function useTasks() {
  return useSyncExternalStore(tasksStore.subscribe, tasksStore.getSnapshot, tasksStore.getSnapshot);
}

// Projects store
let projectsState: Project[] = [];
const projectListeners = new Set<() => void>();
const notifyProjects = () => { bindProjects(projectsState); projectListeners.forEach(l => l()); };

export const projectsStore = {
  getSnapshot: () => projectsState,
  subscribe: (l: () => void) => { projectListeners.add(l); return () => projectListeners.delete(l); },
  addProject(p: Project) { projectsState = [p, ...projectsState]; notifyProjects(); saveRecord("project", p); },
  updateProject(id: string, patch: Partial<Project>) {
    projectsState = projectsState.map(p => p.id === id ? { ...p, ...patch } : p);
    notifyProjects();
    remember("project", projectsState, id);
  },
};

export function useProjects() {
  return useSyncExternalStore(projectsStore.subscribe, projectsStore.getSnapshot, projectsStore.getSnapshot);
}

// ============== Templates ==============
let templatesState: ProjectTemplate[] = [];
const tplListeners = new Set<() => void>();
const notifyTpl = () => tplListeners.forEach(l => l());
export const templatesStore = {
  getSnapshot: () => templatesState,
  subscribe: (l: () => void) => { tplListeners.add(l); return () => tplListeners.delete(l); },
  addTemplate(t: ProjectTemplate) { templatesState = [t, ...templatesState]; notifyTpl(); saveRecord("template", t); },
  updateTemplate(id: string, patch: Partial<ProjectTemplate>) {
    templatesState = templatesState.map(t => t.id === id ? { ...t, ...patch } : t);
    notifyTpl();
    remember("template", templatesState, id);
  },
  removeTemplate(id: string) { templatesState = templatesState.filter(t => t.id !== id); notifyTpl(); deleteRecord("template", id); },
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
let autoState: AutomationRule[] = [];
const autoListeners = new Set<() => void>();
const notifyAuto = () => autoListeners.forEach(l => l());
export const automationsStore = {
  getSnapshot: () => autoState,
  subscribe: (l: () => void) => { autoListeners.add(l); return () => autoListeners.delete(l); },
  addRule(r: AutomationRule) { autoState = [r, ...autoState]; notifyAuto(); saveRecord("automation", r); },
  toggleRule(id: string) {
    autoState = autoState.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    notifyAuto();
    remember("automation", autoState, id);
  },
  updateRule(id: string, patch: Partial<AutomationRule>) {
    autoState = autoState.map(r => r.id === id ? { ...r, ...patch } : r);
    notifyAuto();
    remember("automation", autoState, id);
  },
  removeRule(id: string) { autoState = autoState.filter(r => r.id !== id); notifyAuto(); deleteRecord("automation", id); },
  runNow(id: string) {
    const rule = autoState.find((item) => item.id === id);
    if (!rule) return 0;
    if (!rule.enabled) {
      toast.message("Ative a regra para executar.");
      return 0;
    }
    if (rule.trigger !== "due_soon" && rule.trigger !== "overdue") {
      toast.message("Essa regra dispara sozinha quando o evento do módulo acontece.");
      return 0;
    }
    const before = rule.runs;
    const today = new Date().toISOString().slice(0, 10);
    for (const task of [...state]) runAutomations(taskFact(task, "schedule", { today }), false, id);
    const count = (autoState.find((item) => item.id === id)?.runs ?? before) - before;
    toast.success(count ? `“${rule.name}” executou em ${count} tarefa(s).` : `Nenhuma tarefa pendente para “${rule.name}”.`);
    return count;
  },
};

const scheduled = new Set<string>();
let automationDepth = 0;

function taskFact(task: Task, event: string, extra: Partial<DomainFact> = {}): DomainFact {
  return { module: "tarefas", event, title: task.title, ref: task.id, status: task.status, dueDate: task.dueDate, priority: task.priority, assigneeId: task.assigneeId, projectId: task.projectId, task, ...extra };
}

function followUp(parent: Task, title: string, status: string, priority: Priority): Task {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `tsk_${Date.now().toString(36)}`, title, description: `Criada pela automação a partir de ${parent.title}.`,
    projectId: parent.projectId, assigneeId: parent.assigneeId, participantIds: [], department: parent.department, tags: [],
    priority, status, createdAt: today, startDate: today, dueDate: parent.dueDate,
    checklist: [], comments: [], attachments: [], estimatedHours: 1, loggedHours: 0,
  };
}

function followUpFact(fact: DomainFact, spawn: { title: string; priority: Priority; status: string }, ruleName: string, summary: string): Task {
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date();
  due.setDate(due.getDate() + 2);
  return {
    id: `tsk_${Date.now().toString(36)}`, title: spawn.title, description: `Criada pela automação “${ruleName}” a partir de ${fact.title}.`,
    projectId: projectsState[0]?.id || fact.projectId || "geral", assigneeId: fact.assigneeId || "sistema", participantIds: [],
    department: moduleById(fact.module).label, tags: [fact.module], priority: spawn.priority, status: spawn.status,
    createdAt: today, startDate: today, dueDate: due.toISOString().slice(0, 10), checklist: [],
    comments: summary ? [{ id: `auto_${Math.random().toString(36).slice(2, 10)}`, userId: "sistema", text: `Automação “${ruleName}”: ${summary}.`, at: new Date().toISOString() }] : [],
    attachments: [], estimatedHours: 1, loggedHours: 0,
  };
}

function rememberRun(ruleId: string) {
  const ranAt = new Date().toISOString();
  autoState = autoState.map((item) => item.id === ruleId ? { ...item, runs: item.runs + 1, lastRun: ranAt } : item);
  notifyAuto();
  remember("automation", autoState, ruleId);
}

function runAutomations(fact: DomainFact, interactive: boolean, onlyRuleId?: string, skip = new Set<string>()) {
  if (automationDepth > 2) return;
  automationDepth += 1;
  const fired: string[] = [];
  try {
    for (const rule of [...autoState]) {
      if ((onlyRuleId && rule.id !== onlyRuleId) || skip.has(rule.id) || !matchesRule(rule, fact)) continue;
      const stamp = fact.event === "schedule" ? fact.today ?? "" : "";
      const key = `${rule.id}:${fact.ref}:${fact.event}:${stamp}`;
      if (fact.event === "schedule" && scheduled.has(key)) continue;
      const nextSkip = new Set(skip);
      nextSkip.add(rule.id);
      if ((rule.module || "tarefas") === "tarefas" && fact.task) {
        const current = state.find((task) => task.id === fact.task?.id) ?? fact.task;
        const planned = planAutomation(rule, current, new Date().toISOString());
        if (!planned.summary && !planned.spawn) continue;
        if (fact.event === "schedule") scheduled.add(key);
        const previousStatus = current.status;
        if (Object.keys(planned.patch).length) {
          state = state.map((task) => task.id === current.id ? { ...task, ...planned.patch } : task);
          notify();
          remember("task", state, current.id);
        }
        if (planned.spawn) {
          const created = followUp(current, planned.spawn.title, planned.spawn.status, planned.spawn.priority);
          state = [created, ...state];
          notify();
          saveRecord("task", created);
          runAutomations(taskFact(created, "task_created"), false, undefined, nextSkip);
        }
        if (planned.patch.status && planned.patch.status !== previousStatus) {
          const moved = state.find((task) => task.id === current.id);
          if (moved) runAutomations(taskFact(moved, "status_change", { from: previousStatus, to: planned.patch.status }), false, undefined, nextSkip);
        }
      } else {
        const planned = planDomain(rule, fact);
        if (!planned.summary && !planned.spawn) continue;
        if (planned.spawn) {
          const created = followUpFact(fact, planned.spawn, rule.name, planned.summary);
          state = [created, ...state];
          notify();
          saveRecord("task", created);
          runAutomations(taskFact(created, "task_created"), false, undefined, nextSkip);
        }
      }
      rememberRun(rule.id);
      fired.push(rule.name);
    }
  } finally {
    automationDepth -= 1;
  }
  if (interactive && automationDepth === 0 && fired.length) toast.success(fired.length === 1 ? `Automação “${fired[0]}” executou.` : `${fired.length} automações executaram.`);
}

onAutomation((fact) => runAutomations(fact, true));
export function useAutomations() {
  return useSyncExternalStore(automationsStore.subscribe, automationsStore.getSnapshot, automationsStore.getSnapshot);
}

// ============== Time tracker (apenas 1 ativo por vez) ==============
interface ActiveTimer { taskId: string; userId: string; startedAt: string; }
let activeTimer: ActiveTimer | null = null;
let entriesState: TimeEntry[] = [];
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
    saveRecord("time_entry", entry);
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
export type ThemeMode = "claro" | "escuro" | "auto";
let theme: Theme = "dark";
let themeMode: ThemeMode = "escuro";
const themeListeners = new Set<() => void>();

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function paintTheme(next: Theme) {
  theme = next;
  if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", next === "dark");
  themeListeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  const saved = localStorage.getItem(THEME_KEY);
  const system = systemTheme();
  if (saved === "auto") themeMode = "auto";
  else if (saved === "light") themeMode = "claro";
  else if (saved === "dark") themeMode = "escuro";
  else themeMode = system === "dark" ? "escuro" : "claro";
  paintTheme(themeMode === "auto" ? system : themeMode === "claro" ? "light" : "dark");
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (themeMode === "auto") paintTheme(systemTheme());
  });
}

export function getThemeMode() {
  return themeMode;
}

export function applyThemePreference(mode: ThemeMode) {
  themeMode = mode;
  const next = mode === "auto" ? (typeof window === "undefined" ? "dark" : systemTheme()) : mode === "claro" ? "light" : "dark";
  try { localStorage.setItem(THEME_KEY, mode === "auto" ? "auto" : next); } catch { /* ignore */ }
  paintTheme(next);
}

export const themeStore = {
  getSnapshot: () => theme,
  subscribe: (l: () => void) => { themeListeners.add(l); return () => themeListeners.delete(l); },
  toggle() {
    const next = theme === "dark" ? "light" : "dark";
    themeMode = next === "dark" ? "escuro" : "claro";
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_KEY, next);
      document.documentElement.classList.toggle("dark", next === "dark");
    }
    theme = next;
    themeListeners.forEach(l => l());
  }
};
export function useTheme() {
  return useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot, () => "dark" as Theme);
}

// ============== Wave 3 — Clients ==============
let clientsState: Client[] = [];
const clientListeners = new Set<() => void>();
const notifyClients = () => { bindClients(clientsState); clientListeners.forEach(l => l()); };
export const clientsStore = {
  getSnapshot: () => clientsState,
  subscribe: (l: () => void) => { clientListeners.add(l); return () => clientListeners.delete(l); },
  addClient(c: Client) { clientsState = [c, ...clientsState]; notifyClients(); saveRecord("client", c); runAutomations({ module: "comercial", event: "client_created", title: c.name, ref: c.id }, true); },
  updateClient(id: string, patch: Partial<Client>) {
    clientsState = clientsState.map(c => c.id === id ? { ...c, ...patch } : c);
    notifyClients();
    remember("client", clientsState, id);
  },
};
export function useClients() {
  return useSyncExternalStore(clientsStore.subscribe, clientsStore.getSnapshot, clientsStore.getSnapshot);
}

// ============== Wave 3 — Deals (Pipeline) ==============
let dealsState: Deal[] = [];
const dealListeners = new Set<() => void>();
const notifyDeals = () => dealListeners.forEach(l => l());
export const dealsStore = {
  getSnapshot: () => dealsState,
  subscribe: (l: () => void) => { dealListeners.add(l); return () => dealListeners.delete(l); },
  addDeal(d: Deal) { dealsState = [d, ...dealsState]; notifyDeals(); saveRecord("deal", d); runAutomations({ module: "comercial", event: "deal_created", title: d.title, ref: d.id, assigneeId: d.ownerId }, true); },
  updateDeal(id: string, patch: Partial<Deal>) {
    dealsState = dealsState.map(d => d.id === id ? { ...d, ...patch } : d);
    notifyDeals();
    remember("deal", dealsState, id);
  },
  moveStage(id: string, stage: DealStage) {
    const prob = stage === "ganho" ? 100 : stage === "perdido" ? 0 : undefined;
    dealsState = dealsState.map(d => d.id === id ? { ...d, stage, ...(prob !== undefined ? { probability: prob } : {}) } : d);
    notifyDeals();
    remember("deal", dealsState, id);
    const next = dealsState.find((deal) => deal.id === id);
    if (next) runAutomations({ module: "comercial", event: "deal_moved", title: next.title, ref: id, status: stage }, true);
  },
};
export function useDeals() {
  return useSyncExternalStore(dealsStore.subscribe, dealsStore.getSnapshot, dealsStore.getSnapshot);
}

// ============== Wave 3 — Invoices ==============
let invoicesState: Invoice[] = [];
const invListeners = new Set<() => void>();
const notifyInv = () => invListeners.forEach(l => l());
export const invoicesStore = {
  getSnapshot: () => invoicesState,
  subscribe: (l: () => void) => { invListeners.add(l); return () => invListeners.delete(l); },
  addInvoice(i: Invoice) { invoicesState = [i, ...invoicesState]; notifyInv(); saveRecord("invoice", i); runAutomations({ module: "financeiro", event: "invoice_created", title: i.number, ref: i.id, dueDate: i.dueDate }, true); },
  updateInvoice(id: string, patch: Partial<Invoice>) {
    invoicesState = invoicesState.map(i => i.id === id ? { ...i, ...patch } : i);
    notifyInv();
    remember("invoice", invoicesState, id);
  },
  markPaid(id: string) {
    invoicesState = invoicesState.map(i => i.id === id ? { ...i, status: "paga" as const, paidAt: new Date().toISOString().slice(0,10) } : i);
    notifyInv();
    remember("invoice", invoicesState, id);
    const next = invoicesState.find((invoice) => invoice.id === id);
    if (next) runAutomations({ module: "financeiro", event: "invoice_paid", title: next.number, ref: id, status: "paga" }, true);
  },
};
export function useInvoices() {
  return useSyncExternalStore(invoicesStore.subscribe, invoicesStore.getSnapshot, invoicesStore.getSnapshot);
}

// ============== Wave 4 — Documents ==============
let documentsState: Document[] = [];
const docListeners = new Set<() => void>();
const notifyDocs = () => docListeners.forEach(l => l());
export const documentsStore = {
  getSnapshot: () => documentsState,
  subscribe: (l: () => void) => { docListeners.add(l); return () => docListeners.delete(l); },
  addDocument(d: Document) { documentsState = [d, ...documentsState]; notifyDocs(); saveRecord("document", d); runAutomations({ module: "documentos", event: "document_created", title: d.title, ref: d.id, status: d.status, assigneeId: d.ownerId }, true); },
  updateDocument(id: string, patch: Partial<Document>) {
    documentsState = documentsState.map(d => d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString().slice(0, 10) } : d);
    notifyDocs();
    remember("document", documentsState, id);
  },
  setStatus(id: string, status: DocumentStatus) {
    documentsState = documentsState.map(d => d.id === id ? { ...d, status, updatedAt: new Date().toISOString().slice(0, 10) } : d);
    notifyDocs();
    remember("document", documentsState, id);
    const next = documentsState.find((document) => document.id === id);
    if (next) runAutomations({ module: "documentos", event: "document_status", title: next.title, ref: id, status }, true);
  },
  signBy(id: string, signatoryId: string) {
    documentsState = documentsState.map(d => {
      if (d.id !== id) return d;
      const signatories = d.signatories.map(s => s.id === signatoryId ? { ...s, status: "assinado" as const, signedAt: new Date().toISOString().slice(0, 10) } : s);
      const allSigned = signatories.length > 0 && signatories.every(s => s.status === "assinado");
      return { ...d, signatories, status: allSigned ? "assinado" as DocumentStatus : d.status, updatedAt: new Date().toISOString().slice(0, 10) };
    });
    notifyDocs();
    remember("document", documentsState, id);
    const next = documentsState.find((document) => document.id === id);
    if (next) runAutomations({ module: "documentos", event: "document_signed", title: next.title, ref: id, status: next.status }, true);
  },
};
export function useDocuments() {
  return useSyncExternalStore(documentsStore.subscribe, documentsStore.getSnapshot, documentsStore.getSnapshot);
}

// ============== Wave 4 — Approvals ==============
let approvalsState: ApprovalRequest[] = [];
const apListeners = new Set<() => void>();
const notifyAp = () => apListeners.forEach(l => l());
export const approvalsStore = {
  getSnapshot: () => approvalsState,
  subscribe: (l: () => void) => { apListeners.add(l); return () => apListeners.delete(l); },
  addRequest(r: ApprovalRequest) { approvalsState = [r, ...approvalsState]; notifyAp(); saveRecord("approval", r); runAutomations({ module: "aprovacoes", event: "approval_created", title: r.title, ref: r.id, status: r.status, assigneeId: r.requesterId }, true); },
  decideStep(reqId: string, stepId: string, decision: "aprovado" | "rejeitado", note?: string) {
    approvalsState = approvalsState.map(r => {
      if (r.id !== reqId) return r;
      const now = new Date().toISOString().slice(0, 10);
      const steps = r.steps.map(s => s.id === stepId ? { ...s, status: decision as ApprovalStatus, decidedAt: now, note } : s);
      let status: ApprovalStatus = r.status;
      if (decision === "rejeitado") status = "rejeitado";
      else if (steps.every(s => s.status === "aprovado")) status = "aprovado";
      else status = "pendente";
      return { ...r, steps, status };
    });
    notifyAp();
    remember("approval", approvalsState, reqId);
    const next = approvalsState.find((request) => request.id === reqId);
    if (next) runAutomations({ module: "aprovacoes", event: "approval_decided", title: next.title, ref: reqId, status: decision }, true);
  },
  cancel(id: string) {
    approvalsState = approvalsState.map(r => r.id === id ? { ...r, status: "cancelado" as ApprovalStatus } : r);
    notifyAp();
    remember("approval", approvalsState, id);
  },
};
export function useApprovals() {
  return useSyncExternalStore(approvalsStore.subscribe, approvalsStore.getSnapshot, approvalsStore.getSnapshot);
}

type WorkspaceSnapshot = {
  projects?: Project[];
  tasks?: Task[];
  templates?: ProjectTemplate[];
  automations?: AutomationRule[];
  timeEntries?: TimeEntry[];
  clients?: Client[];
  deals?: Deal[];
  invoices?: Invoice[];
  documents?: Document[];
  approvals?: ApprovalRequest[];
};

function publishAll() {
  notify();
  notifyProjects();
  notifyTpl();
  notifyAuto();
  notifyTimer();
  notifyClients();
  notifyDeals();
  notifyInv();
  notifyDocs();
  notifyAp();
}

export async function loadWorkspace() {
  const data = await apiRequest<WorkspaceSnapshot>("/api/workspace", {}, getAccessToken());
  acceptWrites = false;
  state = data.tasks ?? [];
  projectsState = data.projects ?? [];
  templatesState = data.templates ?? [];
  autoState = data.automations ?? [];
  entriesState = data.timeEntries ?? [];
  clientsState = data.clients ?? [];
  dealsState = data.deals ?? [];
  invoicesState = data.invoices ?? [];
  documentsState = data.documents ?? [];
  approvalsState = data.approvals ?? [];
  publishAll();
  acceptWrites = true;
}

export function resetWorkspace() {
  acceptWrites = false;
  state = [];
  projectsState = [];
  templatesState = [];
  autoState = [];
  entriesState = [];
  clientsState = [];
  dealsState = [];
  invoicesState = [];
  documentsState = [];
  approvalsState = [];
  activeTimer = null;
  publishAll();
}
