import { useState } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { KeyRound, LogIn } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function SupplierAuthForm({ destination, onEnter }: { destination: '/portal-fornecedor' | '/portal-cliente' | '/fornecedores'; onEnter?: () => void }) {
  const navigate = useNavigate(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const busy = false;
  async function enter() { if (onEnter) onEnter(); else await navigate({ to: destination, replace: true }); }
  async function login(e: React.FormEvent) { e.preventDefault(); await enter(); }
  async function reset() { toast.info('Recuperação de senha demonstrativa. Nenhum e-mail foi enviado.'); }
  return <form onSubmit={login} className="space-y-4 max-w-md"><label className="block text-sm font-medium">E-mail<Input aria-label="E-mail de acesso" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-11" /></label><label className="block text-sm font-medium">Senha<Input aria-label="Senha de acesso" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-11" /></label><Button type="button" variant="outline" className="w-full" onClick={() => void enter()}>Acessar demonstração</Button><Button disabled={busy} type="submit" className="w-full gap-2"><LogIn className="h-4 w-4" />{busy ? 'Aguarde...' : 'Entrar'}</Button><Button disabled={busy} type="button" variant="ghost" onClick={() => void reset()} className="gap-2"><KeyRound className="h-4 w-4" />Esqueci minha senha</Button>{destination === '/portal-fornecedor' && <p className="text-xs text-muted-foreground">Acesso demonstrativo.<Link to="/auth" className="block text-primary mt-2">Acesso da equipe de Compras</Link></p>}</form>;
}