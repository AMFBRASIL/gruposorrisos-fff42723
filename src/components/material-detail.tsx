import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { brl, clinics, daysUntil, getClinic, getMaterial, transferLabels, useAdvancedStock, useStock, useStockSession } from "@/lib/stock-live";
import { abcClassification, demand } from "@/lib/stock-intelligence";
import type { Material } from "@/lib/stock";
import { ArrowLeftRight, Boxes, CalendarClock, ClipboardList, Package, Pencil, ShieldCheck, Warehouse } from "lucide-react";
import type { LucideIcon, ReactNode } from "react";

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

function Metric({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "warn" | "ok" | "mute" }) {
  const ring = tone === "warn" ? "border-warning/40 bg-warning/5" : tone === "ok" ? "border-success/30 bg-success/5" : tone === "mute" ? "border-border bg-muted/30" : "border-border bg-card";
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${ring}`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1.5 text-xs leading-snug text-muted-foreground">{hint}</div>}
    </div>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-background/80 px-3.5 py-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-sm font-semibold break-words">{value || "—"}</div>
    </div>
  );
}

function Panel({ icon: Icon, title, action, children }: { icon: LucideIcon; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/80 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/80 bg-muted/25 px-4 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
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
  const facts = known ? [
    ["SKU", material.sku || "—"],
    ["Código de barras", material.barcode || "—"],
    ["Marca", material.brand || "—"],
    ["Fabricante", material.manufacturer || "—"],
    ["Fornecedor padrão", material.supplier || "—"],
    ["Unidade", material.unit],
    ["Controle de lote", material.lotControl ? "Sim" : "Não"],
    ["Controle de validade", material.expiryControl ? "Sim" : "Não"],
    ["Certificado (CA)", material.approvalCertificate || "—"],
    ["Validade do CA", dateOf(material.caExpires)],
    ["Registro Anvisa", material.anvisa || "—"],
    ["Política por filial", `${material.min} / ${material.max} ${material.unit}`],
    ["Cadastrado", dateOf(material.createdAt)],
    ["Atualizado", dateOf(material.updatedAt)],
  ] as const : [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 wide-sheet gap-0 flex flex-col overflow-hidden h-[94dvh]">
        <div className="relative border-b border-border bg-gradient-to-br from-muted/50 via-background to-background px-6 py-5 pr-14">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-border bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground">{known ? material.code : "Material"}</span>
                {known && <Badge variant="outline" className={status.className}>{status.label}</Badge>}
                {known && <Badge variant="outline" className="bg-background">Classe {liveClass}</Badge>}
                {known && material.lotControl && <Badge variant="outline" className="bg-background"><ShieldCheck className="mr-1 h-3 w-3" />Lote</Badge>}
              </div>
              <DialogTitle className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{known ? material.name : "Material não encontrado"}</DialogTitle>
              <DialogDescription className="mt-1.5 text-sm">
                {known ? `${material.category} · ${material.manufacturer || material.brand || "Sem fabricante"} · ${material.unit}` : "Este item não está mais no catálogo."}
              </DialogDescription>
            </div>
            {known && session.can("estoque.movimentar") && (
              <Button className="shadow-sm" onClick={() => onEdit(material)}><Pencil className="h-4 w-4 mr-2" />Editar material</Button>
            )}
          </div>
        </div>

        {known && (
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/15 px-5 py-5 sm:px-6 space-y-5">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Metric label="Saldo" value={`${qty} ${material.unit}`} hint={`Mínimo ${min} · máximo ${max}`} tone={qty < min ? "warn" : "ok"} />
              <Metric label="Disponível" value={`${available} ${material.unit}`} hint={reserved ? `${reserved} reservado` : "Nada reservado"} />
              <Metric label="Valor em estoque" value={brl(qty * material.cost)} hint={`Custo ${brl(material.cost)} · médio ${brl(material.averageCost ?? material.cost)}`} />
              <Metric label="Cobertura" value={usage.coverage == null ? "Sem consumo" : `${usage.coverage} dias`} hint={`${usage.consumption} ${material.unit} consumidos em 30 dias`} tone={usage.coverage == null ? "mute" : "default"} />
            </div>

            <div className="grid xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-4">
              <Panel icon={Package} title="Cadastro">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {facts.map(([label, value]) => <FactCard key={label} label={label} value={value} />)}
                </div>
                <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/20 px-3.5 py-3">
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Descrição</div>
                  <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{material.description || "Sem descrição cadastrada."}</p>
                </div>
              </Panel>

              <Panel
                icon={Warehouse}
                title="Estoque por filial"
                action={replenish > 0 ? <Badge variant="outline" className="bg-background">{replenish} a repor</Badge> : undefined}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {rows.map((row) => {
                    const cap = Math.max(material.max, row.qty, 1);
                    const width = Math.min(100, (row.qty / cap) * 100);
                    const rowStatus = situation(row.qty, material.min);
                    const pending = incoming.filter((item) => item.clinicId === row.clinic.id).reduce((sum, item) => sum + item.qty, 0);
                    return (
                      <div key={row.clinic.id} className="rounded-2xl border border-border bg-background p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{row.clinic.name}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{row.clinic.city || row.clinic.kind}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-semibold tabular-nums">{row.qty} <span className="text-xs font-medium text-muted-foreground">{material.unit}</span></div>
                            <Badge variant="outline" className={`mt-1 ${rowStatus.className}`}>{rowStatus.label}</Badge>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                          <div className="rounded-lg bg-muted/40 px-2 py-1.5"><div className="text-muted-foreground">Disponível</div><div className="font-semibold tabular-nums">{row.available}</div></div>
                          <div className="rounded-lg bg-muted/40 px-2 py-1.5"><div className="text-muted-foreground">Reservado</div><div className="font-semibold tabular-nums">{row.reserved}</div></div>
                          <div className="rounded-lg bg-muted/40 px-2 py-1.5"><div className="text-muted-foreground">A caminho</div><div className="font-semibold tabular-nums">{pending}</div></div>
                        </div>
                        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${width}%` }} /></div>
                        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground"><span>Mín. {material.min}</span><span>Máx. {material.max}</span></div>
                      </div>
                    );
                  })}
                  {!rows.length && <p className="text-sm text-muted-foreground col-span-full py-2">Nenhuma filial visível para este usuário.</p>}
                </div>
              </Panel>
            </div>

            <Panel icon={CalendarClock} title="Lotes e validades">
              {lots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{material.lotControl ? "Nenhum lote com saldo." : "Este material não controla lote."}</p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {lots.map((lot) => {
                    const days = daysUntil(lot.expires);
                    const expired = days < 0;
                    const soon = days >= 0 && days <= advanced.alertDays;
                    return (
                      <div key={lot.id} className="rounded-xl border border-border bg-background p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-xs text-muted-foreground">{lot.lot}</div>
                            <div className="mt-1 text-sm font-semibold truncate">{getClinic(lot.clinicId).name}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-base font-semibold tabular-nums">{lot.qty} <span className="text-xs text-muted-foreground">{material.unit}</span></div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Validade {dateOf(lot.expires)}</span>
                          <Badge variant="outline" className={expired ? "bg-destructive/10 text-destructive border-destructive/30" : soon ? "bg-warning/10 text-warning border-warning/30" : "bg-success/10 text-success border-success/30"}>
                            {expired ? `Vencido há ${Math.abs(days)} d` : soon ? `Vence em ${days} d` : `${days} dias`}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <div className="grid xl:grid-cols-2 gap-4">
              <Panel icon={Boxes} title="Movimentações" action={<span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{movements.length}</span>}>
                {movements.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p> : (
                  <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
                    {movements.slice(0, 20).map((item) => (
                      <div key={item.id} className="rounded-xl border border-border bg-background px-3.5 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{item.number} · {item.type === "entrada" ? "Entrada" : item.type === "saida" ? "Saída" : "Transferência"}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground truncate">{item.reason || "Sem motivo"} · {getClinic(item.clinicId).name}{item.toClinicId ? ` → ${getClinic(item.toClinicId).name}` : ""} · {item.user}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold tabular-nums">{item.qty} {material.unit}</div>
                          <div className="text-xs text-muted-foreground">{dateOf(item.date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel icon={ArrowLeftRight} title="Transferências" action={<span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{transfers.length}</span>}>
                {transfers.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma transferência com este material.</p> : (
                  <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
                    {transfers.map((transfer) => {
                      const line = transfer.items.find((item) => item.materialId === materialId);
                      return (
                        <div key={transfer.id} className="rounded-xl border border-border bg-background px-3.5 py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{transfer.number}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground truncate">{getClinic(transfer.fromId).name} → {getClinic(transfer.toId).name}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold tabular-nums">{line?.qty ?? 0} {material.unit}</div>
                            <Badge variant="outline" className="mt-1">{transferLabels[transfer.status]}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </div>

            <div className="grid xl:grid-cols-2 gap-4">
              <Panel icon={ClipboardList} title="Fichas de consumo">
                {recipes.length === 0 ? <p className="text-sm text-muted-foreground">Este material não entra em nenhuma ficha.</p> : (
                  <div className="grid gap-2">
                    {recipes.map((recipe) => {
                      const line = recipe.items.find((item) => item.materialId === materialId);
                      return (
                        <div key={recipe.id} className="rounded-xl border border-border bg-background px-3.5 py-3 flex justify-between gap-3 text-sm">
                          <span className="font-semibold">{recipe.name}</span>
                          <span className="text-muted-foreground tabular-nums">{line?.qty ?? 0} {material.unit} / procedimento</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
              <Panel icon={ClipboardList} title="Contagens e ajustes">
                {counts.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma contagem registrada para este material.</p> : (
                  <div className="grid gap-2">
                    {counts.slice(0, 8).map((item) => (
                      <div key={item.id} className="rounded-xl border border-border bg-background px-3.5 py-3 flex justify-between gap-3 text-sm">
                        <div>
                          <div className="font-semibold">{getClinic(item.input.branchId).name}</div>
                          <div className="text-xs text-muted-foreground">{dateOf(item.at)} · {item.input.user} · {item.status}</div>
                        </div>
                        <div className="text-right tabular-nums text-muted-foreground">{item.baseline[materialId] ?? 0} → {item.input.counts[materialId] ?? 0}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
