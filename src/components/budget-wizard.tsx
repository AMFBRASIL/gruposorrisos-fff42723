import { useState } from 'react';
import { toast } from 'sonner';
import { Wallet, FileCheck2 } from 'lucide-react';
import { WizardShell, WizardFooter, ReviewGrid, selectCls } from './erp-wizard';
import { Input } from './ui/input';
import { CurrencyInput } from './ui/currency-input';
import { Switch } from './ui/switch';
import { useErp, useSession, branchName } from '@/lib/erp';
import { saveBudget, type Budget } from '@/lib/procurement-budget';
import { brl } from '@/lib/stock';

export function BudgetWizard({ initial, onClose }: { initial?: Budget; onClose: () => void }) {
  const erp = useErp(), ses = useSession();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Budget>(initial ?? { branchId: ses.scope[0] ?? '', period: new Date().toISOString().slice(0, 7), limit: 0, block: false });
  const valid = !!draft.branchId && /^\d{4}-(0[1-9]|1[0-2])$/.test(draft.period) && Number.isFinite(draft.limit) && draft.limit >= 0;
  return <WizardShell open onClose={onClose} badge="Orçamento de compras" headline={<>Centro de custo,<br />controle de aprovação.</>} steps={[{ title: 'Limite e controle', desc: 'Filial, mês e política de aprovação', icon: Wallet }, { title: 'Revisão', desc: 'Confirmar orçamento', icon: FileCheck2 }]} step={step} setStep={setStep} footer={<WizardFooter step={step} last={1} onClose={onClose} setStep={setStep} canNext={valid} finishLabel="Salvar orçamento" onFinish={() => { const e = saveBudget(draft); if (e) return toast.error(e); toast.success('Orçamento atualizado'); onClose(); }} />}>
    {step === 0 ? <div className="space-y-5"><label className="block text-sm space-y-2"><span>Filial / centro de custo</span><select aria-label="Filial do orçamento" className={selectCls} value={draft.branchId} onChange={e => setDraft({ ...draft, branchId: e.target.value })}>{erp.branches.filter(b => ses.scope.includes(b.id) && ses.can('compras.gerenciar', b.id)).map(b => <option key={b.id} value={b.id}>{b.name} · {b.costCenter}</option>)}</select></label><label className="block text-sm space-y-2"><span>Mês do orçamento</span><Input aria-label="Mês do orçamento" type="month" value={draft.period} onChange={e => setDraft({ ...draft, period: e.target.value })} /></label><label className="block text-sm space-y-2"><span>Limite mensal</span><CurrencyInput aria-label="Limite mensal" value={draft.limit} onValueChange={v => setDraft({ ...draft, limit: v === '' ? 0 : v })} /></label><div className="flex items-center gap-3"><Switch id="budget-block" checked={draft.block} onCheckedChange={block => setDraft({ ...draft, block })} /><label htmlFor="budget-block" className="text-sm">Bloquear aprovação acima do orçamento</label></div></div> : <ReviewGrid items={[["Filial", branchName(draft.branchId)], ['Mês', draft.period], ['Limite', brl(draft.limit)], ['Acima do limite', draft.block ? 'Bloquear aprovação' : 'Alertar aprovador']]} />}
  </WizardShell>;
}