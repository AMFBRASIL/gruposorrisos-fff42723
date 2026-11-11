import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStock, materials, clinics, getMaterial, getClinic, registerMovement, balanceOf, type MovementType } from "@/lib/stock";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/movimentacoes")({
  head: () => ({ meta: [
    { title: "Movimentações de Estoque | Grupo Sorrisos" },
    { name: "description", content: "Entradas, saídas e transferências de materiais entre as clínicas do Grupo Sorrisos." },
    { property: "og:title", content: "Movimentações de Estoque | Grupo Sorrisos" },
    { property: "og:description", content: "Entradas, saídas e transferências de materiais." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: MovPage,
});

const typeMeta: Record<MovementType, { label: string; icon: typeof Plus; cls: string; reasons: string[] }> = {
  entrada: { label: "Entrada", icon: ArrowDownToLine, cls: "bg-success/10 text-success border-success/30", reasons: ["Compra", "Devolução", "Ajuste autorizado", "Saldo inicial"] },
  saida: { label: "Saída", icon: ArrowUpFromLine, cls: "bg-destructive/10 text-destructive border-destructive/30", reasons: ["Consumo", "Perda", "Descarte", "Ajuste autorizado"] },
  transferencia: { label: "Transferência", icon: ArrowLeftRight, cls: "bg-info/10 text-info border-info/30", reasons: ["Entre clínicas", "Entre depósitos"] },
};

function MovPage() {
  const s = useStock();
  const [filter, setFilter] = useState<MovementType | "todas">("todas");
  const [open, setOpen] = useState(false);
  const rows = s.movements.filter(mv => filter === "todas" || mv.type === filter);
  return (
    <AppShell title="Movimentações" subtitle="Entradas, saídas e transferências" primaryAction={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Movimentação</Button>}>
      <div className="p-4 md:p-8 space-y-4">
        <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
          {(["todas", "entrada", "saida", "transferencia"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 h-8 rounded-md text-xs transition-colors ${filter === f ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>{f === "todas" ? "Todas" : typeMeta[f].label}</button>
          ))}
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>{["Número", "Tipo", "Material", "Origem", "Destino", "Qtd", "Motivo", "Responsável", "Data"].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(mv => { const t = typeMeta[mv.type]; return (
                <tr key={mv.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{mv.number}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={t.cls}>{t.label}</Badge></td>
                  <td className="px-4 py-3 font-medium">{getMaterial(mv.materialId).name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{getClinic(mv.clinicId).name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{mv.toClinicId ? getClinic(mv.toClinicId).name : "—"}</td>
                  <td className="px-4 py-3 font-semibold">{mv.qty}</td>
                  <td className="px-4 py-3">{mv.reason}</td>
                  <td className="px-4 py-3">{mv.user}</td>
                  <td className="px-4 py-3 text-muted-foreground">{mv.date.split("-").reverse().join("/")}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </Card>
      </div>
      <NewMovement open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

function NewMovement({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const s = useStock();
  const [type, setType] = useState<MovementType>("entrada");
  const [materialId, setMaterial] = useState(materials[0].id);
  const [clinicId, setClinic] = useState("cd");
  const [toClinicId, setTo] = useState("c1");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("Compra");
  const submit = () => {
    const err = registerMovement({ type, materialId, clinicId, toClinicId: type === "transferencia" ? toClinicId : undefined, qty, reason, user: "Você" });
    if (err) return toast.error(err);
    toast.success("Movimentação registrada");
    onOpenChange(false);
  };
  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(typeMeta) as MovementType[]).map(k => { const t = typeMeta[k]; const Icon = t.icon; return (
            <button key={k} onClick={() => { setType(k); setReason(t.reasons[0]); }} className={`rounded-lg border p-4 text-left transition-all ${type === k ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}>
              <Icon className="h-5 w-5 mb-2 text-primary" /><div className="font-medium text-sm">{t.label}</div>
            </button>
          ); })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label>Material</Label><select className={sel} value={materialId} onChange={e => setMaterial(e.target.value)}>{materials.map(mt => <option key={mt.id} value={mt.id}>{mt.name}</option>)}</select></div>
          <div className="space-y-1"><Label>{type === "transferencia" ? "Origem" : "Clínica"}</Label><select className={sel} value={clinicId} onChange={e => setClinic(e.target.value)}>{clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <div className="text-xs text-muted-foreground">Saldo atual: {balanceOf(s, materialId, clinicId)}</div></div>
          {type === "transferencia" ? (
            <div className="space-y-1"><Label>Destino</Label><select className={sel} value={toClinicId} onChange={e => setTo(e.target.value)}>{clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          ) : (
            <div className="space-y-1"><Label>Motivo</Label><select className={sel} value={reason} onChange={e => setReason(e.target.value)}>{typeMeta[type].reasons.map(r => <option key={r}>{r}</option>)}</select></div>
          )}
          <div className="space-y-1"><Label>Quantidade ({getMaterial(materialId).unit})</Label><Input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} /></div>
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={submit}>Registrar</Button></div>
      </DialogContent>
    </Dialog>
  );
}
