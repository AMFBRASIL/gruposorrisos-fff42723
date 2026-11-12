import { useSyncExternalStore } from 'react';
import { can, currentUser, getErp, type ErpUser, type ErpRole } from './erp';

export type ApprovalStep = { id: string; name: string; assigneeType: 'user' | 'role'; assigneeId: string; hours: number; requireNote: boolean };
export type Workflow = { name: string; steps: ApprovalStep[]; index: number; startedAt: string; decisions: { stepId: string; userId: string; at: string; note: string }[] };
export type WorkflowEvent = { at: string; userId: string; action: string; note?: string };
export type WorkflowTemplate = { name: string; steps: ApprovalStep[] };
export type WorkflowKind = 'cd' | 'supplier';
const initial = (kind: WorkflowKind): WorkflowTemplate => ({ name: kind === 'cd' ? 'Aprovação de materiais' : 'Conferência de compra', steps: [{ id: 'approval', name: kind === 'cd' ? 'Aprovação da filial' : 'Conferência de Compras', assigneeType: 'role', assigneeId: 'superadmin', hours: 48, requireNote: false }] });
let templates: Record<WorkflowKind, WorkflowTemplate> = { cd: initial('cd'), supplier: initial('supplier') };
const listeners = new Set<() => void>();
export const useWorkflowTemplates = () => useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => templates, () => templates);
export function validateTemplate(template: WorkflowTemplate, users: ErpUser[], roles: ErpRole[]): string | null {
  if (!template.name.trim() || !template.steps.length) return 'Informe o nome do fluxo e ao menos uma etapa';
  if (new Set(template.steps.map(s => s.id)).size !== template.steps.length) return 'Etapas duplicadas';
  for (const step of template.steps) {
    if (!step.name.trim() || !Number.isFinite(step.hours) || step.hours <= 0) return 'Cada etapa precisa de nome e prazo maior que zero';
    if (step.assigneeType === 'user' ? !users.some(u => u.id === step.assigneeId) : !roles.some(r => r.id === step.assigneeId)) return 'Selecione um responsável válido';
  }
  return null;
}
export function saveWorkflowTemplate(kind: WorkflowKind, template: WorkflowTemplate) {
  if (!can(currentUser(), getErp().roles, 'usuarios.gerenciar')) return 'Sem permissão para configurar fluxos';
  const error = validateTemplate(template, getErp().users, getErp().roles); if (error) return error;
  templates = { ...templates, [kind]: { name: template.name.trim(), steps: template.steps.map(s => ({ ...s, name: s.name.trim() })) } };
  listeners.forEach(l => l()); return null;
}
export function snapshotWorkflow(kind: WorkflowKind, now = new Date().toISOString()): Workflow {
  const template = templates[kind];
  return { name: template.name, steps: template.steps.map(s => ({ ...s })), index: 0, startedAt: now, decisions: [] };
}
export function workflowAssignee(step: ApprovalStep, user: ErpUser, roles: ErpRole[], branchId: string) {
  if (step.assigneeType === 'user') return step.assigneeId === user.id;
  return user.memberships.some(m => m.roleId === step.assigneeId && (m.branchId === branchId || roles.find(r => r.id === m.roleId)?.scope === 'all'));
}
export function approveWorkflow(workflow: Workflow, user: ErpUser, roles: ErpRole[], branchId: string, note: string, now = new Date().toISOString()): { workflow: Workflow } | { error: string } {
  const step = workflow.steps[workflow.index];
  if (!step) return { error: 'Todas as etapas já foram aprovadas' };
  if (!workflowAssignee(step, user, roles, branchId)) return { error: 'Somente o responsável da etapa pode aprovar' };
  if (step.requireNote && !note.trim()) return { error: 'Esta etapa exige uma observação' };
  return { workflow: { ...workflow, index: workflow.index + 1, startedAt: now, decisions: [...workflow.decisions, { stepId: step.id, userId: user.id, at: now, note: note.trim() }] } };
}
export function resetWorkflow(workflow: Workflow): Workflow {
  return { ...workflow, index: 0, startedAt: new Date().toISOString(), decisions: [] };
}
export function commentEvent(note: string, userId: string, now = new Date().toISOString()): WorkflowEvent | null {
  return note.trim() && note.length <= 2000 ? { at: now, userId, action: 'Observação adicionada', note: note.trim() } : null;
}