import { useState } from "react";
import { toast } from "sonner";
import { Boxes, FileCheck2, MapPin, ShoppingBag, Truck } from "lucide-react";
import { WizardFooter, WizardShell, OptionCard, ReviewGrid } from "@/components/erp-wizard";
import { brl, clinics, stockInsights, useStock, useStockSession } from "@/lib/stock-live";
import { runResupply } from "@/lib/resupply";

type Channel = "pedido" | "compra";

export function MaterialResupplyWizard({ branchId, onClose }: { branchId?: string; onClose: () => void }) {
  useStock();
  const session = useStockSession();
  const scope = branchId ? [branchId] : session.scope;
  const groups = clinics.filter((clinic) => scope.includes(clinic.id)).flatMap((clinic) => (["pedido", "compra"] as Channel[]).map((channel) => {
    const items = stockInsights([clinic.id]).filter((row) => row.channel === channel && row.replenish > 0);
    return items.length ? { clinic, channel, items } : null;
  })).filter((group) => group !== null);
  const [key, setKey] = useState(groups[0] ? `${groups[0].clinic.id}:${groups[0].channel}` : "");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const selected = groups.find((group) => `${group.clinic.id}:${group.channel}` === key) ?? groups[0];
  const allowed = selected ? session.can(selected.channel === "pedido" ? "pedidos.criar" : "compras.gerenciar", selected.clinic.id) : false;
  const value = selected ? selected.items.reduce((sum, row) => sum + row.replenish * row.material.cost, 0) : 0;

  const finish = () => {
    if (!selected || saving) return;
    setSaving(true);
    void runResupply(selected.clinic.id, selected.channel, selected.items.map((row) => ({ materialId: row.materialId, qty: row.replenish }))).then((error) => {
      setSaving(false);
      if (error) return toast.error(error);
      toast.success(selected.channel === "compra" ? "Requisição de ressuprimento criada" : "Pedido de ressuprimento enviado ao CD");
      onClose();
    });
  };

  return (
    <WizardShell open onClose={onClose} badge="Ressuprimento" headline={<>Repor até<br /><span className="opacity-60">o estoque máximo.</span></>} sub="Quando o disponível mais o que já está a caminho fica abaixo do mínimo." steps={[{ title: "Destino", desc: "Unidade e origem da reposição", icon: MapPin }, { title: "Materiais", desc: "Quantidade sugerida de cada item", icon: Boxes }, { title: "Revisão", desc: "Pedido ao CD ou compra", icon: FileCheck2 }]} step={step} setStep={setStep} footer={<WizardFooter step={step} last={2} setStep={setStep} onClose={onClose} onFinish={finish} finishLabel={saving ? "Gerando..." : selected?.channel === "compra" ? "Gerar requisição de compra" : "Enviar pedido ao CD"} canNext={Boolean(selected) && !saving && (step < 2 || allowed)} />}>
      {step === 0 && (groups.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum material está abaixo do mínimo nas unidades visíveis. O saldo atual, somado ao que já foi pedido, cobre a política de estoque.</p> : <div className="grid sm:grid-cols-2 gap-3">{groups.map((group) => <OptionCard key={`${group.clinic.id}:${group.channel}`} selected={selected?.clinic.id === group.clinic.id && selected.channel === group.channel} onClick={() => setKey(`${group.clinic.id}:${group.channel}`)} icon={group.channel === "compra" ? ShoppingBag : Truck} title={group.clinic.name} desc={`${group.channel === "compra" ? "Comprar de fornecedor" : "Pedir ao Centro de Distribuição"} · ${group.items.length} ${group.items.length === 1 ? "material" : "materiais"} · ${brl(group.items.reduce((sum, row) => sum + row.replenish * row.material.cost, 0))}`} />)}</div>)}
      {step === 1 && selected && <div className="divide-y divide-border">{selected.items.map((row) => <div key={row.materialId} className="py-3 flex items-center justify-between gap-3"><div><div className="text-sm font-medium">{row.material.name}</div><div className="text-xs text-muted-foreground">Disponível {row.available} · a caminho {row.incoming} · mínimo {row.material.min} · máximo {row.material.max}</div></div><span className="font-semibold whitespace-nowrap">+{row.replenish} {row.material.unit}</span></div>)}</div>}
      {step === 2 && selected && <div className="space-y-4"><ReviewGrid items={[["Unidade", selected.clinic.name], ["Origem", selected.channel === "compra" ? "Compra com fornecedor" : "Centro de Distribuição"], ["Materiais", String(selected.items.length)], ["Quantidade", String(selected.items.reduce((sum, row) => sum + row.replenish, 0))], ["Valor estimado", brl(value)]]} />{!allowed && <p className="text-sm text-muted-foreground">Seu perfil não pode {selected.channel === "compra" ? "abrir compras" : "criar pedidos"} nesta unidade.</p>}</div>}
    </WizardShell>
  );
}
