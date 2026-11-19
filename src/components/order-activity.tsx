import { useState } from 'react';
import { History, Send } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { userName } from '@/lib/procurement-live';
import type { WorkflowEvent } from '@/lib/order-workflow';

function when(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString('pt-BR')} · ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function OrderActivity({ events, initialNotes, onComment }: { events: WorkflowEvent[]; initialNotes: string; onComment: (text: string) => boolean | Promise<boolean> }) {
  const [text, setText] = useState('');
  const [history, setHistory] = useState(false);
  const comments = events.filter((event) => event.action === 'Observação adicionada');
  const send = () => { void Promise.resolve(onComment(text)).then((ok) => { if (ok) setText(''); }); };
  return (
    <section className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h3 className="font-semibold">Informações ao fornecedor</h3>
        <p className="mt-1 text-xs text-muted-foreground">Cada inclusão entra como uma nova linha, com data, horário e quem escreveu.</p>
      </div>
      <ol className="space-y-2">
        {initialNotes && <li className="rounded-lg bg-muted/40 px-3 py-2 text-sm"><div className="text-xs text-muted-foreground">Observação inicial</div><p className="mt-1 whitespace-pre-wrap">{initialNotes}</p></li>}
        {comments.map((event, index) => (
          <li key={`${event.at}-${index}`} className="rounded-lg border border-border px-3 py-2">
            <div className="text-xs text-muted-foreground">{when(event.at)} · {userName(event.userId)}</div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{event.note}</p>
          </li>
        ))}
        {!initialNotes && !comments.length && <li className="text-sm text-muted-foreground">Nenhuma informação enviada ainda.</li>}
      </ol>
      <Textarea aria-label="Informação ao fornecedor" placeholder="Escreva uma informação para quem está cuidando deste pedido" maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} />
      <div className="flex justify-end"><Button disabled={!text.trim()} size="sm" onClick={send}><Send className="mr-2 h-4 w-4" />Incluir observação</Button></div>
      <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={() => setHistory((open) => !open)}><History className="h-4 w-4" />{history ? 'Ocultar histórico' : `Histórico (${events.length})`}</button>
      {history && <ol className="space-y-3 border-l border-border ml-2">{events.map((event, index) => <li key={`${event.at}-${index}`} className="pl-4"><div className="text-sm font-medium">{event.action}</div><div className="text-xs text-muted-foreground">{when(event.at)} · {userName(event.userId)}</div>{event.note && <p className="mt-1 whitespace-pre-wrap text-sm">{event.note}</p>}</li>)}{!events.length && <li className="pl-4 text-sm text-muted-foreground">Nenhum registro.</li>}</ol>}
    </section>
  );
}
