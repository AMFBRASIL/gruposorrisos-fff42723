import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePurchasing } from "@/lib/purchasing";
import { WizardShell, WizardFooter, OptionCard, FieldLabel, ReviewGrid, selectCls } from "@/components/erp-wizard";
import { useStock, materials, categories, clinics, getMaterial, getClinic, balanceOf, brl, addMaterial, registerMovements, applyInventory, createTransfer, addLot, type MovementType } from "@/lib/stock";
import { useSession } from "@/lib/erp";
import { StockCodeScanner } from './stock-code-scanner';
import { submitInventory, useAdvancedStock } from '@/lib/stock-advanced';
import { Package, Tag, Boxes, FileCheck2, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, MapPin, Hash, Route as RouteIcon, ListChecks, CalendarClock, Stethoscope, Trash2, Wrench, Scissors, Sparkles, ShieldCheck, Briefcase, FileText, Shapes, Search } from "lucide-react";

const catIcons: Record<string, typeof Package> = { "Materiais odontológicos": Stethoscope, Descartáveis: Trash2, Equipamentos: Wrench, Instrumentais: Scissors, Limpeza: Sparkles, Escritório: Briefcase, EPIs: ShieldCheck, Administrativos: FileText, Outros: Shapes };
const units = ["un", "cx", "pct", "fr", "kit", "par", "rolo", "l"];

function useVisibleClinics() { const ses = useSession(); return clinics.filter(c => ses.visible.includes(c.id)); }

