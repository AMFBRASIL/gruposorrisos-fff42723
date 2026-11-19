import type { AutomationRule, Comment, Priority, Task } from "@/lib/mock-data";

export type DomainFact = {
  module: string;
  event: string;
  title: string;
  ref: string;
  status?: string;
  from?: string;
  to?: string;
  dueDate?: string;
  priority?: Priority;
  assigneeId?: string;
  projectId?: string;
  today?: string;
  task?: Task;
};

export type TaskEvent =
  | { kind: "task_created"; task: Task }
  | { kind: "status_change"; task: Task; from: string; to: string }
  | { kind: "assigned"; task: Task }
  | { kind: "schedule"; task: Task; today: string };

const priorities = new Set<Priority>(["baixa", "normal", "alta", "urgente", "critica"]);

function daySpan(today: string, due: string) {
  const start = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${due.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86400000);
}

function fieldValue(task: Task, field: string) {
  if (field === "priority") return task.priority;
  if (field === "status") return task.status;
  if (field === "department") return task.department;
  if (field === "title") return task.title;
  return "";
}

export function matchesRule(rule: AutomationRule, fact: DomainFact) {
  if (!rule.enabled || (rule.module || "tarefas") !== fact.module) return false;
  if (fact.module === "tarefas" && fact.task) {
    if (fact.event === "schedule") return ruleMatches(rule, { kind: "schedule", task: fact.task, today: fact.today || "" });
    if (fact.event === "status_change") return ruleMatches(rule, { kind: "status_change", task: fact.task, from: fact.from || "", to: fact.to || "" });
    if (fact.event === "assigned") return ruleMatches(rule, { kind: "assigned", task: fact.task });
    if (fact.event === "task_created") return ruleMatches(rule, { kind: "task_created", task: fact.task });
    return false;
  }
  if (rule.trigger !== fact.event) return false;
  return rule.conditions.every((condition) => {
    const value = (condition.field === "status" ? fact.status : condition.field === "priority" ? fact.priority : fact.title) ?? "";
    const expected = condition.value.trim().toLowerCase();
    const current = value.toLowerCase();
    if (condition.op === "eq") return current === expected;
    if (condition.op === "neq") return current !== expected;
    return current.includes(expected);
  });
}

export function planDomain(rule: AutomationRule, fact: DomainFact) {
  const notes: string[] = [];
  let priority: Priority = priorities.has(fact.priority as Priority) ? fact.priority as Priority : "normal";
  let title = `Acompanhar: ${fact.title}`;
  let spawn = false;
  for (const action of rule.actions) {
    if (action.type === "notify") notes.push("aviso ao responsável");
    if (action.type === "send_email") notes.push("e-mail registrado para o responsável");
    if (action.type === "comment") notes.push(action.payload.text?.trim() || "comentário automático");
    if (action.type === "create_task") {
      spawn = true;
      if (action.payload.title?.trim()) title = action.payload.title.trim();
    }
    if (action.type === "set_priority" && priorities.has(action.payload.value as Priority)) {
      priority = action.payload.value as Priority;
      notes.push(`prioridade ${action.payload.value}`);
      spawn = true;
    }
  }
  const summary = notes.join(", ");
  if (!spawn) return { summary, spawn: null as { title: string; priority: Priority; status: string } | null };
  return { summary: summary || "nova tarefa", spawn: { title, priority, status: "todo" } };
}

export function ruleMatches(rule: AutomationRule, event: TaskEvent) {
  if (!rule.enabled || !conditionsMatch(rule, event.task)) return false;
  if (rule.trigger === "task_created") return event.kind === "task_created";
  if (rule.trigger === "assigned") return event.kind === "assigned";
  if (rule.trigger === "status_change" && event.kind === "status_change") {
    const from = rule.triggerConfig.from?.trim() ?? "";
    const to = rule.triggerConfig.to?.trim() ?? "";
    return (!from || from === event.from) && (!to || to === event.to);
  }
  if (event.kind !== "schedule") return false;
  const span = daySpan(event.today, event.task.dueDate);
  if (span == null || event.task.status === "concluido") return false;
  const days = Number(rule.triggerConfig.days ?? 0);
  const window = Number.isFinite(days) && days >= 0 ? days : 0;
  if (rule.trigger === "due_soon") return span >= 0 && span <= window;
  if (rule.trigger === "overdue") return span < 0 && Math.abs(span) >= window;
  return false;
}

function conditionsMatch(rule: AutomationRule, task: Task) {
  return rule.conditions.every((condition) => {
    const value = fieldValue(task, condition.field).toLowerCase();
    const expected = condition.value.trim().toLowerCase();
    if (condition.op === "eq") return value === expected;
    if (condition.op === "neq") return value !== expected;
    return value.includes(expected);
  });
}

export function planAutomation(rule: AutomationRule, task: Task, now: string) {
  const notes: string[] = [];
  const patch: Partial<Task> = {};
  let spawn: { title: string; priority: Priority; status: string } | null = null;
  for (const action of rule.actions) {
    if (action.type === "notify") notes.push("aviso ao responsável");
    if (action.type === "send_email") notes.push("e-mail registrado para o responsável");
    if (action.type === "comment") notes.push(action.payload.text?.trim() || "comentário automático");
    if (action.type === "set_priority" && priorities.has(action.payload.value as Priority) && action.payload.value !== task.priority) {
      patch.priority = action.payload.value as Priority;
      notes.push(`prioridade ${action.payload.value}`);
    }
    if (action.type === "move_status" && action.payload.to && action.payload.to !== task.status) {
      patch.status = action.payload.to;
      if (action.payload.to === "concluido") patch.completedAt = now;
      notes.push(`status ${action.payload.to}`);
    }
    if (action.type === "create_task") {
      spawn = { title: action.payload.title?.trim() || `Desdobramento: ${task.title}`, priority: task.priority, status: "todo" };
      notes.push("nova tarefa");
    }
  }
  if (notes.length) {
    const comment: Comment = { id: `auto_${rule.id}_${Math.random().toString(36).slice(2, 10)}`, userId: "sistema", text: `Automação “${rule.name}”: ${notes.join(", ")}.`, at: now };
    patch.comments = [...task.comments, comment];
  }
  return { patch, spawn, summary: notes.join(", ") };
}
