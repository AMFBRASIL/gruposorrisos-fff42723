import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { WizardShell, WizardFooter, OptionCard, FieldLabel, ReviewGrid, selectCls } from "@/components/erp-wizard";
import { useStock, materials, categories, clinics, getMaterial, getClinic, balanceOf, brl, addMaterial, registerMovement, createTransfer, addLot, type MovementType } from "@/lib/stock";
import { useSession } from "@/lib/erp";
import { Package, Tag, Boxes, FileCheck2, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, MapPin, Hash, Route as RouteIcon, ListChecks, CalendarClock, Stethoscope, Trash2, Wrench, Scissors, Sparkles, ShieldCheck, Briefcase, FileText, Shapes, Search } from "lucide-react";

const catIcons: Record<string, typeof Package> = { "Materiais odontológicos": Stethoscope, Descartáveis: Trash2, Equipamentos: Wrench, Instrumentais: Scissors, Limpeza: Sparkles, Escritório: Briefcase, EPIs: ShieldCheck, Administrativos: FileText, Outros: Shapes };
const units = ["un", "cx", "pct", "fr", "kit", "par", "rolo", "l"];

function useVisibleClinics() { const ses = useSession(); return clinics.filter(c => ses.visible.includes(c.id)); }

export function NewMaterialWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: "", code: `MAT-${String(materials.length + 1).padStart(4, "0")}`, sku: "", brand: "", category: categories[0], unit: "un", cost: 0, min: 10, max: 50, lotControl: true });
  const [initial, setInitial] = useState<Record<string, number>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const steps = [{ title: "Categoria", desc: "Classifique o item no catálogo", icon: Tag }, { title: "Identificação", desc: "Nome, códigos, marca e custo", icon: Package }, { title: "Política de estoque", desc: "Mín/máx, lote e saldo inicial", icon: Boxes }, { title: "Revisão", desc: "Confirme o cadastro", icon: FileCheck2 }];
  const finish = () => { const e = addMaterial(f, Object.entries(initial).map(([clinicId, qty]) => ({ clinicId, qty }))); if (e) return toast.error(e); toast.success("Material cadastrado"); onClose(); };
  return (
    <WizardShell open={open} onClose={onClose} badge="Novo material" headline={<>Catálogo único<br /><span className="opacity-60">para todas as filiais.</span></>} sub="Padronize códigos, custos e políticas de reposição." steps={steps} step={step} setStep={setStep}
      footer={<WizardFooter step={step} last={3} onClose={onClose} setStep={setStep} onFinish={finish} finishLabel="Cadastrar material" canNext={step !== 1 || f.name.trim().length > 1} />}>
      {step === 0 && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{categories.map(c => <OptionCard key={c} selected={f.category === c} onClick={() => set("category", c)} icon={catIcons[c] ?? Shapes} title={c} />)}</div>}
      {step === 1 && <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-1"><Label>Nome do material</Label><Input autoFocus value={f.name} onChange={e => set("name", e.target.value)} placeholder="Ex.: Resina composta A2 4g" /></div>
        <div className="space-y-1"><Label>Código interno</Label><Input value={f.code} onChange={e => set("code", e.target.value)} /></div>
        <div className="space-y-1"><Label>SKU / código de barras</Label><Input value={f.sku} onChange={e => set("sku", e.target.value)} /></div>
        <div className="space-y-1"><Label>Marca / fabricante</Label><Input value={f.brand} onChange={e => set("brand", e.target.value)} /></div>
        <div className="space-y-1"><Label>Custo unitário (R$)</Label><Input type="number" min={0} step="0.01" value={f.cost} onChange={e => set("cost", Number(e.target.value))} /></div>
        <div className="md:col-span-2"><FieldLabel>Unidade de medida</FieldLabel><div className="grid grid-cols-4 md:grid-cols-8 gap-2">{units.map(u => <OptionCard compact key={u} selected={f.unit === u} onClick={() => set("unit", u)} title={u} />)}</div></div>
      </div>}
      {step === 2 && <>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1"><Label>Estoque mínimo (por filial)</Label><Input type="number" min={0} value={f.min} onChange={e => set("min", Number(e.target.value))} /></div>
          <div className="space-y-1"><Label>Estoque máximo (por filial)</Label><Input type="number" min={0} value={f.max} onChange={e => set("max", Number(e.target.value))} /></div>
          <div className="rounded-xl border border-border p-4 flex items-center justify-between"><div><div className="text-sm font-medium">Controle de lote</div><div className="text-xs text-muted-foreground">Rastrear lote e validade</div></div><Switch checked={f.lotControl} onCheckedChange={v => set("lotControl", v)} /></div>
        </div>
        <div><FieldLabel>Saldo inicial por filial (opcional)</FieldLabel>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{clinics.map(c => <div key={c.id} className="rounded-xl border border-border p-3 flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /><div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{c.name}</div><div className="text-[11px] text-muted-foreground">{c.city}</div></div><Input type="number" min={0} className="h-8 w-20" value={initial[c.id] ?? ""} onChange={e => setInitial({ ...initial, [c.id]: Number(e.target.value) })} /></div>)}</div>
        </div>
      </>}
      {step === 3 && <ReviewGrid items={[["Material", f.name || "—"], ["Categoria", f.category], ["Código / SKU", `${f.code} · ${f.sku || "—"}`], ["Custo", brl(f.cost)], ["Mín / Máx", `${f.min} / ${f.max} ${f.unit}`], ["Saldo inicial", `${Object.values(initial).reduce((a, b) => a + (b || 0), 0)} ${f.unit}`]]} />}
    </WizardShell>
  );
}

const moveMeta: Record<MovementType, { label: string; desc: string; icon: typeof Package; reasons: string[] }> = {
  entrada: { label: "Entrada", desc: "Compra, devolução ou saldo inicial", icon: ArrowDownToLine, reasons: ["Compra", "Devolução", "Ajuste autorizado", "Saldo inicial"] },
  saida: { label: "Saída", desc: "Consumo, perda ou descarte", icon: ArrowUpFromLine, reasons: ["Consumo", "Perda", "Descarte", "Ajuste autorizado"] },
  transferencia: { label: "Transferência", desc: "Move saldo entre filiais na hora", icon: ArrowLeftRight, reasons: ["Entre clínicas", "Entre depósitos"] },
};

function MaterialPicker({ value, onChange, clinicId }: { value: string; onChange: (id: string) => void; clinicId?: string }) {
  const s = useStock(); const [q, setQ] = useState("");
  const list = useMemo(() => materials.filter(m => `${m.name} ${m.code} ${m.sku}`.toLowerCase().includes(q.toLowerCase())), [q]);
  return (<div>
    <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar material" value={q} onChange={e => setQ(e.target.value)} /></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">{list.map(m => <OptionCard compact key={m.id} selected={value === m.id} onClick={() => onChange(m.id)} title={m.name} desc={`${m.code} · saldo ${balanceOf(s, m.id, clinicId)} ${m.unit}`} />)}</div>
  </div>);
}

export function NewMovementWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStock(); const ses = useSession(); const vis = useVisibleClinics();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<MovementType>("entrada");
  const [materialId, setMaterial] = useState(materials[0].id);
  const [clinicId, setClinic] = useState(vis[0]?.id ?? "cd");
  const [toClinicId, setTo] = useState(clinics.find(c => c.id !== clinicId)?.id ?? "c1");
  const [qty, setQty] = useState(1); const [reason, setReason] = useState("Compra"); const [doc, setDoc] = useState("");
  const m = getMaterial(materialId); const bal = balanceOf(s, materialId, clinicId);
  const after = type === "entrada" ? bal + qty : bal - qty;
  const steps = [{ title: "Tipo", desc: "Natureza da movimentação", icon: ArrowLeftRight }, { title: "Material", desc: "Item movimentado", icon: Package }, { title: "Local e quantidade", desc: "Filiais, motivo e documento", icon: MapPin }, { title: "Revisão", desc: "Impacto no saldo", icon: FileCheck2 }];
  const finish = () => { const e = registerMovement({ type, materialId, clinicId, toClinicId: type === "transferencia" ? toClinicId : undefined, qty, reason: doc ? `${reason} · ${doc}` : reason, user: ses.user.name }); if (e) return toast.error(e); toast.success("Movimentação registrada"); onClose(); };
  return (
    <WizardShell open={open} onClose={onClose} badge="Nova movimentação" headline={<>Cada unidade<br /><span className="opacity-60">rastreada.</span></>} sub="Entradas, saídas e transferências com trilha de auditoria." steps={steps} step={step} setStep={setStep}
      footer={<WizardFooter step={step} last={3} onClose={onClose} setStep={setStep} onFinish={finish} finishLabel="Registrar" canNext={step !== 2 || (qty > 0 && (type === "entrada" || after >= 0))} />}>
      {step === 0 && <div className="grid md:grid-cols-3 gap-3">{(Object.keys(moveMeta) as MovementType[]).map(k => <OptionCard key={k} selected={type === k} onClick={() => { setType(k); setReason(moveMeta[k].reasons[0]); }} icon={moveMeta[k].icon} title={moveMeta[k].label} desc={moveMeta[k].desc} />)}</div>}
      {step === 1 && <MaterialPicker value={materialId} onChange={setMaterial} clinicId={clinicId} />}
      {step === 2 && <>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1"><Label>{type === "transferencia" ? "Origem" : "Filial"}</Label><select className={selectCls} value={clinicId} onChange={e => setClinic(e.target.value)}>{vis.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="text-xs text-muted-foreground">Saldo atual: {bal} {m.unit}</div></div>
          {type === "transferencia" && <div className="space-y-1"><Label>Destino</Label><select className={selectCls} value={toClinicId} onChange={e => setTo(e.target.value)}>{clinics.filter(c => c.id !== clinicId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
          <div className="space-y-1"><Label>Quantidade ({m.unit})</Label><Input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} /></div>
          <div className="space-y-1"><Label>Documento (NF, OS…)</Label><Input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Opcional" /></div>
        </div>
        <div><FieldLabel>Motivo</FieldLabel><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{moveMeta[type].reasons.map(r => <OptionCard compact key={r} selected={reason === r} onClick={() => setReason(r)} title={r} />)}</div></div>
        {type !== "entrada" && after < 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm p-3">Saldo insuficiente na origem.</div>}
      </>}
      {step === 3 && <ReviewGrid items={[["Tipo", moveMeta[type].label], ["Material", m.name], ["Quantidade", `${qty} ${m.unit}`], [type === "transferencia" ? "Origem → Destino" : "Filial", type === "transferencia" ? `${getClinic(clinicId).name} → ${getClinic(toClinicId).name}` : getClinic(clinicId).name], ["Saldo após", `${after} ${m.unit}`], ["Valor", brl(qty * m.cost)]]} />}
    </WizardShell>
  );
}

export function NewTransferWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStock(); const vis = useVisibleClinics();
  const [step, setStep] = useState(0);
  const [fromId, setFrom] = useState("cd"); const [toId, setTo] = useState(vis.find(c => c.id !== "cd")?.id ?? "c1");
  const [items, setItems] = useState<{ materialId: string; qty: number }[]>([]);
  const [pick, setPick] = useState(materials[0].id);
  const steps = [{ title: "Rota", desc: "Origem e destino", icon: RouteIcon }, { title: "Itens", desc: "Materiais e quantidades", icon: ListChecks }, { title: "Revisão", desc: "Confirme a solicitação", icon: FileCheck2 }];
  const finish = () => { const e = createTransfer({ fromId, toId, items }); if (e) return toast.error(e); toast.success("Transferência solicitada"); onClose(); };
  const value = items.reduce((a, i) => a + i.qty * getMaterial(i.materialId).cost, 0);
  return (
    <WizardShell open={open} onClose={onClose} badge="Nova transferência" headline={<>Equilibre o estoque<br /><span className="opacity-60">entre as unidades.</span></>} sub="Solicitação → aprovação → separação → trânsito → recebimento." steps={steps} step={step} setStep={setStep}
      footer={<WizardFooter step={step} last={2} onClose={onClose} setStep={setStep} onFinish={finish} finishLabel="Solicitar transferência" canNext={step === 0 ? fromId !== toId : items.length > 0} />}>
      {step === 0 && <>
        <div><FieldLabel>Origem</FieldLabel><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{clinics.map(c => <OptionCard key={c.id} selected={fromId === c.id} onClick={() => setFrom(c.id)} icon={MapPin} title={c.name} desc={c.city} />)}</div></div>
        <div><FieldLabel>Destino</FieldLabel><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{vis.filter(c => c.id !== fromId).map(c => <OptionCard key={c.id} selected={toId === c.id} onClick={() => setTo(c.id)} icon={MapPin} title={c.name} desc={c.city} />)}</div></div>
      </>}
      {step === 1 && <>
        <MaterialPicker value={pick} onChange={setPick} clinicId={fromId} />
        <Button variant="outline" disabled={items.some(i => i.materialId === pick)} onClick={() => setItems([...items, { materialId: pick, qty: 1 }])}>Adicionar {getMaterial(pick).name}</Button>
        <div className="rounded-xl border border-border divide-y divide-border">
          {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum item adicionado.</div>}
          {items.map(i => { const m = getMaterial(i.materialId); const b = balanceOf(s, i.materialId, fromId); return <div key={i.materialId} className="flex items-center gap-3 p-3"><div className="flex-1"><div className="text-sm font-medium">{m.name}</div><div className={`text-xs ${b < i.qty ? "text-destructive" : "text-muted-foreground"}`}>Disponível na origem: {b} {m.unit}</div></div><Input type="number" min={1} className="h-8 w-24" value={i.qty} onChange={e => setItems(items.map(x => x.materialId === i.materialId ? { ...x, qty: Number(e.target.value) } : x))} /><Button size="icon" variant="ghost" aria-label="Remover" onClick={() => setItems(items.filter(x => x.materialId !== i.materialId))}><Trash2 className="h-4 w-4" /></Button></div>; })}
        </div>
      </>}
      {step === 2 && <ReviewGrid items={[["Origem", getClinic(fromId).name], ["Destino", getClinic(toId).name], ["Itens", String(items.length)], ["Unidades", String(items.reduce((a, i) => a + i.qty, 0))], ["Valor estimado", brl(value)], ["Status inicial", "Solicitada"]]} />}
    </WizardShell>
  );
}

export function NewLotWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vis = useVisibleClinics();
  const [step, setStep] = useState(0);
  const [materialId, setMaterial] = useState(materials.find(m => m.lotControl)?.id ?? materials[0].id);
  const [clinicId, setClinic] = useState(vis[0]?.id ?? "cd");
  const [lot, setLot] = useState(""); const [expires, setExpires] = useState("2027-06-30"); const [qty, setQty] = useState(10);
  const steps = [{ title: "Material", desc: "Item com controle de lote", icon: Package }, { title: "Lote e validade", desc: "Número, data e quantidade", icon: Hash }, { title: "Revisão", desc: "Confirme o lote", icon: CalendarClock }];
  const finish = () => { const e = addLot({ materialId, clinicId, lot, expires, qty }); if (e) return toast.error(e); toast.success("Lote registrado"); onClose(); };
  return (
    <WizardShell open={open} onClose={onClose} badge="Novo lote" headline={<>Validade sob controle,<br /><span className="opacity-60">zero desperdício.</span></>} sub="Registre lotes para alertas de vencimento por filial." steps={steps} step={step} setStep={setStep}
      footer={<WizardFooter step={step} last={2} onClose={onClose} setStep={setStep} onFinish={finish} finishLabel="Registrar lote" canNext={step !== 1 || (lot.trim().length > 0 && qty > 0)} />}>
      {step === 0 && <MaterialPicker value={materialId} onChange={setMaterial} clinicId={clinicId} />}
      {step === 1 && <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Filial</Label><select className={selectCls} value={clinicId} onChange={e => setClinic(e.target.value)}>{vis.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="space-y-1"><Label>Número do lote</Label><Input autoFocus value={lot} onChange={e => setLot(e.target.value)} placeholder="Ex.: L2701" /></div>
        <div className="space-y-1"><Label>Validade</Label><Input type="date" value={expires} onChange={e => setExpires(e.target.value)} /></div>
        <div className="space-y-1"><Label>Quantidade</Label><Input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} /></div>
      </div>}
      {step === 2 && <ReviewGrid items={[["Material", getMaterial(materialId).name], ["Filial", getClinic(clinicId).name], ["Lote", lot || "—"], ["Validade", expires.split("-").reverse().join("/")], ["Quantidade", String(qty)]]} />}
    </WizardShell>
  );
}
