import { findClientRow, findPerson, findProjectRow } from "@/lib/live-lookup";

export type Priority = "baixa" | "normal" | "alta" | "urgente" | "critica";
export type TaskStatus = string;

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  initials: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  teamIds: string[];
  startDate: string;
  endDate: string;
  status: "planejamento" | "andamento" | "pausado" | "concluido";
  color: string;
  priority: Priority;
  progress: number;
  health: number;
}

export interface ChecklistItem { id: string; text: string; done: boolean; doneAt?: string; doneBy?: string; doneNote?: string; }
export interface Comment { id: string; userId: string; text: string; at: string; }

export interface TimeEntry { id: string; userId: string; start: string; end?: string; minutes: number; note?: string; }

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assigneeId: string;
  participantIds: string[];
  department: string;
  tags: string[];
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  startDate: string;
  dueDate: string;
  completedAt?: string;
  checklist: ChecklistItem[];
  comments: Comment[];
  attachments: { id: string; name: string; size: string; type: string }[];
  estimatedHours: number;
  loggedHours: number;
  dependsOn?: string[];
  timeEntries?: TimeEntry[];
}

// ===== Project Templates =====
export interface TemplateTask {
  title: string;
  department?: string;
  priority?: Priority;
  estimatedHours?: number;
  offsetStartDays?: number; // dias após o início do projeto
  offsetDueDays?: number;
  status?: TaskStatus;
  dependsOnIndex?: number[]; // referência por índice dentro do template
}
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  color: string;
  category: "Operações" | "Marketing" | "TI" | "RH" | "Financeiro" | "Geral";
  defaultDurationDays: number;
  tasks: TemplateTask[];
}

// ===== Automações =====
export type TriggerType = "status_change" | "task_created" | "due_soon" | "overdue" | "assigned";
export type ActionType = "notify" | "create_task" | "move_status" | "set_priority" | "send_email" | "comment";

export interface AutomationCondition { field: string; op: "eq" | "neq" | "contains"; value: string; }
export interface AutomationAction { type: ActionType; payload: Record<string, string>; }

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  module?: string;
  trigger: string;
  triggerConfig: Record<string, string>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  runs: number;
  lastRun?: string;
  createdAt: string;
  color: string;
}

export const COLUMNS: { id: string; title: string }[] = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "A Fazer" },
  { id: "analise", title: "Em Análise" },
  { id: "dev", title: "Em Desenvolvimento" },
  { id: "aprovacao", title: "Em Aprovação" },
  { id: "concluido", title: "Concluído" },
];

export const users: User[] = [
  { id: "u1", name: "Maria Silva", email: "maria@gruposorrisos.com", role: "Gerente", department: "Operações", initials: "MS", color: "oklch(0.65 0.18 25)" },
  { id: "u2", name: "João Pereira", email: "joao@gruposorrisos.com", role: "Diretor", department: "Diretoria", initials: "JP", color: "oklch(0.6 0.18 260)" },
  { id: "u3", name: "Ana Costa", email: "ana@gruposorrisos.com", role: "Supervisora", department: "Financeiro", initials: "AC", color: "oklch(0.62 0.16 155)" },
  { id: "u4", name: "Carlos Lima", email: "carlos@gruposorrisos.com", role: "Colaborador", department: "TI", initials: "CL", color: "oklch(0.65 0.14 230)" },
  { id: "u5", name: "Beatriz Souza", email: "beatriz@gruposorrisos.com", role: "Colaboradora", department: "Marketing", initials: "BS", color: "oklch(0.7 0.18 340)" },
  { id: "u6", name: "Rafael Mendes", email: "rafael@gruposorrisos.com", role: "Colaborador", department: "RH", initials: "RM", color: "oklch(0.7 0.15 70)" },
  { id: "u7", name: "Patrícia Alves", email: "patricia@gruposorrisos.com", role: "Supervisora", department: "Comercial", initials: "PA", color: "oklch(0.6 0.2 295)" },
  { id: "u8", name: "Lucas Ferreira", email: "lucas@gruposorrisos.com", role: "Colaborador", department: "Operações", initials: "LF", color: "oklch(0.65 0.15 190)" },
];

export const projects: Project[] = [
  { id: "p1", name: "Implantação Unidade Sorocaba", description: "Abertura completa da nova unidade do Grupo Sorrisos em Sorocaba.", ownerId: "u2", teamIds: ["u1","u3","u4","u8"], startDate: "2026-05-01", endDate: "2026-08-30", status: "andamento", color: "oklch(0.6 0.18 260)", priority: "alta", progress: 62, health: 84 },
  { id: "p2", name: "Campanha Sorriso 2026", description: "Campanha de marketing institucional para o segundo semestre.", ownerId: "u5", teamIds: ["u5","u7"], startDate: "2026-06-01", endDate: "2026-07-15", status: "andamento", color: "oklch(0.7 0.18 340)", priority: "normal", progress: 38, health: 71 },
  { id: "p3", name: "Atualização Sistema Financeiro", description: "Migração para nova versão do ERP financeiro.", ownerId: "u3", teamIds: ["u3","u4"], startDate: "2026-04-15", endDate: "2026-06-20", status: "andamento", color: "oklch(0.62 0.16 155)", priority: "urgente", progress: 78, health: 58 },
  { id: "p4", name: "Treinamento Equipe Clínica", description: "Capacitação dos novos dentistas e auxiliares.", ownerId: "u6", teamIds: ["u6","u1"], startDate: "2026-06-05", endDate: "2026-06-25", status: "planejamento", color: "oklch(0.7 0.15 70)", priority: "normal", progress: 12, health: 90 },
  { id: "p5", name: "Auditoria LGPD", description: "Revisão completa de conformidade com a LGPD.", ownerId: "u4", teamIds: ["u4","u3","u2"], startDate: "2026-03-01", endDate: "2026-06-12", status: "andamento", color: "oklch(0.65 0.14 230)", priority: "critica", progress: 85, health: 45 },
];

