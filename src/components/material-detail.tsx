import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { brl, clinics, daysUntil, getClinic, getMaterial, transferLabels, useAdvancedStock, useStock, useStockSession } from "@/lib/stock-live";
import { abcClassification, demand } from "@/lib/stock-intelligence";
import type { Material } from "@/lib/stock";
import { ArrowLeftRight, Boxes, CalendarClock, Package, Pencil, Warehouse } from "lucide-react";

const dateOf = (value?: string) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const situation = (qty: number, min: number) => qty === 0
  ? { label: "Sem estoque", className: "bg-destructive/10 text-destructive border-destructive/30" }
  : qty < min
    ? { label: "Abaixo do mínimo", className: "bg-warning/10 text-warning border-warning/30" }
    : { label: "Normal", className: "bg-success/10 text-success border-success/30" };

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium break-words">{value || "—"}</div>
    </div>
  );
}

export function MaterialDetail({ materialId, onClose, onEdit }: { materialId: string; onClose: () => void; onEdit: (material: Material) => void }) {
  const stock = useStock();
  const advanced = useAdvancedStock();
  const session = useStockSession();
  const material = getMaterial(materialId);
  const known = material.code !== "—";
  const places = clinics.filter((clinic) => session.visible.includes(clinic.id));
  const rows = places.map((clinic) => {
    const balance = stock.balances.find((item) => item.materialId === materialId && item.clinicId === clinic.id);
    const qty = balance?.qty ?? 0;
    const reserved = balance?.reserved ?? 0;
    return { clinic, qty, reserved, available: Math.max(0, qty - reserved) };
  });
  const qty = rows.reduce((sum, row) => sum + row.qty, 0);
  const reserved = rows.reduce((sum, row) => sum + row.reserved, 0);
  const available = rows.reduce((sum, row) => sum + row.available, 0);
  const min = material.min * Math.max(places.length, 1);
  const max = material.max * Math.max(places.length, 1);
  const status = situation(qty, min);
  const today = new Date().toISOString().slice(0, 10);
  const movements = stock.movements.filter((item) => item.materialId === materialId);
  const usage = demand(available, movements, today);
  const liveClass = (() => {
    if (!known) return "—";
    if (material.abcClass) return material.abcClass;
    const values = places.length
      ? [{ id: material.id, value: qty * material.cost }]
      : [];
    const others = stock.balances.reduce<Record<string, number>>((map, row) => {
      if (row.materialId === material.id) return map;
      map[row.materialId] = (map[row.materialId] ?? 0) + row.qty * (getMaterial(row.materialId).cost || 0);
      return map;
    }, {});
    const rowsForClass = [
      { id: material.id, value: qty * material.cost },
      ...Object.entries(others).map(([id, value]) => ({ id, value })),
    ];
    return abcClassification(rowsForClass.length ? rowsForClass : values).find((row) => row.id === material.id)?.class ?? "—";
  })();

  const lots = stock.lots.filter((lot) => lot.materialId === materialId && lot.qty > 0).sort((a, b) => a.expires.localeCompare(b.expires) || a.lot.localeCompare(b.lot));
  const transfers = stock.transfers.filter((transfer) => transfer.items.some((item) => item.materialId === materialId));
  const recipes = advanced.recipes.filter((recipe) => recipe.items.some((item) => item.materialId === materialId));
  const incoming = advanced.incoming.filter((item) => item.materialId === materialId);
  const counts = advanced.adjustments.filter((item) => item.input.counts[materialId] != null || item.baseline[materialId] != null);
  const replenish = incoming.reduce((sum, item) => sum + item.qty, 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 gap-0 flex flex-col h-[90dvh] overflow-hidden">
        <div className="border-b border-border px-6 py-5 pr-14">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{known ? material.code : "Material"}</span>
                {known && <Badge variant="outline" className={status.className}>{status.label}</Badge>}
                {known && <Badge variant="outline">Classe {liveClass}</Badge>}
              </div>
              <DialogTitle className="mt-2 text-2xl font-semibold tracking-tight">{known ? material.name : "Material não encontrado"}</DialogTitle>
              <DialogDescription className="mt-1">
                {known ? `${material.category} · ${material.manufacturer || material.brand || "Sem fabricante"} · ${material.unit}` : "Este item não está mais no catálogo."}
              </DialogDescription>
            </div>
            {known && session.can("estoque.movimentar") && (
              <Button onClick={() => onEdit(material)}><Pencil className="h-4 w-4 mr-2" />Editar material</Button>
            )}
          </div>
        </div>
        {known && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Metric label="Saldo" value={`${qty} ${material.unit}`} hint={`Mínimo ${min} · máximo ${max}`} />
              <Metric label="Disponível" value={`${available} ${material.unit}`} hint={reserved ? `${reserved} reservado` : "Nada reservado"} />
              <Metric label="Valor em estoque" value={brl(qty * material.cost)} hint={`Custo ${brl(material.cost)} · médio ${brl(material.averageCost ?? material.cost)}`} />
              <Metric label="Cobertura" value={usage.coverage == null ? "Sem consumo" : `${usage.coverage} dias`} hint={`${usage.consumption} ${material.unit} consumidos em 30 dias`} />
            </div>

            <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4">
              <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2 font-semibold"><Package className="h-4 w-4 text-primary" />Cadastro</div>
                <div className="grid grid-cols-2 gap-4">
                  <Fact label="SKU" value={material.sku || "—"} />
                  <Fact label="Código de barras" value={material.barcode || "—"} />
                  <Fact label="Marca" value={material.brand || "—"} />
                  <Fact label="Fabricante" value={material.manufacturer || "—"} />
                  <Fact label="Fornecedor padrão" value={material.supplier || "—"} />
                  <Fact label="Unidade" value={material.unit} />
                  <Fact label="Controle de lote" value={material.lotControl ? "Sim" : "Não"} />
                  <Fact label="Controle de validade" value={material.expiryControl ? "Sim" : "Não"} />
                  <Fact label="Certificado (CA)" value={material.approvalCertificate || "—"} />
                  <Fact label="Validade do CA" value={dateOf(material.caExpires)} />
                  <Fact label="Registro Anvisa" value={material.anvisa || "—"} />
                  <Fact label="Política por filial" value={`${material.min} / ${material.max} ${material.unit}`} />
                  <Fact label="Cadastrado" value={dateOf(material.createdAt)} />
                  <Fact label="Atualizado" value={dateOf(material.updatedAt)} />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Descrição</div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{material.description || "Sem descrição cadastrada."}</p>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold"><Warehouse className="h-4 w-4 text-primary" />Estoque por filial</div>
                  {replenish > 0 && <Badge variant="outline">{replenish} a repor</Badge>}
                </div>
                <div className="divide-y divide-border">
                  {rows.map((row) => {
                    const cap = Math.max(material.max, row.qty, 1);
                    const width = Math.min(100, (row.qty / cap) * 100);
                    const rowStatus = situation(row.qty, material.min);
                    const pending = incoming.filter((item) => item.clinicId === row.clinic.id).reduce((sum, item) => sum + item.qty, 0);
                    return (
                      <div key={row.clinic.id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{row.clinic.name}</div>
                            <div className="text-xs text-muted-foreground">{row.clinic.city || row.clinic.kind} · disponível {row.available} · reservado {row.reserved}{pending ? ` · a caminho ${pending}` : ""}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{row.qty} {material.unit}</div>
                            <Badge variant="outline" className={`mt-1 ${rowStatus.className}`}>{rowStatus.label}</Badge>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${width}%` }} /></div>
                      </div>
                    );
                  })}
                  {!rows.length && <p className="text-sm text-muted-foreground py-4">Nenhuma filial visível para este usuário.</p>}
                </div>
              </section>
            </div>

            <section className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 font-semibold border-b border-border"><CalendarClock className="h-4 w-4 text-primary" />Lotes e validades</div>
              {lots.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">{material.lotControl ? "Nenhum lote com saldo." : "Este material não controla lote."}</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide"><tr>{["Lote", "Filial", "Quantidade", "Validade", "Situação"].map((head) => <th key={head} className="text-left font-medium px-4 py-3">{head}</th>)}</tr></thead>
                    <tbody className="divide-y divide-border">
                      {lots.map((lot) => {
                        const days = daysUntil(lot.expires);
                        const expired = days < 0;
                        const soon = days >= 0 && days <= advanced.alertDays;
                        return (
                          <tr key={lot.id}>
                            <td className="px-4 py-3 font-mono text-xs">{lot.lot}</td>
                            <td className="px-4 py-3">{getClinic(lot.clinicId).name}</td>
                            <td className="px-4 py-3 font-semibold">{lot.qty} {material.unit}</td>
                            <td className="px-4 py-3">{dateOf(lot.expires)}</td>
                            <td className="px-4 py-3"><Badge variant="outline" className={expired ? "bg-destructive/10 text-destructive border-destructive/30" : soon ? "bg-warning/10 text-warning border-warning/30" : "bg-success/10 text-success border-success/30"}>{expired ? `Vencido há ${Math.abs(days)} dias` : soon ? `Vence em ${days} dias` : `${days} dias`}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="grid xl:grid-cols-2 gap-4">
              <section className="rounded-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border"><div className="flex items-center gap-2 font-semibold"><Boxes className="h-4 w-4 text-primary" />Movimentações</div><span className="text-xs text-muted-foreground">{movements.length}</span></div>
                {movements.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma movimentação registrada.</p> : (
                  <div className="divide-y divide-border max-h-80 overflow-y-auto">
                    {movements.slice(0, 20).map((item) => (
                      <div key={item.id} className="px-5 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{item.number} · {item.type === "entrada" ? "Entrada" : item.type === "saida" ? "Saída" : "Transferência"}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.reason || "Sem motivo"} · {getClinic(item.clinicId).name}{item.toClinicId ? ` → ${getClinic(item.toClinicId).name}` : ""} · {item.user}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold">{item.qty} {material.unit}</div>
                          <div className="text-xs text-muted-foreground">{dateOf(item.date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border"><div className="flex items-center gap-2 font-semibold"><ArrowLeftRight className="h-4 w-4 text-primary" />Transferências</div><span className="text-xs text-muted-foreground">{transfers.length}</span></div>
                {transfers.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma transferência com este material.</p> : (
                  <div className="divide-y divide-border max-h-80 overflow-y-auto">
                    {transfers.map((transfer) => {
                      const line = transfer.items.find((item) => item.materialId === materialId);
                      return (
                        <div key={transfer.id} className="px-5 py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{transfer.number}</div>
                            <div className="text-xs text-muted-foreground truncate">{getClinic(transfer.fromId).name} → {getClinic(transfer.toId).name}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold">{line?.qty ?? 0} {material.unit}</div>
                            <Badge variant="outline" className="mt-1">{transferLabels[transfer.status]}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <div className="grid xl:grid-cols-2 gap-4">
              <section className="rounded-xl border border-border p-5">
                <div className="font-semibold">Fichas de consumo</div>
                {recipes.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Este material não entra em nenhuma ficha.</p> : (
                  <div className="mt-3 divide-y divide-border">
                    {recipes.map((recipe) => {
                      const line = recipe.items.find((item) => item.materialId === materialId);
                      return <div key={recipe.id} className="py-3 flex justify-between gap-3 text-sm"><span className="font-medium">{recipe.name}</span><span className="text-muted-foreground">{line?.qty ?? 0} {material.unit} / procedimento</span></div>;
                    })}
                  </div>
                )}
              </section>
              <section className="rounded-xl border border-border p-5">
                <div className="font-semibold">Contagens e ajustes</div>
                {counts.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nenhuma contagem registrada para este material.</p> : (
                  <div className="mt-3 divide-y divide-border">
                    {counts.slice(0, 8).map((item) => (
                      <div key={item.id} className="py-3 flex justify-between gap-3 text-sm">
                        <div>
                          <div className="font-medium">{getClinic(item.input.branchId).name}</div>
                          <div className="text-xs text-muted-foreground">{dateOf(item.at)} · {item.input.user} · {item.status}</div>
                        </div>
                        <div className="text-right text-muted-foreground">{item.baseline[materialId] ?? 0} → {item.input.counts[materialId] ?? 0}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
