import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocateIssue, needsApproval, nextTransferStatus, replenishmentQty } from "./stock.rules.js";

describe("stock rules", () => {
  it("avança a transferência uma etapa por vez", () => {
    assert.equal(nextTransferStatus("solicitada"), "aprovada");
    assert.equal(nextTransferStatus("separacao"), "transito");
    assert.equal(nextTransferStatus("concluida"), null);
  });

  it("repõe só abaixo do mínimo e respeita o que já está a caminho", () => {
    assert.equal(replenishmentQty(10, 50, 4, 3), 43);
    assert.equal(replenishmentQty(10, 50, 4, 6), 0);
  });

  it("pede aprovação somente acima do limite", () => {
    assert.equal(needsApproval(501, 500), true);
    assert.equal(needsApproval(500, 500), false);
  });

  it("consome o lote que vence primeiro e recusa saldo vencido", () => {
    const result = allocateIssue(
      [
        { id: "2", qty: 8, lotId: "b", expires: "2027-01-01" },
        { id: "9", qty: 99, lotId: "x", expires: "2026-01-01" },
        { id: "1", qty: 3, lotId: "a", expires: "2026-12-01" },
      ],
      5,
      true,
      "2026-11-14",
    );
    assert.equal(result.error, null);
    assert.deepEqual(result.allocations.map((row) => [row.lotId, row.qty]), [["a", 3], ["b", 2]]);
  });

  it("recusa saída maior que o saldo", () => {
    const result = allocateIssue([{ id: "1", qty: 2, lotId: null, expires: null }], 3, false, "2026-11-14");
    assert.match(result.error ?? "", /insuficiente/i);
  });
});
