import { useState, type MutableRefObject, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, Lock, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { brl } from '@/lib/stock-live';
import { useProcurementSession, userName } from '@/lib/procurement-live';
import { stageCursor, stepColor, type ApprovalStep, type Workflow } from '@/lib/order-workflow';

function ink(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.62 ? '#111827' : '#ffffff';
}

export function OrderFigures({ lines }: { lines: { qty: number; price: number }[] }) {
  const count = lines.length;
  const qty = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const average = qty > 0 ? total / qty : 0;
  const cards = [
    ['Total de itens', String(count)],
    ['Qtd. total', Number.isInteger(qty) ? String(qty) : qty.toLocaleString('pt-BR')],
    ['Preço médio', brl(average)],
    ['Valor total', brl(total)],
  ];
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`mt-1 text-xl font-semibold ${label === 'Valor total' ? 'text-emerald-600' : ''}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function stageTone(step: ApprovalStep | undefined, index: number) {
  return step ? stepColor(step, index) : '#0f9f6e';
}

function StageAdvanceDialog({ open, note, onNote, onClose, onConfirm, current, next, currentColor, nextColor, when }: { open: boolean; note: string; onNote: (value: string) => void; onClose: () => void; onConfirm: () => void; current?: ApprovalStep; next?: ApprovalStep; currentColor: string; nextColor: string; when: Date }) {
  const session = useProcurementSession();
  const target = next?.name ?? 'Concluído';
  const date = when.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <AlertDialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <AlertDialogContent className="nested max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Atualizar etapa do pedido</AlertDialogTitle>
          <AlertDialogDescription>A situação só muda depois de confirmar. Estoque, orçamento e a aprovação comercial ficam como estão.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 rounded-lg border px-3 py-2" style={{ borderColor: currentColor, background: `${currentColor}14` }}>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Etapa atual</div>
            <div className="mt-1 truncate text-sm font-semibold" style={{ color: currentColor }}>{current?.name ?? 'Concluído'}</div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 rounded-lg border px-3 py-2" style={{ borderColor: nextColor, background: `${nextColor}14` }}>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Vai para</div>
            <div className="mt-1 truncate text-sm font-semibold" style={{ color: nextColor }}>{target}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
          <div><div className="text-muted-foreground">Registrado por</div><div className="mt-0.5 font-medium">{session.user.name}</div></div>
          <div><div className="text-muted-foreground">Data</div><div className="mt-0.5 font-medium">{date}</div></div>
          <div><div className="text-muted-foreground">Horário</div><div className="mt-0.5 font-medium tabular-nums">{time}</div></div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="stage-note" className="text-sm font-medium">Observação</label>
          <Textarea id="stage-note" autoFocus placeholder="Escreva o motivo antes de alterar a etapa" maxLength={2000} className="min-h-28" value={note} onChange={(event) => onNote(event.target.value)} />
          <p className="text-xs text-muted-foreground">{note.trim().length ? `${note.trim().length}/2000` : 'Obrigatória.'} A nota entra no histórico da etapa, com data, horário e autor.</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" onClick={onClose}>Cancelar</AlertDialogCancel>
          <Button type="button" disabled={!note.trim()} onClick={onConfirm}>Confirmar etapa</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function OrderStageBoard({ workflow, onAdvance, canAdvance, askRef }: { workflow?: Workflow; onAdvance: (note: string) => void; canAdvance: boolean; askRef?: MutableRefObject<(() => void) | null> }) {
  const cursor = stageCursor(workflow);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [when, setWhen] = useState(() => new Date());
  const request = () => { if (canAdvance && cursor && (cursor.next || cursor.onLast)) { setWhen(new Date()); setOpen(true); } };
  if (askRef) askRef.current = request;
  if (!workflow || !cursor) return <p className="text-sm text-muted-foreground">Este pedido ainda não tem etapas configuradas.</p>;
  const close = () => { setOpen(false); setNote(''); };
  const confirm = () => { if (!note.trim()) return; onAdvance(note.trim()); close(); };
  const stamp = (stepId: string) => {
    const move = [...(workflow.moves ?? [])].reverse().find((item) => item.stepId === stepId);
    const decision = [...workflow.decisions].reverse().find((item) => item.stepId === stepId);
    const at = move?.at ?? decision?.at;
    const who = move?.userId ?? decision?.userId;
    const text = at ? `${new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${who ? ` · ${userName(who)}` : ''}` : '';
    return { text, title: [text, move?.note].filter(Boolean).join(' — ') };
  };
  return (
    <section className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Fluxo de status</h3>
          <p className="truncate text-xs text-muted-foreground">{cursor.finished ? 'Todas as etapas foram concluídas.' : `Este pedido está em ${cursor.current?.name}. Clique na próxima etapa para confirmar a mudança.`}</p>
        </div>
        {canAdvance && (cursor.next || cursor.onLast) && <Button size="sm" onClick={request}>{cursor.next ? `Atualizar para ${cursor.next.name}` : 'Concluir fluxo'}</Button>}
      </div>
      <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${workflow.steps.length}, minmax(0, 1fr))` }}>
        {workflow.steps.map((step, index) => {
          const color = stepColor(step, index);
          const done = cursor.finished || index < cursor.cursor;
          const current = index === cursor.currentIndex;
          const upcoming = !cursor.finished && index === cursor.cursor + 1;
          const actionable = upcoming && canAdvance;
          const mark = stamp(step.id);
          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!actionable}
                onClick={request}
                title={done ? mark.title || step.name : current ? 'Etapa atual' : actionable ? 'Informe uma observação para avançar' : 'Bloqueada'}
                aria-current={current ? 'step' : undefined}
                className="h-full w-full min-w-0 overflow-hidden rounded-md border px-1.5 py-1.5 text-left disabled:cursor-default"
                style={done || current ? { background: color, color: ink(color), borderColor: color } : { borderColor: upcoming ? color : undefined, opacity: actionable ? 1 : 0.55 }}
              >
                <span className="flex items-center justify-between gap-1 text-[9px] uppercase tracking-wide">
                  <span className="truncate">{current ? 'Atual' : done ? 'Ok' : upcoming ? 'Próxima' : 'Bloqueada'}</span>
                  {done || current ? <Check className="h-3 w-3 shrink-0" /> : <Lock className="h-3 w-3 shrink-0" />}
                </span>
                <span className="mt-1 block line-clamp-2 text-[11px] font-semibold leading-tight">{step.name}</span>
                {done && mark.text && <span className="mt-0.5 block truncate text-[9px] opacity-80">{mark.text}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <StageAdvanceDialog open={open} note={note} onNote={setNote} onClose={close} onConfirm={confirm} current={cursor.current} next={cursor.next} currentColor={stageTone(cursor.current, cursor.currentIndex)} nextColor={stageTone(cursor.next, cursor.currentIndex + 1)} when={when} />
    </section>
  );
}

export type OrderLine = { id: string; name: string; code: string; qty: number; unit: string; available: number; price: number; note: string; approved?: number; picked?: number; shipped?: number; received?: number };
type SortKey = 'name' | 'qty' | 'available' | 'approved' | 'picked' | 'shipped' | 'received' | 'price' | 'total' | 'note';

export function OrderLines({ lines, operational = false, control }: { lines: OrderLine[]; operational?: boolean; control?: (line: OrderLine) => ReactNode }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const needle = query.trim().toLowerCase();
  const filtered = lines.filter((line) => !needle || `${line.code} ${line.name} ${line.note}`.toLowerCase().includes(needle));
  const value = (line: OrderLine, key: SortKey) => key === 'name' ? line.name : key === 'note' ? line.note : key === 'total' ? line.qty * line.price : key === 'approved' ? line.approved ?? 0 : key === 'picked' ? line.picked ?? 0 : key === 'shipped' ? line.shipped ?? 0 : key === 'received' ? line.received ?? 0 : line[key];
  const rows = [...filtered].sort((a, b) => { const left = value(a, sort.key); const right = value(b, sort.key); const result = typeof left === 'string' ? left.localeCompare(right as string, 'pt-BR') : (left as number) - (right as number); return sort.dir === 'asc' ? result : -result; });
  const toggle = (key: SortKey) => setSort((current) => ({ key, dir: current.key === key && current.dir === 'asc' ? 'desc' : 'asc' }));
  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: 'name', label: 'Material' },
    { key: 'qty', label: 'Qtd. solicitada', align: 'text-right' },
    { key: 'available', label: 'Disponível', align: 'text-right' },
    ...(operational ? [{ key: 'approved' as const, label: 'Aprov.', align: 'text-right' }, { key: 'picked' as const, label: 'Separ.', align: 'text-right' }, { key: 'shipped' as const, label: 'Exped.', align: 'text-right' }, { key: 'received' as const, label: 'Receb.', align: 'text-right' }] : []),
    { key: 'price', label: 'Preço unit.', align: 'text-right' },
    { key: 'total', label: 'Total', align: 'text-right' },
    { key: 'note', label: 'Observação' },
  ];
  const total = rows.reduce((sum, line) => sum + line.qty * line.price, 0);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Itens do pedido</h3>
        <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Filtrar itens" className="pl-9" placeholder="Código, nome ou observação" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </div>
      <p className="text-xs text-muted-foreground">{rows.length} de {lines.length} itens. Clique no título da coluna para ordenar.</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-3 py-2 font-medium ${column.align ?? 'text-left'}`}>
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggle(column.key)}>{column.label}{sort.key === column.key && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button>
                </th>
              ))}
              {control && <th className="px-3 py-2 text-left font-medium">Agora</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="px-3 py-2"><div className="font-medium">{line.name}</div><div className="text-xs text-muted-foreground">{line.code}</div></td>
                <td className="px-3 py-2 text-right">{line.qty} {line.unit}</td>
                <td className="px-3 py-2 text-right">{line.available}</td>
                {operational && <><td className="px-3 py-2 text-right">{line.approved ?? 0}</td><td className="px-3 py-2 text-right">{line.picked ?? 0}</td><td className="px-3 py-2 text-right">{line.shipped ?? 0}</td><td className="px-3 py-2 text-right">{line.received ?? 0}</td></>}
                <td className="px-3 py-2 text-right">{brl(line.price)}</td>
                <td className="px-3 py-2 text-right font-medium">{brl(line.qty * line.price)}</td>
                <td className="px-3 py-2 text-muted-foreground">{line.note || 'Sem observação'}</td>
                {control && <td className="px-3 py-2">{control(line)}</td>}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={columns.length + (control ? 1 : 0)} className="px-3 py-8 text-center text-muted-foreground">Nenhum item encontrado.</td></tr>}
          </tbody>
          {!!rows.length && <tfoot><tr className="border-t border-border"><td colSpan={columns.length - 3} /><td className="px-3 py-2 text-right text-xs text-muted-foreground">Total</td><td className="px-3 py-2 text-right font-semibold text-emerald-600">{brl(total)}</td><td colSpan={control ? 2 : 1} /></tr></tfoot>}
        </table>
      </div>
    </section>
  );
}
