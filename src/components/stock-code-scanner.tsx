import { useEffect, useRef, useState } from 'react';
import { ScanLine, Camera, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { materials } from '@/lib/stock';
import { resolveCode } from '@/lib/stock-intelligence';
import { toast } from 'sonner';
export function StockCodeScanner({ onMaterial }: { onMaterial: (id: string) => void }) {
  const [code, setCode] = useState(''), [active, setActive] = useState(false), [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null), control = useRef<{ stop: () => void } | null>(null), alive = useRef(true);
  const select = (value: string) => { const m = resolveCode(value, materials); if (!m) { toast.error('Código não encontrado'); return; } onMaterial(m.id); setCode(''); toast.success(m.name); };
  const stop = () => { alive.current = false; control.current?.stop(); control.current = null; const stream = video.current?.srcObject; if (stream instanceof MediaStream) stream.getTracks().forEach(t => t.stop()); setActive(false); };
  useEffect(() => () => { alive.current = false; control.current?.stop(); }, []);
  const start = async () => {
    alive.current = true; setActive(true); setBusy(true);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (!alive.current || !video.current) return;
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video.current, (result, _, controls) => {
        if (result && alive.current) { alive.current = false; controls.stop(); setActive(false); select(result.getText()); }
      });
      if (!alive.current) controls.stop(); else control.current = controls;
    } catch { toast.error('Câmera indisponível. Use o código ou leitor conectado.'); stop(); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3"><div className="flex flex-wrap gap-2"><div className="relative flex-1 min-w-40"><ScanLine className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Código do material" placeholder="Código de barras / QR / SKU" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); select(code); } }} /></div><Button variant="outline" disabled={!code.trim()} onClick={() => select(code)}>Localizar</Button><Button variant="outline" title={active ? 'Parar câmera' : 'Ler com câmera'} aria-label={active ? 'Parar câmera' : 'Ler com câmera'} disabled={busy} onClick={active ? stop : start}>{active ? <Square className="h-4 w-4" /> : <Camera className="h-4 w-4" />}</Button></div><video ref={video} playsInline muted className={active ? 'w-full max-h-52 rounded-lg bg-muted object-contain' : 'hidden'} /></div>;
}
