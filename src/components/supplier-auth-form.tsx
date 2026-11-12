import { useState } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { KeyRound, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function SupplierAuthForm({ destination }: { destination: '/portal-fornecedor' | '/fornecedores' }) {
  const navigate = useNavigate(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent) { e.preventDefault(); setBusy(true); const { error } = await supabase.auth.signInWithPassword({ email, password }); setBusy(false); if (error) return toast.error('Confira seu e-mail e senha'); await navigate({ to: destination, replace: true }); }
  async function reset() { if (!email) return toast.error('Informe seu e-mail'); setBusy(true); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); setBusy(false); if (error) toast.error('Não foi possível enviar o e-mail'); else toast.success('Confira seu e-mail para definir uma nova senha'); }
  return <form onSubmit={login} className="space-y-4 max-w-md"><label className="block text-sm font-medium">E-mail<Input aria-label="E-mail de acesso" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-11" /></label><label className="block text-sm font-medium">Senha<Input aria-label="Senha de acesso" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-11" /></label><Button disabled={busy} type="submit" className="w-full gap-2"><LogIn className="h-4 w-4" />{busy ? 'Aguarde...' : 'Entrar'}</Button><Button disabled={busy} type="button" variant="ghost" onClick={() => void reset()} className="gap-2"><KeyRound className="h-4 w-4" />Esqueci minha senha</Button>{destination === '/portal-fornecedor' && <p className="text-xs text-muted-foreground">Acesso liberado por Compras.<Link to="/auth" className="block text-primary mt-2">Acesso da equipe de Compras</Link></p>}</form>;
}