import { describe, it, expect } from "vitest";
import { approveOrder, pickOrder, receiveOrder, shipOrder, submitOrder, cancelOrder, type Order } from "./orders";
import { can, seedErpUsers, seedRoles, seedBranches, visibleBranchIds } from "./erp";

const u = (id: string) => seedErpUsers.find(x => x.id === id)!;
const c = (id: string) => ({ user: u(id), roles: seedRoles, now: "2026-11-11T00:00:00Z" });
const base: Order = { id: "t", number: "T", branchId: "c1", sourceId: "cd", requesterId: "u-maria", priority: "normal", createdAt: "", desiredDate: "2026-11-20", notes: "", status: "rascunho", events: [],
  items: [{ materialId: "m1", requested: 10, approved: 0, picked: 0, shipped: 0, received: 0 }] };
const ok = (r: ReturnType<typeof submitOrder>) => { if (!r.ok) throw new Error(r.error); return r.order; };

describe("acesso por filial", () => {
  it("gerente da Paulista só enxerga a Paulista", () => expect(visibleBranchIds(u("u-maria"), seedRoles, seedBranches)).toEqual(["c1"]));
  it("supervisora vê Paulista e Moema", () => expect(visibleBranchIds(u("u-ana"), seedRoles, seedBranches)).toEqual(["c1", "c2"]));
  it("superadmin vê todas", () => expect(visibleBranchIds(u("u-carlos"), seedRoles, seedBranches)).toHaveLength(seedBranches.length));
  it("gerente da Paulista não aprova pedido de Moema", () => expect(can(u("u-maria"), seedRoles, "pedidos.aprovar", "c2")).toBe(false));
});

describe("fluxo do pedido", () => {
  const sent = ok(submitOrder(base, c("u-maria")));
  it("colaborador não aprova", () => expect(approveOrder(sent, c("u-lucas")).ok).toBe(false));
  it("aprovação não passa do solicitado", () => expect(ok(approveOrder(sent, c("u-maria"), { m1: 50 })).items[0].approved).toBe(10));
  const approved = ok(approveOrder(sent, c("u-maria"), { m1: 6 }));
  it("não separa acima do estoque disponível", () => expect(pickOrder(approved, c("u-joao"), { m1: 6 }, () => 3).ok).toBe(false));
  it("não separa acima do aprovado", () => expect(pickOrder(approved, c("u-joao"), { m1: 7 }, () => 100).ok).toBe(false));
  const picked = ok(pickOrder(approved, c("u-joao"), { m1: 6 }, () => 100));
  const shipped = ok(shipOrder(picked, c("u-joao")));
  it("não expede duas vezes", () => expect(shipOrder(shipped, c("u-joao")).ok).toBe(false));
  it("não recebe acima do expedido", () => expect(receiveOrder(shipped, c("u-maria"), { m1: 7 }).ok).toBe(false));
  it("recebimento parcial e depois total", () => {
    const part = ok(receiveOrder(shipped, c("u-maria"), { m1: 4 }));
    expect(part.status).toBe("recebido_parcial");
    expect(ok(receiveOrder(part, c("u-maria"), { m1: 2 })).status).toBe("concluido");
  });
  it("não cancela em transporte", () => expect(cancelOrder(shipped, c("u-carlos"), "x").ok).toBe(false));
});
