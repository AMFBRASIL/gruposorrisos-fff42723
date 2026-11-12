import { describe, it, expect } from "vitest";
import { addMaterial, createTransfer, addLot, getState, balanceOf, materials } from "./stock";

describe("stock wizards rules", () => {
  it("rejects material with max below min", () => {
    expect(addMaterial({ code: "T-1", sku: "", name: "Teste", category: "Outros", brand: "", unit: "un", cost: 1, min: 10, max: 5, lotControl: false })).toBe("Estoque máximo deve ser maior ou igual ao mínimo");
  });
  it("creates material with initial balance", () => {
    expect(addMaterial({ code: "T-2", sku: "", name: "Teste 2", category: "Outros", brand: "", unit: "un", cost: 1, min: 1, max: 5, lotControl: false }, [{ clinicId: "cd", qty: 7 }])).toBeNull();
    const m = materials.find(x => x.code === "T-2")!;
    expect(balanceOf(getState(), m.id, "cd")).toBe(7);
  });
  it("blocks transfer above origin balance", () => {
    const m = materials[0]; const bal = balanceOf(getState(), m.id, "cd");
    expect(createTransfer({ fromId: "cd", toId: "c1", items: [{ materialId: m.id, qty: bal + 1 }] })).toMatch(/Saldo insuficiente/);
  });
  it("blocks transfer to same branch", () => {
    expect(createTransfer({ fromId: "cd", toId: "cd", items: [{ materialId: materials[0].id, qty: 1 }] })).toBe("Origem e destino devem ser diferentes");
  });
  it("rejects lot with zero quantity", () => {
    expect(addLot({ materialId: materials[0].id, clinicId: "cd", lot: "L1", expires: "2027-01-01", qty: 0 })).toBe("Quantidade deve ser maior que zero");
  });
});
