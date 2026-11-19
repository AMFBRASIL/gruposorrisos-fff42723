import { ArrowRight, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';
import { brl, getMaterial, getClinic, balanceOf, materials, type MovementType, useStock } from '@/lib/stock-live';

const volume = (qty: number) => qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export function MovementReview({ stock, type, clinicId, toClinicId, items, reason, document }: {
  stock: ReturnType<typeof useStock>; type: MovementType; clinicId: string; toClinicId: string;
  items: { materialId: string; qty: number }[]; reason: string; document: string;
}) {
  const rows = items.map(i => {
    const material = getMaterial(i.materialId);
    const before = balanceOf(stock, i.materialId, clinicId);
    const after = before + (type === 'entrada' ? i.qty : -i.qty);
    const destination = balanceOf(stock, i.materialId, toClinicId);
    return { ...i, material, before, after, destination, value: i.qty * material.cost };
  });
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const groupedVolumes = rows.reduce<Record<string, number>>((sum, r) => ({ ...sum, [r.material.unit]: (sum[r.material.unit] || 0) + r.qty }), {});
  const branchValue = (id: string) => materials.reduce((sum, m) => sum + balanceOf(stock, m.id, id) * m.cost, 0);
  const branchBefore = branchValue(clinicId);
  const branchAfter = branchBefore + (type === 'entrada' ? total : -total);
  const Icon = type === 'entrada' ? ArrowDownToLine : type === 'saida' ? ArrowUpFromLine : ArrowLeftRight;
  const label = type === 'entrada' ? 'Entrada' : type === 'saida' ? 'Saída' : 'Transferência';

  return <div className="space-y-6">
    <div className="flex items-start gap-3 border-b border-border pb-4">
      <div className="rounded-lg bg-primary/10 text-primary p-3"><Icon className="h-5 w-5" /></div>
      <div className="min-w-0"><h3 className="font-semibold">{label} · {getClinic(clinicId).name}</h3><p className="text-sm text-muted-foreground">{reason}{document ? ` · Documento ${document}` : ''}</p>{type === 'transferencia' && <p className="text-sm text-muted-foreground">Destino: {getClinic(toClinicId).name}</p>}</div>
    </div>
    <div className="grid sm:grid-cols-2 gap-4">
      <div><p className="text-xs text-muted-foreground">Valor da movimentação</p><p className="text-2xl font-semibold mt-1">{brl(total)}</p><p className="text-xs text-muted-foreground mt-1">{items.length} materiais · custo de cadastro</p></div>
      <div><p className="text-xs text-muted-foreground">Volumes movimentados</p><div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">{Object.entries(groupedVolumes).map(([unit, qty]) => <span className="font-semibold" key={unit}>{volume(qty)} <span className="text-sm font-normal text-muted-foreground">{unit}</span></span>)}</div></div>
    </div>
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Valor total do estoque da filial</h3>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-muted/40 rounded-lg p-4">
        <div><p className="text-xs text-muted-foreground">Atual · {getClinic(clinicId).name}</p><p className="font-semibold mt-1 break-words">{brl(branchBefore)}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Após {label.toLowerCase()}</p><p className={`font-semibold mt-1 break-words ${type === 'entrada' ? 'text-success' : 'text-warning'}`}>{brl(branchAfter)}</p></div>
      </div>
      {type === 'transferencia' && <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-muted/40 rounded-lg p-4"><div><p className="text-xs text-muted-foreground">Atual · {getClinic(toClinicId).name}</p><p className="font-semibold mt-1">{brl(branchValue(toClinicId))}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Após recebimento</p><p className="font-semibold text-success mt-1">{brl(branchValue(toClinicId) + total)}</p></div></div>}
    </section>
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Conferência por material</h3>
      <div className="divide-y divide-border border-y border-border">{rows.map(r => <div key={r.materialId} className="py-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-semibold">{r.material.name}</h4><p className="text-xs text-muted-foreground">{r.material.code} · {brl(r.material.cost)} / {r.material.unit}</p></div><div className="text-right"><p className={`text-sm font-semibold ${type === 'entrada' ? 'text-success' : 'text-warning'}`}>{type === 'entrada' ? '+' : '−'}{volume(r.qty)} {r.material.unit}</p><p className="text-xs text-muted-foreground">{brl(r.value)}</p></div></div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Estoque atual</p><p className="font-semibold mt-1">{volume(r.before)} {r.material.unit}</p><p className="text-xs text-muted-foreground">{brl(r.before * r.material.cost)}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Estoque após movimentação</p><p className={`font-semibold mt-1 ${r.after < r.material.min ? 'text-warning' : 'text-success'}`}>{volume(r.after)} {r.material.unit}</p><p className="text-xs text-muted-foreground">{brl(r.after * r.material.cost)}</p></div></div>
        {r.after < r.material.min && <p className="text-xs text-warning">Saldo projetado abaixo do mínimo de {volume(r.material.min)} {r.material.unit}.</p>}
        {type === 'transferencia' && <div className="text-xs text-muted-foreground border-t border-border pt-2">Destino · {getClinic(toClinicId).name}: {volume(r.destination)} → {volume(r.destination + r.qty)} {r.material.unit} · {brl(r.destination * r.material.cost)} → {brl((r.destination + r.qty) * r.material.cost)}</div>}
      </div>)}</div>
    </section>
  </div>;
}