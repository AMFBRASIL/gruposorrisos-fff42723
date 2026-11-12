import { useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Store, FileCheck2 } from 'lucide-react';
import { WizardShell, WizardFooter, ReviewGrid, selectCls } from './erp-wizard';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { materials, getMaterial } from '@/lib/stock';
import { addSupplier, createRequisition } from '@/lib/purchasing';
import { SupplierRegistrationWizard } from './supplier-registration-wizard';

export function PurchaseCreationWizard({ kind, onClose }: { kind: 'requisition' | 'supplier'; onClose: () => void }) {
  const [step,setStep] = useState(0);
  const [materialId,setMaterial] = useState(materials[0]?.id ?? ''); const [qty,setQty] = useState(50);
  const [supplier,setSupplier] = useState({ name: '', cnpj: '', contact: '', email: '' });
  const isSupplier = kind === 'supplier';
  const valid = isSupplier ? !!supplier.name.trim() : !!materialId && Number.isFinite(qty) && qty > 0;
  const finish = () => { const error = isSupplier ? addSupplier({ ...supplier, leadDays: 5, rating: 4, categories: [] }) : createRequisition('cd',[{ materialId, qty }]); if (error) return toast.error(error); toast.success(isSupplier ? 'Fornecedor cadastrado' : 'Requisição criada'); onClose(); };
  if (isSupplier) return <SupplierRegistrationWizard onClose={onClose} />;
  return <WizardShell open onClose={onClose} badge="Compras e fornecedores" headline={isSupplier ? 'Novo fornecedor' : 'Nova requisição'} sub="Grupo Sorrisos" steps={[{ title: 'Identificação', desc: isSupplier ? 'Dados do fornecedor' : 'Material e quantidade', icon: isSupplier ? Store : ClipboardList }, { title: 'Revisão', desc: 'Conferência antes de salvar', icon: FileCheck2 }]} step={step} setStep={setStep} footer={<WizardFooter step={step} last={1} onClose={onClose} setStep={setStep} onFinish={finish} finishLabel={isSupplier ? 'Cadastrar fornecedor' : 'Criar requisição'} canNext={valid} />}>
    {step === 0 && (isSupplier ? <div className="grid sm:grid-cols-2 gap-4">{(['name','cnpj','contact','email'] as const).map(k => <div key={k} className="space-y-2"><Label htmlFor={`supplier-${k}`}>{{name:'Nome',cnpj:'CNPJ',contact:'Contato',email:'E-mail'}[k]}</Label><Input id={`supplier-${k}`} value={supplier[k]} onChange={e => setSupplier({ ...supplier,[k]: e.target.value })} /></div>)}</div> : <div className="space-y-5"><div className="space-y-2"><Label htmlFor="requisition-material">Material</Label><select id="requisition-material" className={selectCls} value={materialId} onChange={e => setMaterial(e.target.value)}>{materials.map(m => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="requisition-qty">Quantidade</Label><Input id="requisition-qty" type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} /></div><div className="text-sm text-muted-foreground">Centro de Distribuição</div></div>)}
    {step === 1 && <ReviewGrid items={isSupplier ? [['Fornecedor',supplier.name],['CNPJ',supplier.cnpj || '—'],['Contato',supplier.contact || '—'],['E-mail',supplier.email || '—']] : [['Material',getMaterial(materialId).name],['Quantidade',`${qty} ${getMaterial(materialId).unit}`],['Destino','Centro de Distribuição']]} />}
  </WizardShell>;
}