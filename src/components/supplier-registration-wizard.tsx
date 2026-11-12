import { useState } from 'react';
import { toast } from 'sonner';
import { Building2, Contact, Truck, FileCheck2 } from 'lucide-react';
import { addSupplier, updateSupplier, type Supplier } from '@/lib/purchasing';
import { WizardShell, WizardFooter, ReviewGrid } from './erp-wizard';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

export function SupplierRegistrationWizard({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Omit<Supplier, 'id'>>(supplier ?? { name: '', cnpj: '', contact: '', email: '', phone: '', address: '', city: '', state: '', notes: '', leadDays: 5, rating: 0, categories: [] });
  const field = (key: 'name' | 'cnpj' | 'contact' | 'email' | 'phone' | 'address' | 'city' | 'state', label: string) => <div className="space-y-2" key={key}><Label htmlFor={`register-${key}`}>{label}</Label><Input id={`register-${key}`} type={key === 'email' ? 'email' : 'text'} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>;
  const save = () => { const error = supplier ? updateSupplier({ ...form, id: supplier.id }) : addSupplier(form); if (error) return toast.error(error); toast.success(supplier ? 'Fornecedor atualizado' : 'Fornecedor cadastrado'); onClose(); };
  return <WizardShell open onClose={onClose} badge="Cadastro de fornecedores" headline={supplier ? 'Editar fornecedor' : 'Novo fornecedor'} sub={form.name || 'Grupo | Sorrisos'} step={step} setStep={setStep} steps={[{ title: 'Identificação', desc: 'Empresa e documento', icon: Building2 }, { title: 'Contato e endereço', desc: 'Responsável e localização', icon: Contact }, { title: 'Condições comerciais', desc: 'Categorias e prazo de entrega', icon: Truck }, { title: 'Revisão', desc: 'Conferência do cadastro', icon: FileCheck2 }]} footer={<WizardFooter step={step} last={3} setStep={setStep} onClose={onClose} onFinish={save} finishLabel="Salvar fornecedor" canNext={!!form.name.trim()} />}>
    {step === 0 && <div className="grid sm:grid-cols-2 gap-4">{field('name', 'Nome / razão social')}{field('cnpj', 'CNPJ')}</div>}
    {step === 1 && <div className="grid sm:grid-cols-2 gap-4">{field('contact', 'Contato responsável')}{field('email', 'E-mail')}{field('phone', 'Telefone')}{field('address', 'Endereço')}{field('city', 'Cidade')}{field('state', 'Estado')}</div>}
    {step === 2 && <div className="space-y-5"><div className="grid sm:grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="supplier-lead">Prazo de entrega (dias)</Label><Input id="supplier-lead" type="number" min={0} value={form.leadDays} onChange={e => setForm({ ...form, leadDays: Math.max(0, Number(e.target.value)) })} /></div><div className="space-y-2"><Label htmlFor="supplier-categories">Categorias</Label><Input id="supplier-categories" value={form.categories.join(', ')} onChange={e => setForm({ ...form, categories: e.target.value.split(',').map(x => x.trimStart()) })} placeholder="EPIs, descartáveis" /></div></div><div className="space-y-2"><Label htmlFor="supplier-notes">Observações</Label><Textarea id="supplier-notes" value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div></div>}
    {step === 3 && <><ReviewGrid items={[["Fornecedor", form.name], ["CNPJ", form.cnpj || '—'], ["Contato", form.contact || '—'], ["E-mail", form.email || '—'], ["Telefone", form.phone || '—'], ["Prazo", `${form.leadDays} dias`], ["Categorias", form.categories.filter(Boolean).join(', ') || '—'], ["Localização", [form.address, form.city, form.state].filter(Boolean).join(' · ') || '—']]} /><p className="text-sm whitespace-pre-wrap text-muted-foreground">{form.notes}</p></>}
  </WizardShell>;
}