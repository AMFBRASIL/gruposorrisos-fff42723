import { actions, createRequisition, saveDraft } from "@/lib/procurement-live";
import { createRestock } from "@/lib/stock-live";

const running = new Set<string>();

const localDate = (offset = 0) => {
  const now = new Date();
  now.setDate(now.getDate() + offset);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2,"0")}`;
};

export async function runResupply(branchId: string, channel: string, items: { materialId: string; qty: number }[]) {
  const key = `${branchId}:${channel}`;
  if (running.has(key)) return "O ressuprimento desta unidade já está sendo gerado.";
  if (!items.length) return "Não há material abaixo do mínimo.";
  running.add(key);
  try {
    if (channel === "compra") {
      const error = await createRequisition(branchId, items.map((item) => ({ materialId: item.materialId, qty: item.qty })));
      if (error) return error;
    } else {
      const draft = await saveDraft({
        branchId,
        priority: "normal",
        desiredDate: localDate(7),
        notes: "Ressuprimento · completar até o máximo",
        items: items.map((item) => ({ materialId: item.materialId, requested: item.qty })),
      });
      if (!draft.ok) return draft.error;
      const submitted = await actions.submit(draft.order.id);
      if (submitted) return `Pedido ${draft.order.number} foi criado, mas não entrou em aprovação. ${submitted}`;
    }
    return createRestock(branchId, channel);
  } finally {
    running.delete(key);
  }
}