const today = new Date("2026-06-10");
const addDays = (d: number) => {
  const x = new Date(today); x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

let tid = 0;
const makeTask = (t: Partial<Task>): Task => {
  tid++;
  return {
    id: `t${tid}`,
    title: t.title || "Tarefa",
    description: t.description || "",
    projectId: t.projectId || "p1",
    assigneeId: t.assigneeId || "u1",
    participantIds: t.participantIds || [],
    department: t.department || "Operações",
    tags: t.tags || [],
    priority: t.priority || "normal",
    status: t.status || "todo",
    createdAt: t.createdAt || addDays(-10),
    startDate: t.startDate || addDays(-5),
    dueDate: t.dueDate || addDays(5),
    completedAt: t.completedAt,
    checklist: t.checklist || [],
    comments: t.comments || [],
    attachments: t.attachments || [],
    estimatedHours: t.estimatedHours ?? 8,
    loggedHours: t.loggedHours ?? 0,
  };
};

export const tasks: Task[] = [
  makeTask({ title: "Negociar contrato de locação", description: "Fechar contrato com a imobiliária da unidade Sorocaba.", projectId: "p1", assigneeId: "u1", participantIds: ["u2"], department: "Operações", tags: ["contrato","jurídico"], priority: "alta", status: "dev", dueDate: addDays(2), estimatedHours: 16, loggedHours: 10,
    checklist: [{id:"c1",text:"Revisar minuta",done:true},{id:"c2",text:"Validar com jurídico",done:true},{id:"c3",text:"Assinatura digital",done:false}],
    comments: [{id:"cm1",userId:"u2",text:"Pessoal, prioridade máxima essa semana.",at:addDays(-1)}],
  }),
  makeTask({ title: "Definir layout da recepção", projectId: "p1", assigneeId: "u8", department: "Operações", tags: ["design"], priority: "normal", status: "analise", dueDate: addDays(7), estimatedHours: 12, loggedHours: 4 }),
  makeTask({ title: "Comprar mobiliário das salas clínicas", projectId: "p1", assigneeId: "u1", department: "Compras", tags: ["compras"], priority: "alta", status: "todo", dueDate: addDays(10), estimatedHours: 20 }),
  makeTask({ title: "Contratar equipe de limpeza", projectId: "p1", assigneeId: "u6", department: "RH", priority: "normal", status: "backlog", dueDate: addDays(20) }),
  makeTask({ title: "Vistoria final da obra", projectId: "p1", assigneeId: "u2", department: "Diretoria", priority: "urgente", status: "todo", dueDate: addDays(-1), estimatedHours: 6 }),

  makeTask({ title: "Briefing da campanha", projectId: "p2", assigneeId: "u5", department: "Marketing", tags: ["criação"], priority: "normal", status: "concluido", dueDate: addDays(-15), completedAt: addDays(-12), estimatedHours: 8, loggedHours: 9 }),
  makeTask({ title: "Produzir vídeos institucionais", projectId: "p2", assigneeId: "u5", participantIds: ["u7"], department: "Marketing", tags: ["vídeo"], priority: "alta", status: "dev", dueDate: addDays(4), estimatedHours: 40, loggedHours: 22 }),
  makeTask({ title: "Programar anúncios redes sociais", projectId: "p2", assigneeId: "u7", department: "Marketing", priority: "normal", status: "todo", dueDate: addDays(8) }),

  makeTask({ title: "Backup completo do ERP atual", projectId: "p3", assigneeId: "u4", department: "TI", priority: "critica", status: "concluido", dueDate: addDays(-8), completedAt: addDays(-8) }),
  makeTask({ title: "Migrar plano de contas", projectId: "p3", assigneeId: "u3", department: "Financeiro", priority: "urgente", status: "aprovacao", dueDate: addDays(1), estimatedHours: 24, loggedHours: 23 }),
  makeTask({ title: "Treinar usuários no novo sistema", projectId: "p3", assigneeId: "u3", participantIds:["u6"], department: "Financeiro", priority: "alta", status: "todo", dueDate: addDays(12) }),
  makeTask({ title: "Configurar integrações bancárias", projectId: "p3", assigneeId: "u4", department: "TI", priority: "alta", status: "dev", dueDate: addDays(3), estimatedHours: 16, loggedHours: 7 }),

  makeTask({ title: "Montar grade de treinamento", projectId: "p4", assigneeId: "u6", department: "RH", priority: "normal", status: "analise", dueDate: addDays(6) }),
  makeTask({ title: "Reservar auditório", projectId: "p4", assigneeId: "u6", department: "RH", priority: "baixa", status: "backlog", dueDate: addDays(14) }),

  makeTask({ title: "Mapear dados pessoais coletados", projectId: "p5", assigneeId: "u4", participantIds:["u3"], department: "TI", tags: ["LGPD","conformidade"], priority: "critica", status: "dev", dueDate: addDays(-2), estimatedHours: 30, loggedHours: 26 }),
  makeTask({ title: "Atualizar política de privacidade", projectId: "p5", assigneeId: "u2", department: "Jurídico", priority: "urgente", status: "aprovacao", dueDate: addDays(0), estimatedHours: 10, loggedHours: 8 }),
  makeTask({ title: "Treinar equipe sobre LGPD", projectId: "p5", assigneeId: "u6", department: "RH", priority: "alta", status: "todo", dueDate: addDays(9) }),
  makeTask({ title: "Auditoria final", projectId: "p5", assigneeId: "u2", department: "Diretoria", priority: "critica", status: "backlog", dueDate: addDays(15) }),
];

export const priorityMeta: Record<Priority, { label: string; className: string }> = {
  baixa:    { label: "Baixa",    className: "bg-muted text-muted-foreground" },
  normal:   { label: "Normal",   className: "bg-info/15 text-info" },
  alta:     { label: "Alta",     className: "bg-warning/15 text-warning" },
  urgente:  { label: "Urgente",  className: "bg-destructive/15 text-destructive" },
  critica:  { label: "Crítica",  className: "bg-destructive text-destructive-foreground" },
};

export const getUser = (id: string) => findPerson(id) ?? users.find(u => u.id === id);
export const getProject = (id: string) => findProjectRow(id) ?? projects.find(p => p.id === id);

export function daysUntil(dateStr: string): number {
  if (!dateStr) return 0;
  const due = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

export interface Activity { id: string; user: string; action: string; target: string; at: string; }
export const recentActivity: Activity[] = [
  { id: "a1", user: "Maria Silva", action: "concluiu a tarefa", target: "Briefing da campanha", at: "há 2h" },
  { id: "a2", user: "João Pereira", action: "comentou em", target: "Negociar contrato de locação", at: "há 4h" },
  { id: "a3", user: "Carlos Lima", action: "moveu para Em Desenvolvimento", target: "Configurar integrações bancárias", at: "há 6h" },
  { id: "a4", user: "Ana Costa", action: "criou a tarefa", target: "Migrar plano de contas", at: "ontem" },
  { id: "a5", user: "Beatriz Souza", action: "anexou arquivo em", target: "Produzir vídeos institucionais", at: "ontem" },
];

// ===== Seed: Templates de projeto =====
export const projectTemplates: ProjectTemplate[] = [
  {
    id: "tpl_unit", name: "Abertura de Nova Unidade", category: "Operações",
    description: "Fluxo completo para abrir uma nova unidade do Grupo Sorrisos.",
    icon: "🏥", color: "oklch(0.6 0.18 260)", defaultDurationDays: 120,
    tasks: [
      { title: "Pesquisar pontos comerciais", department: "Operações", priority: "alta", estimatedHours: 16, offsetStartDays: 0, offsetDueDays: 10 },
      { title: "Negociar contrato de locação", department: "Operações", priority: "alta", estimatedHours: 12, offsetStartDays: 10, offsetDueDays: 25, dependsOnIndex: [0] },
      { title: "Projeto arquitetônico", department: "Operações", priority: "normal", estimatedHours: 40, offsetStartDays: 25, offsetDueDays: 55, dependsOnIndex: [1] },
      { title: "Obra e adequação", department: "Operações", priority: "alta", estimatedHours: 200, offsetStartDays: 30, offsetDueDays: 90, dependsOnIndex: [2] },
      { title: "Compra de mobiliário e equipamentos", department: "Compras", priority: "alta", estimatedHours: 24, offsetStartDays: 60, offsetDueDays: 100 },
      { title: "Contratar equipe clínica", department: "RH", priority: "alta", estimatedHours: 30, offsetStartDays: 70, offsetDueDays: 110 },
      { title: "Vistoria final e alvarás", department: "Diretoria", priority: "urgente", estimatedHours: 8, offsetStartDays: 110, offsetDueDays: 120, dependsOnIndex: [3,4,5] },
    ],
  },
  {
    id: "tpl_campaign", name: "Campanha de Marketing", category: "Marketing",
    description: "Planejamento e execução de uma campanha sazonal.",
    icon: "📣", color: "oklch(0.7 0.18 340)", defaultDurationDays: 45,
    tasks: [
      { title: "Briefing da campanha", department: "Marketing", priority: "normal", estimatedHours: 8, offsetStartDays: 0, offsetDueDays: 5 },
      { title: "Definição de pauta criativa", department: "Marketing", priority: "alta", estimatedHours: 12, offsetStartDays: 5, offsetDueDays: 12, dependsOnIndex: [0] },
      { title: "Produção de criativos", department: "Marketing", priority: "alta", estimatedHours: 40, offsetStartDays: 12, offsetDueDays: 30, dependsOnIndex: [1] },
      { title: "Aprovação interna", department: "Marketing", priority: "urgente", estimatedHours: 4, offsetStartDays: 28, offsetDueDays: 32, dependsOnIndex: [2] },
      { title: "Programar anúncios", department: "Marketing", priority: "normal", estimatedHours: 8, offsetStartDays: 32, offsetDueDays: 38, dependsOnIndex: [3] },
      { title: "Acompanhamento e relatório", department: "Marketing", priority: "normal", estimatedHours: 12, offsetStartDays: 38, offsetDueDays: 45 },
    ],
  },
  {
    id: "tpl_onboarding", name: "Onboarding de Colaborador", category: "RH",
    description: "Integração de novo membro da equipe.",
    icon: "👋", color: "oklch(0.65 0.14 230)", defaultDurationDays: 30,
    tasks: [
      { title: "Coletar documentos e contratos", department: "RH", priority: "alta", estimatedHours: 4, offsetStartDays: 0, offsetDueDays: 3 },
      { title: "Configurar e-mail e acessos", department: "TI", priority: "alta", estimatedHours: 2, offsetStartDays: 0, offsetDueDays: 2 },
      { title: "Tour pela unidade", department: "RH", priority: "normal", estimatedHours: 2, offsetStartDays: 2, offsetDueDays: 4 },
      { title: "Treinamentos obrigatórios", department: "RH", priority: "alta", estimatedHours: 16, offsetStartDays: 4, offsetDueDays: 14, dependsOnIndex: [2] },
      { title: "Acompanhamento 30 dias", department: "RH", priority: "normal", estimatedHours: 2, offsetStartDays: 28, offsetDueDays: 30 },
    ],
  },
  {
    id: "tpl_sprint", name: "Sprint de TI (2 semanas)", category: "TI",
    description: "Ciclo padrão de desenvolvimento da equipe de TI.",
    icon: "💻", color: "oklch(0.62 0.16 155)", defaultDurationDays: 14,
    tasks: [
      { title: "Planning da sprint", department: "TI", priority: "alta", estimatedHours: 4, offsetStartDays: 0, offsetDueDays: 1 },
      { title: "Desenvolvimento das features", department: "TI", priority: "alta", estimatedHours: 50, offsetStartDays: 1, offsetDueDays: 11, dependsOnIndex: [0] },
      { title: "Code review", department: "TI", priority: "normal", estimatedHours: 8, offsetStartDays: 9, offsetDueDays: 12, dependsOnIndex: [1] },
      { title: "QA e testes", department: "TI", priority: "alta", estimatedHours: 12, offsetStartDays: 10, offsetDueDays: 13, dependsOnIndex: [2] },
      { title: "Deploy em produção", department: "TI", priority: "urgente", estimatedHours: 4, offsetStartDays: 13, offsetDueDays: 14, dependsOnIndex: [3] },
      { title: "Retrospectiva", department: "TI", priority: "normal", estimatedHours: 2, offsetStartDays: 14, offsetDueDays: 14, dependsOnIndex: [4] },
    ],
  },
  {
    id: "tpl_audit", name: "Auditoria & Conformidade", category: "Financeiro",
    description: "Processo padrão de auditoria interna.",
    icon: "🛡️", color: "oklch(0.65 0.14 230)", defaultDurationDays: 60,
    tasks: [
      { title: "Definir escopo da auditoria", department: "Financeiro", priority: "alta", estimatedHours: 8, offsetStartDays: 0, offsetDueDays: 5 },
      { title: "Coletar evidências e documentos", department: "Financeiro", priority: "alta", estimatedHours: 30, offsetStartDays: 5, offsetDueDays: 25, dependsOnIndex: [0] },
      { title: "Análise e identificação de gaps", department: "Financeiro", priority: "urgente", estimatedHours: 24, offsetStartDays: 25, offsetDueDays: 45, dependsOnIndex: [1] },
      { title: "Relatório final", department: "Financeiro", priority: "alta", estimatedHours: 12, offsetStartDays: 45, offsetDueDays: 55, dependsOnIndex: [2] },
      { title: "Apresentação à diretoria", department: "Diretoria", priority: "urgente", estimatedHours: 4, offsetStartDays: 55, offsetDueDays: 60, dependsOnIndex: [3] },
    ],
  },
  {
    id: "tpl_event", name: "Evento Corporativo", category: "Geral",
    description: "Organização completa de um evento interno.",
    icon: "🎉", color: "oklch(0.7 0.15 70)", defaultDurationDays: 60,
    tasks: [
      { title: "Definir conceito e público", department: "Marketing", priority: "alta", estimatedHours: 6, offsetStartDays: 0, offsetDueDays: 5 },
      { title: "Orçar fornecedores", department: "Compras", priority: "alta", estimatedHours: 12, offsetStartDays: 5, offsetDueDays: 15 },
      { title: "Reservar local", department: "Operações", priority: "urgente", estimatedHours: 4, offsetStartDays: 15, offsetDueDays: 20, dependsOnIndex: [1] },
      { title: "Divulgação interna", department: "Marketing", priority: "normal", estimatedHours: 8, offsetStartDays: 20, offsetDueDays: 50 },
      { title: "Logística e checklist final", department: "Operações", priority: "alta", estimatedHours: 12, offsetStartDays: 50, offsetDueDays: 58 },
      { title: "Realização do evento", department: "Operações", priority: "critica", estimatedHours: 12, offsetStartDays: 58, offsetDueDays: 60, dependsOnIndex: [4] },
    ],
  },
];

// ===== Seed: Automações =====
export const automationRules: AutomationRule[] = [
  {
    id: "auto1", name: "Notificar gestor quando tarefa atrasar",
    description: "Quando uma tarefa estoura o prazo, envia notificação ao responsável e ao gestor do projeto.",
    enabled: true, trigger: "overdue", triggerConfig: { days: "0" },
    conditions: [], actions: [{ type: "notify", payload: { to: "gestor", channel: "in_app" } }],
    runs: 12, lastRun: "2026-06-09", createdAt: "2026-05-01", color: "oklch(0.65 0.18 25)",
  },
  {
    id: "auto2", name: "Mover para Análise quando concluir todas as subtarefas",
    description: "Ao marcar a última subtarefa como concluída, move a tarefa para a coluna Em Análise.",
    enabled: true, trigger: "status_change", triggerConfig: { from: "checklist_complete" },
    conditions: [], actions: [{ type: "move_status", payload: { to: "aprovacao" } }],
    runs: 34, lastRun: "2026-06-10", createdAt: "2026-04-15", color: "oklch(0.62 0.16 155)",
  },
  {
    id: "auto3", name: "Lembrete 2 dias antes do prazo",
    description: "Envia lembrete ao responsável 2 dias antes do vencimento.",
    enabled: true, trigger: "due_soon", triggerConfig: { days: "2" },
    conditions: [], actions: [{ type: "notify", payload: { to: "assignee", channel: "in_app" } }],
    runs: 47, lastRun: "2026-06-10", createdAt: "2026-03-20", color: "oklch(0.7 0.15 70)",
  },
  {
    id: "auto4", name: "Escalar tarefas críticas atrasadas",
    description: "Tarefas com prioridade crítica que ficam atrasadas mudam o responsável para o diretor.",
    enabled: false, trigger: "overdue", triggerConfig: { days: "1" },
    conditions: [{ field: "priority", op: "eq", value: "critica" }],
    actions: [{ type: "notify", payload: { to: "diretor", channel: "email" } }, { type: "set_priority", payload: { value: "critica" } }],
    runs: 3, lastRun: "2026-05-28", createdAt: "2026-04-02", color: "oklch(0.6 0.2 295)",
  },
];

// ===== Seed: Time entries =====
export const seedTimeEntries: TimeEntry[] = [
  { id: "te1", userId: "u1", start: "2026-06-09T09:00:00", end: "2026-06-09T11:30:00", minutes: 150, note: "Revisão do contrato" },
  { id: "te2", userId: "u1", start: "2026-06-09T14:00:00", end: "2026-06-09T17:00:00", minutes: 180, note: "Reunião jurídico" },
  { id: "te3", userId: "u3", start: "2026-06-09T08:30:00", end: "2026-06-09T12:00:00", minutes: 210, note: "Migração plano de contas" },
  { id: "te4", userId: "u4", start: "2026-06-09T09:00:00", end: "2026-06-09T13:00:00", minutes: 240, note: "Configurar integrações" },
  { id: "te5", userId: "u5", start: "2026-06-10T10:00:00", end: "2026-06-10T13:00:00", minutes: 180, note: "Produção de vídeo" },
];

// =============================================================
// ============== WAVE 3 — Financeiro & Comercial ==============
// =============================================================

export interface Client {
  id: string;
  name: string;
  segment: string;
  city: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  logo: string; // initials
  color: string;
  status: "ativo" | "prospect" | "inativo";
  since: string;
  ltv: number;
  ownerId: string;
}

export type DealStage = "lead" | "qualificacao" | "proposta" | "negociacao" | "ganho" | "perdido";
export interface Deal {
  id: string;
  title: string;
  clientId: string;
  ownerId: string;
  value: number;
  stage: DealStage;
  probability: number; // 0-100
  expectedCloseDate: string;
  source: string;
  createdAt: string;
  notes?: string;
  lostReason?: string;
}

export type InvoiceStatus = "rascunho" | "enviada" | "paga" | "vencida" | "cancelada";
export interface InvoiceItem { id: string; description: string; quantity: number; unitPrice: number; }
export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  projectId?: string;
  issueDate: string;
  dueDate: string;
  paidAt?: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  notes?: string;
}

export type CostCategory = "Pessoal" | "Fornecedor" | "Software" | "Infraestrutura" | "Marketing" | "Outros";
export interface CostEntry {
  id: string;
  projectId: string;
  category: CostCategory;
  description: string;
  amount: number;
  date: string;
  vendor?: string;
}

export interface ProjectBudget {
  projectId: string;
  budget: number;
  currency: "BRL";
}

export const DEAL_STAGES: { id: DealStage; title: string; color: string }[] = [
  { id: "lead",          title: "Lead",           color: "oklch(0.65 0.14 230)" },
  { id: "qualificacao",  title: "Qualificação",   color: "oklch(0.7 0.15 70)" },
  { id: "proposta",      title: "Proposta",       color: "oklch(0.7 0.18 340)" },
  { id: "negociacao",    title: "Negociação",     color: "oklch(0.65 0.18 25)" },
  { id: "ganho",         title: "Ganho",          color: "oklch(0.62 0.16 155)" },
  { id: "perdido",       title: "Perdido",        color: "oklch(0.55 0.04 260)" },
];

export const invoiceStatusMeta: Record<InvoiceStatus, { label: string; className: string }> = {
  rascunho:  { label: "Rascunho",  className: "bg-muted text-muted-foreground" },
  enviada:   { label: "Enviada",   className: "bg-info/15 text-info" },
  paga:      { label: "Paga",      className: "bg-success/15 text-success" },
  vencida:   { label: "Vencida",   className: "bg-destructive/15 text-destructive" },
  cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground line-through" },
};

export const clients: Client[] = [
  { id: "cli1", name: "Clínica Bem Estar",     segment: "Saúde",         city: "São Paulo",   contactName: "Dra. Helena Rocha", contactEmail: "helena@bemestar.com",  contactPhone: "(11) 98888-1234", logo: "BE", color: "oklch(0.6 0.18 260)",  status: "ativo",    since: "2024-03-12", ltv: 285000, ownerId: "u7" },
  { id: "cli2", name: "Odonto Sorrir",         segment: "Saúde",         city: "Sorocaba",    contactName: "Dr. Marcos Vinhas", contactEmail: "marcos@odontosorrir.com", contactPhone: "(15) 99777-5566", logo: "OS", color: "oklch(0.62 0.16 155)", status: "ativo",    since: "2025-01-08", ltv: 142000, ownerId: "u7" },
  { id: "cli3", name: "Rede Saúde+",            segment: "Saúde",         city: "Campinas",    contactName: "Camila Duarte",     contactEmail: "camila@saudemais.com",  contactPhone: "(19) 99666-7788", logo: "S+", color: "oklch(0.7 0.18 340)",  status: "prospect", since: "2026-04-22", ltv: 0,      ownerId: "u5" },
  { id: "cli4", name: "Hospital Vida Plena",    segment: "Hospitalar",    city: "Rio de Janeiro", contactName: "Eduardo Lins",  contactEmail: "eduardo@vidaplena.com", contactPhone: "(21) 98555-3322", logo: "VP", color: "oklch(0.65 0.14 230)", status: "ativo",    since: "2023-11-03", ltv: 612000, ownerId: "u2" },
  { id: "cli5", name: "Clínica Alegria",        segment: "Saúde",         city: "Belo Horizonte", contactName: "Renata Prado",  contactEmail: "renata@alegria.com",    contactPhone: "(31) 98111-2244", logo: "CA", color: "oklch(0.7 0.15 70)",   status: "ativo",    since: "2025-07-19", ltv: 98000,  ownerId: "u5" },
  { id: "cli6", name: "Smile Express",          segment: "Franquia",      city: "Curitiba",    contactName: "Tiago Almeida",     contactEmail: "tiago@smileexpress.com",contactPhone: "(41) 99000-1010", logo: "SE", color: "oklch(0.6 0.2 295)",   status: "prospect", since: "2026-05-30", ltv: 0,      ownerId: "u7" },
  { id: "cli7", name: "Centro Médico Aurora",   segment: "Hospitalar",    city: "Porto Alegre",contactName: "Patrícia Mendes",   contactEmail: "patricia@aurora.com",   contactPhone: "(51) 98444-9988", logo: "CM", color: "oklch(0.65 0.18 25)",  status: "inativo",  since: "2022-09-15", ltv: 76000,  ownerId: "u2" },
];

export const deals: Deal[] = [
  { id: "d1", title: "Implantação ERP — Bem Estar Matriz",       clientId: "cli1", ownerId: "u7", value: 180000, stage: "negociacao",   probability: 70, expectedCloseDate: "2026-07-05", source: "Indicação",    createdAt: "2026-05-02", notes: "Cliente avaliando 2 fornecedores." },
  { id: "d2", title: "Expansão Sorocaba — Pacote completo",       clientId: "cli2", ownerId: "u7", value: 95000,  stage: "proposta",     probability: 55, expectedCloseDate: "2026-06-28", source: "Inbound",      createdAt: "2026-05-15" },
  { id: "d3", title: "Sistema de Agendamento — Rede Saúde+",      clientId: "cli3", ownerId: "u5", value: 240000, stage: "qualificacao", probability: 30, expectedCloseDate: "2026-08-15", source: "LinkedIn",     createdAt: "2026-05-20" },
  { id: "d4", title: "Renovação anual — Hospital Vida Plena",     clientId: "cli4", ownerId: "u2", value: 320000, stage: "ganho",        probability: 100,expectedCloseDate: "2026-06-01", source: "Renovação",    createdAt: "2026-04-10" },
  { id: "d5", title: "Treinamento equipe — Clínica Alegria",      clientId: "cli5", ownerId: "u5", value: 32000,  stage: "negociacao",   probability: 80, expectedCloseDate: "2026-06-25", source: "Indicação",    createdAt: "2026-05-28" },
  { id: "d6", title: "Piloto Smile Express — 3 unidades",         clientId: "cli6", ownerId: "u7", value: 120000, stage: "lead",         probability: 15, expectedCloseDate: "2026-09-30", source: "Evento",       createdAt: "2026-06-01" },
  { id: "d7", title: "Marketing digital trimestral — Bem Estar",  clientId: "cli1", ownerId: "u5", value: 45000,  stage: "proposta",     probability: 60, expectedCloseDate: "2026-07-12", source: "Cross-sell",   createdAt: "2026-05-25" },
  { id: "d8", title: "Auditoria LGPD — Aurora",                   clientId: "cli7", ownerId: "u4", value: 28000,  stage: "perdido",      probability: 0,  expectedCloseDate: "2026-05-20", source: "Outbound",     createdAt: "2026-04-25", lostReason: "Sem orçamento neste ciclo" },
  { id: "d9", title: "Consultoria de processos — Vida Plena",     clientId: "cli4", ownerId: "u2", value: 88000,  stage: "qualificacao", probability: 40, expectedCloseDate: "2026-08-02", source: "Cross-sell",   createdAt: "2026-06-03" },
  { id: "d10",title: "Implantação Sorocaba — fase 2",             clientId: "cli2", ownerId: "u7", value: 60000,  stage: "lead",         probability: 20, expectedCloseDate: "2026-09-10", source: "Cliente atual",createdAt: "2026-06-05" },
];

export const invoices: Invoice[] = [
  { id: "inv1", number: "NF-2026-0042", clientId: "cli4", projectId: "p5", issueDate: "2026-05-01", dueDate: "2026-05-31", paidAt: "2026-05-28", status: "paga",
    items: [{ id: "i1", description: "Auditoria LGPD — Fase 1", quantity: 1, unitPrice: 45000 }, { id: "i2", description: "Treinamento equipe (8h)", quantity: 8, unitPrice: 350 }] },
  { id: "inv2", number: "NF-2026-0043", clientId: "cli1", projectId: "p2", issueDate: "2026-05-10", dueDate: "2026-06-09", paidAt: "2026-06-05", status: "paga",
    items: [{ id: "i3", description: "Campanha mensal", quantity: 1, unitPrice: 22000 }] },
  { id: "inv3", number: "NF-2026-0044", clientId: "cli2", projectId: "p1", issueDate: "2026-05-20", dueDate: "2026-06-19", status: "enviada",
    items: [{ id: "i4", description: "Implantação Sorocaba — entrada", quantity: 1, unitPrice: 50000 }] },
  { id: "inv4", number: "NF-2026-0045", clientId: "cli5", projectId: "p4", issueDate: "2026-05-25", dueDate: "2026-06-08", status: "vencida",
    items: [{ id: "i5", description: "Treinamento clínica", quantity: 1, unitPrice: 12000 }] },
  { id: "inv5", number: "NF-2026-0046", clientId: "cli4",                   issueDate: "2026-06-01", dueDate: "2026-07-01", status: "enviada",
    items: [{ id: "i6", description: "Renovação anual", quantity: 1, unitPrice: 320000 }] },
  { id: "inv6", number: "NF-2026-0047", clientId: "cli1", projectId: "p2", issueDate: "2026-06-05", dueDate: "2026-07-05", status: "enviada",
    items: [{ id: "i7", description: "Mídia paga (junho)", quantity: 1, unitPrice: 18500 }] },
  { id: "inv7", number: "NF-2026-0048", clientId: "cli3",                   issueDate: "2026-06-08", dueDate: "2026-07-08", status: "rascunho",
    items: [{ id: "i8", description: "Estudo de viabilidade", quantity: 1, unitPrice: 14000 }] },
  { id: "inv8", number: "NF-2026-0040", clientId: "cli7",                   issueDate: "2026-04-12", dueDate: "2026-05-12", status: "vencida",
    items: [{ id: "i9", description: "Consultoria abril", quantity: 1, unitPrice: 9800 }] },
];

export const projectBudgets: ProjectBudget[] = [
  { projectId: "p1", budget: 380000, currency: "BRL" },
  { projectId: "p2", budget: 95000,  currency: "BRL" },
  { projectId: "p3", budget: 140000, currency: "BRL" },
  { projectId: "p4", budget: 32000,  currency: "BRL" },
  { projectId: "p5", budget: 120000, currency: "BRL" },
];

export const costEntries: CostEntry[] = [
  { id: "ce1",  projectId: "p1", category: "Fornecedor",     description: "Construtora — etapa 1",         amount: 120000, date: "2026-05-05", vendor: "Const. Horizonte" },
  { id: "ce2",  projectId: "p1", category: "Pessoal",        description: "Equipe operações (maio)",       amount: 38000,  date: "2026-05-30" },
  { id: "ce3",  projectId: "p1", category: "Fornecedor",     description: "Mobiliário clínico",            amount: 64000,  date: "2026-06-02", vendor: "MedMov" },
  { id: "ce4",  projectId: "p2", category: "Marketing",      description: "Mídia paga Meta + Google",      amount: 22000,  date: "2026-05-22" },
  { id: "ce5",  projectId: "p2", category: "Fornecedor",     description: "Produtora de vídeo",            amount: 18000,  date: "2026-06-01", vendor: "Studio Lux" },
  { id: "ce6",  projectId: "p3", category: "Software",       description: "Licenças ERP novo",             amount: 48000,  date: "2026-04-20", vendor: "ERPHub" },
  { id: "ce7",  projectId: "p3", category: "Pessoal",        description: "Consultoria migração",          amount: 36000,  date: "2026-05-18" },
  { id: "ce8",  projectId: "p3", category: "Infraestrutura", description: "Servidor + cloud (3 meses)",    amount: 12000,  date: "2026-05-10" },
  { id: "ce9",  projectId: "p4", category: "Pessoal",        description: "Instrutores externos",          amount: 14000,  date: "2026-06-04" },
  { id: "ce10", projectId: "p5", category: "Pessoal",        description: "Time LGPD",                     amount: 52000,  date: "2026-05-12" },
  { id: "ce11", projectId: "p5", category: "Software",       description: "DPO as a Service",              amount: 18000,  date: "2026-05-22" },
  { id: "ce12", projectId: "p5", category: "Outros",         description: "Assessoria jurídica",           amount: 22000,  date: "2026-06-03" },
];

// ===== Helpers =====
export const getClient = (id?: string) => findClientRow(id) ?? clients.find(c => c.id === id);
export const invoiceTotal = (inv: Invoice) => inv.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
export const formatBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ============================================================
// ===== Wave 4 — Documentos, Aprovações & Portal do Cliente
// ============================================================

export type DocumentType = "contrato" | "proposta" | "nf" | "relatorio" | "termo" | "outro";
export type DocumentStatus = "rascunho" | "revisao" | "aguardando_assinatura" | "assinado" | "expirado" | "arquivado";

export interface DocumentVersion {
  id: string; version: number; createdAt: string; createdBy: string; note?: string; size: string;
}
export interface DocumentSignatory {
  id: string; name: string; email: string; role: string;
  status: "pendente" | "assinado" | "recusado"; signedAt?: string;
}
export interface Document {
  id: string; title: string; type: DocumentType; status: DocumentStatus;
  clientId?: string; projectId?: string; ownerId: string;
  createdAt: string; updatedAt: string; expiresAt?: string;
  tags: string[]; versions: DocumentVersion[]; signatories: DocumentSignatory[];
  value?: number; templateOf?: boolean;
}

export const documentTypeMeta: Record<DocumentType, { label: string; icon: string; color: string }> = {
  contrato:  { label: "Contrato",    icon: "📄", color: "oklch(0.6 0.18 260)" },
  proposta:  { label: "Proposta",    icon: "💼", color: "oklch(0.7 0.15 70)" },
  nf:        { label: "Nota Fiscal", icon: "🧾", color: "oklch(0.62 0.16 155)" },
  relatorio: { label: "Relatório",   icon: "📊", color: "oklch(0.65 0.14 230)" },
  termo:     { label: "Termo",       icon: "📜", color: "oklch(0.7 0.18 340)" },
  outro:     { label: "Outro",       icon: "📁", color: "oklch(0.55 0.04 260)" },
};
export const documentStatusMeta: Record<DocumentStatus, { label: string; className: string }> = {
  rascunho:              { label: "Rascunho",              className: "bg-muted text-muted-foreground" },
  revisao:               { label: "Em revisão",            className: "bg-warning/15 text-warning" },
  aguardando_assinatura: { label: "Aguardando assinatura", className: "bg-info/15 text-info" },
  assinado:              { label: "Assinado",              className: "bg-success/15 text-success" },
  expirado:              { label: "Expirado",              className: "bg-destructive/15 text-destructive" },
  arquivado:             { label: "Arquivado",             className: "bg-muted text-muted-foreground line-through" },
};

export const documents: Document[] = [
  { id: "doc1", title: "Contrato de Prestação — Hospital Vida Plena (Renovação 2026)", type: "contrato", status: "assinado", clientId: "cli4", projectId: "p5", ownerId: "u2", createdAt: "2026-04-15", updatedAt: "2026-05-12", expiresAt: "2027-06-01", tags: ["renovação","anual"], value: 320000,
    versions: [
      { id: "v1", version: 1, createdAt: "2026-04-15", createdBy: "u2", note: "Versão inicial", size: "412 KB" },
      { id: "v2", version: 2, createdAt: "2026-04-22", createdBy: "u4", note: "Ajustes jurídicos", size: "428 KB" },
      { id: "v3", version: 3, createdAt: "2026-05-12", createdBy: "u2", note: "Versão final assinada", size: "446 KB" },
    ],
    signatories: [
      { id: "s1", name: "Eduardo Lins", email: "eduardo@vidaplena.com", role: "Cliente", status: "assinado", signedAt: "2026-05-12" },
      { id: "s2", name: "Sofia Almeida", email: "sofia@gruposorrisos.com", role: "Diretora", status: "assinado", signedAt: "2026-05-12" },
    ],
  },
  { id: "doc2", title: "Proposta Comercial — Implantação ERP Bem Estar", type: "proposta", status: "aguardando_assinatura", clientId: "cli1", ownerId: "u7", createdAt: "2026-05-30", updatedAt: "2026-06-08", expiresAt: "2026-07-15", tags: ["proposta","erp"], value: 180000,
    versions: [
      { id: "v1", version: 1, createdAt: "2026-05-30", createdBy: "u7", size: "318 KB" },
      { id: "v2", version: 2, createdAt: "2026-06-08", createdBy: "u7", note: "Revisão escopo + cronograma", size: "342 KB" },
    ],
    signatories: [
      { id: "s1", name: "Dra. Helena Rocha", email: "helena@bemestar.com", role: "CEO Cliente", status: "pendente" },
      { id: "s2", name: "Sofia Almeida", email: "sofia@gruposorrisos.com", role: "Diretora Comercial", status: "assinado", signedAt: "2026-06-08" },
    ],
  },
  { id: "doc3", title: "Termo de Confidencialidade — Rede Saúde+", type: "termo", status: "revisao", clientId: "cli3", ownerId: "u4", createdAt: "2026-06-02", updatedAt: "2026-06-10", tags: ["nda","jurídico"],
    versions: [{ id: "v1", version: 1, createdAt: "2026-06-02", createdBy: "u4", size: "98 KB" }],
    signatories: [{ id: "s1", name: "Camila Duarte", email: "camila@saudemais.com", role: "Diretora TI", status: "pendente" }],
  },
  { id: "doc4", title: "Relatório Mensal de Performance — Maio/26", type: "relatorio", status: "assinado", clientId: "cli1", projectId: "p2", ownerId: "u5", createdAt: "2026-06-01", updatedAt: "2026-06-03", tags: ["marketing","mensal"],
    versions: [{ id: "v1", version: 1, createdAt: "2026-06-03", createdBy: "u5", size: "1.2 MB" }],
    signatories: [],
  },
  { id: "doc5", title: "Contrato Piloto — Smile Express (3 unidades)", type: "contrato", status: "rascunho", clientId: "cli6", ownerId: "u7", createdAt: "2026-06-10", updatedAt: "2026-06-14", tags: ["piloto","franquia"], value: 120000,
    versions: [{ id: "v1", version: 1, createdAt: "2026-06-10", createdBy: "u7", size: "286 KB" }],
    signatories: [],
  },
  { id: "doc6", title: "Aditivo Contratual — Sorocaba Fase 2", type: "contrato", status: "aguardando_assinatura", clientId: "cli2", projectId: "p1", ownerId: "u2", createdAt: "2026-06-05", updatedAt: "2026-06-12", expiresAt: "2026-06-30", tags: ["aditivo"], value: 60000,
    versions: [
      { id: "v1", version: 1, createdAt: "2026-06-05", createdBy: "u2", size: "204 KB" },
      { id: "v2", version: 2, createdAt: "2026-06-12", createdBy: "u4", note: "Cláusula 4.2 revisada", size: "211 KB" },
    ],
    signatories: [{ id: "s1", name: "Dr. Marcos Vinhas", email: "marcos@odontosorrir.com", role: "Sócio", status: "pendente" }],
  },
  { id: "doc7", title: "Contrato Modelo — Prestação de Serviços PJ", type: "contrato", status: "arquivado", ownerId: "u4", createdAt: "2025-09-10", updatedAt: "2026-01-15", tags: ["template","modelo"], templateOf: true,
    versions: [{ id: "v1", version: 1, createdAt: "2025-09-10", createdBy: "u4", size: "180 KB" }],
    signatories: [],
  },
  { id: "doc8", title: "Termo de Aceite — Treinamento Alegria", type: "termo", status: "expirado", clientId: "cli5", projectId: "p4", ownerId: "u5", createdAt: "2026-04-01", updatedAt: "2026-05-30", expiresAt: "2026-05-30", tags: ["treinamento"],
    versions: [{ id: "v1", version: 1, createdAt: "2026-04-01", createdBy: "u5", size: "76 KB" }],
    signatories: [{ id: "s1", name: "Renata Prado", email: "renata@alegria.com", role: "Gerente", status: "pendente" }],
  },
];

// ===== Aprovações & Workflows =====
export type ApprovalType = "despesa" | "contrato" | "ferias" | "compra" | "horas_extras" | "viagem";
export type ApprovalStatus = "pendente" | "aprovado" | "rejeitado" | "cancelado";

export interface ApprovalStep {
  id: string; order: number; approverId: string;
  status: ApprovalStatus; decidedAt?: string; note?: string;
}
export interface ApprovalRequest {
  id: string; title: string; type: ApprovalType;
  requesterId: string; amount?: number; description: string;
  createdAt: string; dueDate?: string; status: ApprovalStatus;
  steps: ApprovalStep[];
  attachments?: { id: string; name: string; size: string }[];
  relatedProjectId?: string; relatedClientId?: string;
}

export const approvalTypeMeta: Record<ApprovalType, { label: string; icon: string; color: string }> = {
  despesa:      { label: "Despesa",       icon: "💰", color: "oklch(0.7 0.15 70)" },
  contrato:     { label: "Contrato",      icon: "📄", color: "oklch(0.6 0.18 260)" },
  ferias:       { label: "Férias",        icon: "🏖️", color: "oklch(0.65 0.14 230)" },
  compra:       { label: "Compra",        icon: "🛒", color: "oklch(0.62 0.16 155)" },
  horas_extras: { label: "Horas extras",  icon: "⏰", color: "oklch(0.7 0.18 340)" },
  viagem:       { label: "Viagem",        icon: "✈️", color: "oklch(0.65 0.18 25)" },
};
export const approvalStatusMeta: Record<ApprovalStatus, { label: string; className: string }> = {
  pendente:  { label: "Pendente",  className: "bg-warning/15 text-warning" },
  aprovado:  { label: "Aprovado",  className: "bg-success/15 text-success" },
  rejeitado: { label: "Rejeitado", className: "bg-destructive/15 text-destructive" },
  cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

export const approvals: ApprovalRequest[] = [
  { id: "ap1", title: "Compra de licenças Figma (10 usuários)", type: "compra", requesterId: "u5", amount: 9800, description: "Renovação anual + 4 novas licenças para o time de design.", createdAt: "2026-06-10", dueDate: "2026-06-20", status: "pendente",
    steps: [
      { id: "st1", order: 1, approverId: "u3", status: "aprovado", decidedAt: "2026-06-11", note: "Justificativa OK" },
      { id: "st2", order: 2, approverId: "u2", status: "pendente" },
    ],
    attachments: [{ id: "a1", name: "cotacao-figma.pdf", size: "84 KB" }],
  },
  { id: "ap2", title: "Aditivo contratual — Sorocaba Fase 2", type: "contrato", requesterId: "u7", amount: 60000, description: "Aditivo para iniciar fase 2 conforme proposta aprovada.", createdAt: "2026-06-12", status: "pendente", relatedClientId: "cli2", relatedProjectId: "p1",
    steps: [
      { id: "st1", order: 1, approverId: "u4", status: "aprovado", decidedAt: "2026-06-13" },
      { id: "st2", order: 2, approverId: "u2", status: "pendente" },
    ],
  },
  { id: "ap3", title: "Férias — 15 dias (Carlos Mendes)", type: "ferias", requesterId: "u5", description: "Período: 22/jul a 05/ago. Substituto: Ana Souza.", createdAt: "2026-06-08", dueDate: "2026-07-10", status: "aprovado",
    steps: [
      { id: "st1", order: 1, approverId: "u3", status: "aprovado", decidedAt: "2026-06-09" },
      { id: "st2", order: 2, approverId: "u2", status: "aprovado", decidedAt: "2026-06-10", note: "Aprovado, boa viagem!" },
    ],
  },
  { id: "ap4", title: "Reembolso — Viagem cliente Vida Plena", type: "despesa", requesterId: "u2", amount: 3450, description: "Passagens + hospedagem reunião presencial RJ.", createdAt: "2026-06-05", status: "aprovado",
    steps: [{ id: "st1", order: 1, approverId: "u4", status: "aprovado", decidedAt: "2026-06-06" }],
    attachments: [{ id: "a1", name: "nfs-hotel.pdf", size: "120 KB" }, { id: "a2", name: "boarding-pass.pdf", size: "42 KB" }],
  },
  { id: "ap5", title: "Horas extras — Time operações (junho)", type: "horas_extras", requesterId: "u3", amount: 4200, description: "32h extras distribuídas em 4 colaboradores para entrega Sorocaba.", createdAt: "2026-06-14", status: "pendente",
    steps: [{ id: "st1", order: 1, approverId: "u2", status: "pendente" }],
  },
  { id: "ap6", title: "Compra de equipamentos audiovisuais", type: "compra", requesterId: "u5", amount: 18500, description: "Câmera + microfone para conteúdo de marketing in-house.", createdAt: "2026-05-28", status: "rejeitado",
    steps: [
      { id: "st1", order: 1, approverId: "u3", status: "aprovado", decidedAt: "2026-05-29" },
      { id: "st2", order: 2, approverId: "u2", status: "rejeitado", decidedAt: "2026-05-30", note: "Adiar para Q3 — orçamento atual já comprometido." },
    ],
  },
  { id: "ap7", title: "Viagem — Visita Smile Express (Curitiba)", type: "viagem", requesterId: "u7", amount: 2800, description: "Apresentação do piloto, 2 dias.", createdAt: "2026-06-13", dueDate: "2026-06-25", status: "pendente", relatedClientId: "cli6",
    steps: [{ id: "st1", order: 1, approverId: "u2", status: "pendente" }],
  },
];