export function NewMaterialWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const { sup } = usePurchasing();
  const manufacturers = [...new Set(materials.flatMap(m => [m.manufacturer || m.brand]).filter(Boolean))];
  const [f, setF] = useState({ name: "", code: `MAT-${String(materials.length + 1).padStart(4, "0")}`, sku: "", barcode: "", approvalCertificate: "", supplierId: "", manufacturer: "", description: "", brand: "", category: categories[0], unit: "un", cost: 0, min: 10, max: 50, lotControl: true });
  const [initial, setInitial] = useState<Record<string, number>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const steps = [{ title: "Categoria", desc: "Classifique o item no catálogo", icon: Tag }, { title: "Identificação", desc: "Nome, códigos, marca e custo", icon: Package }, { title: "Política de estoque", desc: "Mín/máx, lote e saldo inicial", icon: Boxes }, { title: "Revisão", desc: "Confirme o cadastro", icon: FileCheck2 }];
  const finish = () => { const e = addMaterial(f, Object.entries(initial).map(([clinicId, qty]) => ({ clinicId, qty }))); if (e) return toast.error(e); toast.success("Material cadastrado"); onClose(); };
  return (
    <WizardShell open={open} onClose={onClose} badge="Novo material" headline={<>Catálogo único<br /><span className="opacity-60">para todas as filiais.</span></>} sub="Padronize códigos, custos e políticas de reposição." steps={steps} step={step} setStep={setStep}
      footer={<WizardFooter step={step} last={3} onClose={onClose} setStep={setStep} onFinish={finish} finishLabel="Cadastrar material" canNext={step !== 1 || (f.name.trim().length > 1 && !!f.code.trim() && (f.category !== "EPIs" || !!f.approvalCertificate.trim()))} />}>
      {step === 0 && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{categories.map(c => <OptionCard key={c} selected={f.category === c} onClick={() => set("category", c)} icon={catIcons[c] ?? Shapes} title={c} />)}</div>}
      {step === 1 && <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-1"><Label htmlFor="material-name">Nome do material *</Label><Input id="material-name" autoFocus required value={f.name} onChange={e => set("name", e.target.value)} placeholder="Ex.: Resina composta A2 4g" /></div>
        <div className="space-y-1"><Label htmlFor="material-code">Código do material *</Label><Input id="material-code" required value={f.code} onChange={e => set("code", e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="material-barcode">Código de barras</Label><Input id="material-barcode" value={f.barcode} onChange={e => set("barcode", e.target.value)} placeholder="Ex.: 7891234567890" /></div>
        <div className="space-y-1"><Label htmlFor="material-sku">SKU</Label><Input id="material-sku" value={f.sku} onChange={e => set("sku", e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="material-ca">Certificado de Aprovação (CA){f.category === "EPIs" ? " *" : ""}</Label><Input id="material-ca" required={f.category === "EPIs"} value={f.approvalCertificate} onChange={e => set("approvalCertificate", e.target.value)} placeholder="Ex.: CA-12345" /><p className="text-xs text-muted-foreground">Obrigatório para materiais EPI.</p></div>
        <div className="space-y-1"><Label htmlFor="material-supplier">Fornecedor</Label><select id="material-supplier" className={`${selectCls} w-full`} value={f.supplierId} onChange={e => set("supplierId", e.target.value)}><option value="">Selecione um fornecedor</option>{sup.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="material-manufacturer">Fabricante</Label><Input id="material-manufacturer" list="material-manufacturers" value={f.manufacturer} onChange={e => set("manufacturer", e.target.value)} placeholder="Selecione ou informe o fabricante" /><datalist id="material-manufacturers">{manufacturers.map(m => <option key={m} value={m} />)}</datalist></div>
        <div className="space-y-1"><Label htmlFor="material-brand">Marca</Label><Input id="material-brand" value={f.brand} onChange={e => set("brand", e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="material-cost">Custo unitário (R$)</Label><CurrencyInput id="material-cost" value={f.cost} onValueChange={value => set("cost", value === "" ? 0 : value)} /></div>
        <div className="md:col-span-2 space-y-1"><Label htmlFor="material-description">Descrição</Label><Textarea id="material-description" rows={3} value={f.description} onChange={e => set("description", e.target.value)} placeholder="Descrição detalhada do material" /></div>
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
      {step === 3 && <ReviewGrid items={[["Material", f.name || "—"], ["Categoria", f.category], ["Código / SKU", `${f.code} · ${f.sku || "—"}`], ["Código de barras", f.barcode || "—"], ["CA", f.approvalCertificate || "—"], ["Fornecedor", sup.find(s => s.id === f.supplierId)?.name || "—"], ["Fabricante", f.manufacturer || "—"], ["Marca", f.brand || "—"], ["Descrição", f.description || "—"], ["Custo", brl(f.cost)], ["Mín / Máx", `${f.min} / ${f.max} ${f.unit}`], ["Saldo inicial", `${Object.values(initial).reduce((a, b) => a + (b || 0), 0)} ${f.unit}`]]} />}
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
  const [clinicId, setClinic] = useState(vis[0]?.id ?? "cd");
  const [toClinicId, setTo] = useState(clinics.find(c => c.id !== clinicId)?.id ?? "c1");
  const [reason, setReason] = useState("Compra"); const [doc, setDoc] = useState("");
  const [items, setItems] = useState<{ materialId: string; qty: number }[]>([]);
  const [pick, setPick] = useState(materials[0].id);
  const after = (i: { materialId: string; qty: number }) => balanceOf(s, i.materialId, clinicId) + (type === "entrada" ? i.qty : -i.qty);
  const invalid = items.length === 0 || items.some(i => i.qty <= 0 || (type !== "entrada" && after(i) < 0));
  const total = items.reduce((a, i) => a + i.qty * getMaterial(i.materialId).cost, 0);
  const steps = [{ title: "Tipo", desc: "Natureza da movimentação", icon: ArrowLeftRight }, { title: "Local e motivo", desc: "Filiais, motivo e documento", icon: MapPin }, { title: "Materiais", desc: "Um ou vários itens", icon: ListChecks }, { title: "Revisão", desc: "Impacto no saldo", icon: FileCheck2 }];
  const finish = () => {
    const e = registerMovements(items.map(i => ({ type, materialId: i.materialId, clinicId, toClinicId: type === "transferencia" ? toClinicId : undefined, qty: i.qty, reason: doc ? `${reason} · ${doc}` : reason, user: ses.user.name })));
    if (e) return toast.error(e); toast.success(`${items.length} movimentação(ões) registrada(s)`); onClose();
  };
  return (
    <WizardShell open={open} onClose={onClose} badge="Nova movimentação" headline={<>Cada unidade<br /><span className="opacity-60">rastreada.</span></>} sub="Lance vários materiais de uma vez, com trilha de auditoria." steps={steps} step={step} setStep={setStep}
      footer={<WizardFooter step={step} last={3} onClose={onClose} setStep={setStep} onFinish={finish} finishLabel={`Registrar ${items.length} item(ns)`} canNext={step < 2 || !invalid} />}>
      {step === 0 && <div className="grid md:grid-cols-3 gap-3">{(Object.keys(moveMeta) as MovementType[]).map(k => <OptionCard key={k} selected={type === k} onClick={() => { setType(k); setReason(moveMeta[k].reasons[0]); }} icon={moveMeta[k].icon} title={moveMeta[k].label} desc={moveMeta[k].desc} />)}</div>}
      {step === 1 && <>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1"><Label>{type === "transferencia" ? "Origem" : "Filial"}</Label><select className={selectCls} value={clinicId} onChange={e => setClinic(e.target.value)}>{vis.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          {type === "transferencia" && <div className="space-y-1"><Label>Destino</Label><select className={selectCls} value={toClinicId} onChange={e => setTo(e.target.value)}>{clinics.filter(c => c.id !== clinicId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
          <div className="space-y-1"><Label>Documento (NF, OS…)</Label><Input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Opcional" /></div>
        </div>
        <div><FieldLabel>Motivo</FieldLabel><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{moveMeta[type].reasons.map(r => <OptionCard compact key={r} selected={reason === r} onClick={() => setReason(r)} title={r} />)}</div></div>
      </>}
      {step === 2 && <>
        <StockCodeScanner onMaterial={id => { setPick(id); setItems(prev => prev.some(i => i.materialId === id) ? prev.map(i => i.materialId === id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { materialId: id, qty: 1 }]); }} />
        <MaterialPicker value={pick} onChange={id => { setPick(id); if (!items.some(i => i.materialId === id)) setItems([...items, { materialId: id, qty: 1 }]); }} clinicId={clinicId} />
        <div className="rounded-xl border border-border divide-y divide-border">
          <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/40 flex justify-between"><span>{items.length} material(is) selecionado(s) — clique nos cards para adicionar</span><span>{brl(total)}</span></div>
          {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum material adicionado.</div>}
          {items.map(i => { const m = getMaterial(i.materialId); const a = after(i); return <div key={i.materialId} className="flex items-center gap-3 p-3"><div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{m.name}</div><div className={`text-xs ${a < 0 ? "text-destructive" : "text-muted-foreground"}`}>Saldo {balanceOf(s, i.materialId, clinicId)} → {a} {m.unit}</div></div><Input type="number" min={1} className="h-8 w-24" value={i.qty} onChange={e => setItems(items.map(x => x.materialId === i.materialId ? { ...x, qty: Number(e.target.value) } : x))} /><Button size="icon" variant="ghost" aria-label="Remover" onClick={() => setItems(items.filter(x => x.materialId !== i.materialId))}><Trash2 className="h-4 w-4" /></Button></div>; })}
        </div>
      </>}
      {step === 3 && <>
        <ReviewGrid items={[["Tipo", moveMeta[type].label], [type === "transferencia" ? "Origem → Destino" : "Filial", type === "transferencia" ? `${getClinic(clinicId).name} → ${getClinic(toClinicId).name}` : getClinic(clinicId).name], ["Motivo", reason], ["Itens", String(items.length)], ["Unidades", String(items.reduce((a, i) => a + i.qty, 0))], ["Valor", brl(total)]]} />
        <div className="rounded-xl border border-border divide-y divide-border">{items.map(i => <div key={i.materialId} className="flex justify-between p-3 text-sm"><span>{getMaterial(i.materialId).name}</span><span className="font-medium">{i.qty} {getMaterial(i.materialId).unit}</span></div>)}</div>
      </>}
    </WizardShell>
  );
}

export function NewInventoryWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const policy = useAdvancedStock();
  const s = useStock(); const ses = useSession(); const vis = useVisibleClinics();
  const allowedBranches = vis.filter(c => ses.can("inventario.realizar", c.id));
  const [step, setStep] = useState(0);
  const [branchId, setBranch] = useState(allowedBranches[0]?.id ?? "");
  const [scope, setScope] = useState("Completo");
  const [blind, setBlind] = useState(true);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const items = materials.filter(m => scope === "Completo" || m.category === scope);
  const rows = items.map(m => { const sys = balanceOf(s, m.id, branchId); const raw = counts[m.id]; const cnt = raw === undefined || raw === "" ? null : Number(raw); return { m, sys, cnt, diff: cnt === null ? 0 : cnt - sys }; });
  const counted = rows.filter(r => r.cnt !== null).length;
  const divs = rows.filter(r => r.diff !== 0);
  const vIn = divs.filter(r => r.diff > 0).reduce((a, r) => a + r.diff * r.m.cost, 0);
  const vOut = -divs.filter(r => r.diff < 0).reduce((a, r) => a + r.diff * r.m.cost, 0);
  const accuracy = counted ? Math.round(((counted - divs.length) / counted) * 100) : 100;
  const steps = [{ title: "Filial", desc: "Onde será a contagem", icon: MapPin }, { title: "Escopo", desc: "Completo ou por categoria", icon: Boxes }, { title: "Contagem", desc: "Quantidade física por item", icon: ListChecks }, { title: "Conciliação", desc: "Divergências e ajustes", icon: FileCheck2 }];
  const finish = () => { const r = submitInventory({ branchId, scope, blind, user: ses.user.name, counts: Object.fromEntries(rows.filter(x => x.cnt !== null).map(x => [x.m.id, x.cnt as number])) }); if (r.error) return toast.error(r.error); toast.success(r.pending ? 'Contagem enviada para aprovação · saldo não alterado' : `${r.record?.number} concluído`); onClose(); };
  if (allowedBranches.length === 0) return <WizardShell open={open} onClose={onClose} badge="Novo inventário" headline="Sem permissão" steps={[{ title: "Acesso", desc: "Seu perfil não pode inventariar nenhuma filial", icon: MapPin }]} step={0} setStep={() => {}} footer={<Button variant="outline" onClick={onClose}>Fechar</Button>}><p className="text-sm text-muted-foreground">Peça a um administrador a permissão de inventário.</p></WizardShell>;
  const shown = rows.filter(r => r.m.name.toLowerCase().includes(q.toLowerCase()) && true);
  return (
    <WizardShell open={open} onClose={onClose} badge="Novo inventário" headline={<>Estoque físico<br /><span className="opacity-60">igual ao sistema.</span></>} sub="Contagem completa ou cíclica, com conciliação automática das diferenças." steps={steps} step={step} setStep={setStep}
      footer={<WizardFooter step={step} last={3} onClose={onClose} setStep={setStep} onFinish={finish} finishLabel={vIn + vOut > policy.limit ? 'Enviar para aprovação' : `Concluir e ajustar (${divs.length})`} canNext={step < 2 || (counted === items.length && rows.every(r => r.cnt !== null && Number.isFinite(r.cnt) && r.cnt >= 0))} extra={step === 2 && !blind ? <Button variant="outline" onClick={() => setCounts(Object.fromEntries(rows.map(r => [r.m.id, counts[r.m.id] || String(r.sys)])))}>Preencher não contados com saldo</Button> : undefined} />}>
      {step === 0 && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{allowedBranches.map(c => <OptionCard key={c.id} selected={branchId === c.id} onClick={() => { setBranch(c.id); setCounts({}); }} icon={MapPin} title={c.name} desc={`${c.city} · ${materials.reduce((a, m) => a + balanceOf(s, m.id, c.id), 0)} un em estoque`} />)}</div>}
      {step === 1 && <>
        <div><FieldLabel>Tipo de inventário</FieldLabel><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <OptionCard selected={scope === "Completo"} onClick={() => { setScope("Completo"); setCounts({}); }} icon={Boxes} title="Inventário completo" desc={`Todos os ${materials.length} itens da filial`} />
          {categories.filter(c => materials.some(m => m.category === c)).map(c => <OptionCard key={c} selected={scope === c} onClick={() => { setScope(c); setCounts({}); }} icon={catIcons[c] ?? Shapes} title={`Cíclico · ${c}`} desc={`${materials.filter(m => m.category === c).length} itens`} />)}
        </div></div>
        <div className="rounded-xl border border-border p-4 flex items-center justify-between"><div><div className="text-sm font-medium">Contagem cega</div><div className="text-xs text-muted-foreground">Esconde o saldo do sistema durante a contagem para evitar viés</div></div><Switch checked={blind} onCheckedChange={setBlind} /></div>
      </>}
      {step === 2 && <>
        <StockCodeScanner onMaterial={id => { const m = getMaterial(id); if (!items.some(i => i.id === id)) return toast.error('Material fora do escopo'); setQ(m.name); setCounts(prev => ({ ...prev, [id]: String(Number(prev[id] || 0) + 1) })); }} />
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar item" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div className="text-sm text-muted-foreground whitespace-nowrap">{counted}/{items.length} contados</div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(counted / Math.max(1, items.length)) * 100}%` }} /></div>
        <div className="rounded-xl border border-border divide-y divide-border">{shown.map(r => <div key={r.m.id} className="flex items-center gap-3 p-3">
          <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{r.m.name}</div><div className="text-xs text-muted-foreground">{r.m.code} · {r.m.unit}{!blind && ` · sistema: ${r.sys}`}</div></div>
          {!blind && r.cnt !== null && <span className={`text-xs font-semibold w-14 text-right ${r.diff < 0 ? "text-destructive" : r.diff > 0 ? "text-success" : "text-muted-foreground"}`}>{r.diff > 0 ? "+" : ""}{r.diff}</span>}
          <Input type="number" min={0} className="h-9 w-28" placeholder="Contagem" value={counts[r.m.id] ?? ""} onChange={e => setCounts({ ...counts, [r.m.id]: e.target.value })} />
        </div>)}</div>
      </>}
      {step === 3 && <>
        {vIn + vOut > policy.limit && <div className="border border-warning/30 bg-warning/10 p-3 rounded-lg text-sm">Divergências de {brl(vIn + vOut)}: aprovação de outro gestor obrigatória antes de alterar o saldo.</div>}
        <ReviewGrid items={[["Filial", getClinic(branchId).name], ["Escopo", scope], ["Itens contados", `${counted}/${items.length}`], ["Acurácia", `${accuracy}%`], ["Sobras", brl(vIn)], ["Faltas", brl(vOut)]]} />
        <FieldLabel>Divergências ({divs.length})</FieldLabel>
        <div className="rounded-xl border border-border divide-y divide-border">
          {divs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sem divergências — estoque conferido.</div>}
          {divs.map(r => <div key={r.m.id} className="flex justify-between p-3 text-sm"><span>{r.m.name}</span><span className="text-muted-foreground">{r.sys} → {r.cnt}</span><span className={`font-semibold ${r.diff < 0 ? "text-destructive" : "text-success"}`}>{r.diff > 0 ? "+" : ""}{r.diff} · {brl(r.diff * r.m.cost)}</span></div>)}
        </div>
      </>}
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
