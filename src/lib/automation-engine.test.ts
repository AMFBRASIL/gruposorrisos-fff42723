import { describe, expect, it } from "vitest";
import { matchesRule, planAutomation, planDomain, ruleMatches } from "./automation-engine";
import { procurementEvent, stockEvent } from "./automation-catalog";
import type { AutomationRule, Task } from "./mock-data";

const task = (patch: Partial<Task> = {}): Task => ({
  id: "t1", title: "Conferir estoque", description: "", projectId: "p", assigneeId: "u", participantIds: [], department: "Compras", tags: [],
  priority: "normal", status: "todo", createdAt: "2026-11-01", startDate: "2026-11-01", dueDate: "2026-11-10",
  checklist: [], comments: [], attachments: [], estimatedHours: 1, loggedHours: 0, ...patch,
});

const rule = (patch: Partial<AutomationRule>): AutomationRule => ({
  id: "a1", name: "Regra", description: "", enabled: true, trigger: "overdue", triggerConfig: { days: "0" },
  conditions: [], actions: [{ type: "notify", payload: {} }], runs: 0, createdAt: "2026-11-01", color: "#000", ...patch,
});

describe("automação", () => {
  it("dispara atraso e prazo próximo na janela certa", () => {
    expect(ruleMatches(rule({}), { kind: "schedule", task: task(), today: "2026-11-18" })).toBe(true);
    expect(ruleMatches(rule({}), { kind: "schedule", task: task({ dueDate: "2026-11-18" }), today: "2026-11-18" })).toBe(false);
    expect(ruleMatches(rule({ trigger: "due_soon", triggerConfig: { days: "2" } }), { kind: "schedule", task: task({ dueDate: "2026-11-20" }), today: "2026-11-18" })).toBe(true);
    expect(ruleMatches(rule({ trigger: "due_soon", triggerConfig: { days: "2" } }), { kind: "schedule", task: task({ dueDate: "2026-11-22" }), today: "2026-11-18" })).toBe(false);
    expect(ruleMatches(rule({}), { kind: "schedule", task: task({ status: "concluido" }), today: "2026-11-18" })).toBe(false);
  });

  it("respeita de/para e condição de prioridade", () => {
    const change = rule({ trigger: "status_change", triggerConfig: { from: "todo", to: "dev" }, conditions: [{ field: "priority", op: "eq", value: "alta" }] });
    expect(ruleMatches(change, { kind: "status_change", task: task({ priority: "alta" }), from: "todo", to: "dev" })).toBe(true);
    expect(ruleMatches(change, { kind: "status_change", task: task({ priority: "alta" }), from: "todo", to: "analise" })).toBe(false);
    expect(ruleMatches(change, { kind: "status_change", task: task(), from: "todo", to: "dev" })).toBe(false);
  });

  it("planeja aviso, status e comentário sem perder os anteriores", () => {
    const current = task({ comments: [{ id: "c0", userId: "u", text: "oi", at: "2026-11-01T00:00:00.000Z" }] });
    const planned = planAutomation(rule({ actions: [{ type: "notify", payload: {} }, { type: "move_status", payload: { to: "analise" } }] }), current, "2026-11-18T12:00:00.000Z");
    expect(planned.patch.status).toBe("analise");
    expect(planned.patch.comments).toHaveLength(2);
    expect(planned.summary).toContain("aviso");
    expect(planned.spawn).toBeNull();
  });

  it("separa módulo e transforma evento de pedido em tarefa", () => {
    const late = rule({});
    expect(matchesRule(late, { module: "pedidos", event: "order_shipped", title: "PED-1", ref: "1" })).toBe(false);
    const shipped = rule({ module: "pedidos", trigger: "order_shipped", actions: [{ type: "create_task", payload: { title: "Conferir entrega" } }] });
    expect(matchesRule(shipped, { module: "pedidos", event: "order_shipped", title: "PED-1", ref: "1" })).toBe(true);
    expect(planDomain(shipped, { module: "pedidos", event: "order_shipped", title: "PED-1", ref: "1" }).spawn?.title).toBe("Conferir entrega");
    expect(procurementEvent("/api/procurement/orders/abc/ship")).toEqual({ module: "pedidos", event: "order_shipped" });
    expect(stockEvent("/api/stock/movements")).toEqual({ module: "estoque", event: "movement_registered" });
    expect(procurementEvent("/api/procurement/comments")).toBeNull();
  });
});
