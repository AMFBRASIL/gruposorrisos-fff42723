import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export function ConfirmActionDialog({ name, onClose, onConfirm }: { name: string | null; onClose: () => void; onConfirm: () => void }) {
  return <Dialog open={name !== null} onOpenChange={open => !open && onClose()}><DialogContent><DialogHeader><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></div><DialogTitle>Confirmar remoção</DialogTitle><DialogDescription>Deseja remover “{name}”?</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button variant="destructive" onClick={() => { onConfirm(); onClose(); }}>Remover</Button></DialogFooter></DialogContent></Dialog>;
}