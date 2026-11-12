import { describe, it, expect } from "vitest";
import { addMaterial, createTransfer, addLot, getState, balanceOf, materials } from "./stock";
import { resolveCode } from "./stock-intelligence";

describe("material reference fields", () => {
  const input = { code: "REF-001", sku: "REF-SKU", name: "Luva referência", category: "EPIs", brand: "Marca", unit: "cx", cost: 1, min: 1, max: 5, lotControl: false, barcode: "7891234567890", approvalCertificate: "CA-12345", supplierId: "s3", manufacturer: "Supermax", description: "Luva de proteção" };
  it("requires CA for EPI materials", () => {
    expect(addMaterial({ ...input, approvalCertificate: "" })).toBe("Informe o Certificado de Aprovação (CA) para EPIs");
  });
  it("keeps all additional fields and resolves the barcode", () => {
    expect(addMaterial(input)).toBeNull();
    const saved = materials.find(m => m.code === input.code);
    expect(saved).toMatchObject(input);
    expect(resolveCode("7891234567890", materials)?.id).toBe(saved?.id);
  });
  it("rejects duplicate barcodes", () => {
    expect(addMaterial({ ...input, code: "REF-002" })).toBe("Código de barras já cadastrado");
  });
});

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

import { registerMovements, applyInventory } from "./stock";
describe("multi-item movement and inventory", () => {
  it("rejects the whole batch when one line lacks balance", () => {
    const [a, b] = materials; const before = balanceOf(getState(), a.id, "c1");
    expect(registerMovements([{ type: "saida", reason: "Consumo", materialId: a.id, clinicId: "c1", qty: 1, user: "t" }, { type: "saida", reason: "Consumo", materialId: b.id, clinicId: "c1", qty: 999999, user: "t" }])).toMatch(/Saldo insuficiente/);
    expect(balanceOf(getState(), a.id, "c1")).toBe(before);
  });
  it("inventory sets balance to counted quantity", () => {
    const m = materials[1];
    const rec = applyInventory({ branchId: "c2", scope: "Completo", blind: true, counts: { [m.id]: 3 }, user: "t" });
    expect(balanceOf(getState(), m.id, "c2")).toBe(3);
    expect(rec.counted).toBe(1);
  });
});
