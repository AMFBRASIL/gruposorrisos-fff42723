import type { Balance, Lot, Material, Movement } from './stock';
export const DEMO_TODAY = '2026-11-12';
export const ageDays = (date: string, today = DEMO_TODAY) => Math.floor((Date.parse(today) - Date.parse(date.slice(0, 10))) / 86400000);
export function demand(qty: number, movements: Movement[], today = DEMO_TODAY) {
  const consumption = movements.filter(m => m.type === 'saida' && !/Ajuste|Expedição/.test(m.reason) && ageDays(m.date, today) >= 0 && ageDays(m.date, today) < 30).reduce((a, m) => a + m.qty, 0);
  const daily = consumption / 30;
  return { daily, coverage: daily > 0 ? Math.floor(qty / daily) : null, consumption, idle: consumption === 0 };
}
export function replenishment(min: number, max: number, available: number, incoming: number) { return available + incoming < min ? Math.max(0, max - available - incoming) : 0; }
export function abcClassification(rows: { id: string; value: number }[]) {
  const sorted = [...rows].sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
  const total = sorted.reduce((a, r) => a + r.value, 0); let cumulative = 0;
  return sorted.map(r => { const before = total > 0 ? cumulative / total : 1; cumulative += r.value; return { ...r, class: (before < .8 ? 'A' : before < .95 ? 'B' : 'C') as 'A' | 'B' | 'C', cumulative: total ? cumulative / total * 100 : 100 }; });
}
export function fefo(lots: Lot[], materialId: string, clinicId: string, qty: number, today = DEMO_TODAY) {
  let remaining = qty;
  const allocations: { lotId: string; lot: string; expires: string; qty: number }[] = [];
  for (const l of lots.filter(l => l.materialId === materialId && l.clinicId === clinicId && l.qty > 0 && l.expires >= today).sort((a, b) => a.expires.localeCompare(b.expires) || a.id.localeCompare(b.id))) {
    if (remaining <= 0) break; const take = Math.min(l.qty, remaining); remaining -= take; allocations.push({ lotId: l.id, lot: l.lot, expires: l.expires, qty: take });
  }
  return { allocations, shortage: remaining };
}
export function adjustmentValue(counts: Record<string, number>, balances: Balance[], materials: Material[], branchId: string) {
  return Object.entries(counts).reduce((sum, [id, qty]) => sum + Math.abs(qty - (balances.find(b => b.materialId === id && b.clinicId === branchId)?.qty ?? 0)) * (materials.find(m => m.id === id)?.cost ?? 0), 0);
}
export const needsApproval = (value: number, limit: number) => value > limit;
export function recipeLines(recipe: { materialId: string; qty: number }[], repetitions: number) {
  if (!Number.isInteger(repetitions) || repetitions <= 0 || recipe.length === 0 || recipe.some(i => !Number.isFinite(i.qty) || i.qty <= 0)) return null;
  const merged = new Map<string, number>(); for (const i of recipe) merged.set(i.materialId, (merged.get(i.materialId) ?? 0) + i.qty * repetitions);
  return [...merged].map(([materialId, qty]) => ({ materialId, qty }));
}
export function resolveCode(code: string, materials: Material[]) { const k = code.trim().toLowerCase(); return materials.find(m => [m.code, m.sku, m.id].some(v => v.toLowerCase() === k)); }
