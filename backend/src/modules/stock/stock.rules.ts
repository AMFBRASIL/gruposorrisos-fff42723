export type TransferStatus = "solicitada" | "aprovada" | "separacao" | "transito" | "recebida" | "concluida";

const NEXT: Record<string, TransferStatus | undefined> = {
  solicitada: "aprovada",
  aprovada: "separacao",
  separacao: "transito",
  transito: "recebida",
  recebida: "concluida",
};

export function nextTransferStatus(status: string): TransferStatus | null {
  return NEXT[status] ?? null;
}

export function roundQty(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Quanto repor para chegar ao máximo, só quando disponível + a caminho fica abaixo do mínimo. */
export function replenishmentQty(min: number, max: number, available: number, incoming: number) {
  if (available + incoming >= min) return 0;
  return roundQty(Math.max(0, max - available - incoming));
}

export function needsApproval(value: number, limit: number) {
  return value > limit;
}

export type StockBucket = { id: string; qty: number; lotId: string | null; expires: string | null };

/** Distribui uma saída: lote controlado só usa validades futuras (FEFO); o restante usa o saldo sem lote e depois os lotes. */
export function allocateIssue(buckets: StockBucket[], qty: number, lotControl: boolean, today: string) {
  const need = roundQty(qty);
  if (!(need > 0)) return { error: "Quantidade deve ser maior que zero" as const, allocations: [] };
  const usable = lotControl
    ? buckets.filter((bucket) => bucket.lotId && bucket.expires && bucket.expires >= today && bucket.qty > 0)
    : [...buckets.filter((bucket) => !bucket.lotId && bucket.qty > 0), ...buckets.filter((bucket) => bucket.lotId && bucket.qty > 0)];
  usable.sort((a, b) => (a.expires ?? "9999-99-99").localeCompare(b.expires ?? "9999-99-99") || a.id.localeCompare(b.id));
  const available = roundQty(usable.reduce((sum, bucket) => sum + bucket.qty, 0));
  if (available + 0.0001 < need) {
    return { error: (lotControl ? "Lotes válidos insuficientes" : "Saldo insuficiente") as string, allocations: [] };
  }
  let remaining = need;
  const allocations: { id: string; lotId: string | null; qty: number; before: number; after: number }[] = [];
  for (const bucket of usable) {
    if (remaining <= 0) break;
    const take = roundQty(Math.min(bucket.qty, remaining));
    if (take <= 0) continue;
    allocations.push({ id: bucket.id, lotId: bucket.lotId, qty: take, before: bucket.qty, after: roundQty(bucket.qty - take) });
    remaining = roundQty(remaining - take);
  }
  return { error: null, allocations };
}
