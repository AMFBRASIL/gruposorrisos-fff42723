import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { portalItemSchema, portalPayloadSchema, type PortalRequest } from './supplier-portal';

export const listPortalRequests = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('supplier_portal_requests').select('*, responses:supplier_portal_responses(id,items,notes,file_name,created_at)').order('created_at', { ascending: false });
  if (error) throw new Error('Não foi possível carregar os pedidos');
  return (data ?? []).map(r => ({ ...r, payload: portalPayloadSchema.parse(r.payload), responses: r.responses.map(v => ({ ...v, items: z.array(portalItemSchema).parse(v.items) })) })) satisfies PortalRequest[];
});
export const procurementAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('is_procurement_user');
  if (error) throw new Error('Não foi possível verificar seu acesso');
  return data === true;
});
export const publishPortalRequest = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).validator(z.object({ id: z.string().uuid(), supplierId: z.string().min(1), number: z.string().min(1).max(100), payload: portalPayloadSchema })).handler(async ({ context, data }) => {
  const { data: allowed, error: roleError } = await context.supabase.rpc('is_procurement_user');
  if (roleError || !allowed) throw new Error('Sua conta não possui o perfil de Compras');
  // Ignore duplicate retries without overwriting an answered request.
  const { error } = await context.supabase.from('supplier_portal_requests').upsert({ id: data.id, supplier_id: data.supplierId, number: data.number, payload: data.payload, status: 'aguardando' }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error('Não foi possível publicar o pedido');
  return { id: data.id };
});
export const answerPortalRequest = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).validator(z.object({ id: z.string().uuid(), items: z.array(portalItemSchema.extend({ unitPrice: z.number().finite().nonnegative().max(1e9) })).min(1).max(2000), notes: z.string().max(2000), file: z.string().max(255).optional() })).handler(async ({ context, data }) => {
  // The database locks the request and validates membership, items and state atomically.
  const { error } = await context.supabase.rpc('submit_supplier_prices', { p_request_id: data.id, p_items: data.items, p_notes: data.notes, p_file: data.file });
  if (error) throw new Error('Não foi possível enviar: confira seu vínculo, os itens e a situação atual do pedido');
  return { ok: true };
});
export const reviewPortalResponse = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).validator(z.object({ id: z.string().uuid(), status: z.enum(['correcao', 'aprovado']) })).handler(async ({ context, data }) => {
  const { error } = await context.supabase.rpc('review_supplier_response', { p_request_id: data.id, p_status: data.status });
  if (error) throw new Error('Não foi possível atualizar a conferência');
  return { ok: true };
});
export const inviteSupplier = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).validator(z.object({ email: z.string().email().max(254), supplierId: z.string().min(1).max(100), origin: z.string().url() })).handler(async ({ context, data }) => {
  const { data: allowed, error: roleError } = await context.supabase.rpc('is_procurement_user');
  if (roleError || !allowed) throw new Error('Somente o perfil de Compras pode criar acessos');
  const origin = new URL(data.origin);
  if (!['https://gruposorrisos.lovable.app', 'https://id-preview--81cf76c7-0dbc-4286-872b-12be42022f4e.lovable.app', 'http://localhost:8080'].includes(origin.origin)) throw new Error('Endereço de convite inválido');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${origin.origin}/reset-password` });
  if (error || !invited.user) throw new Error('Não foi possível convidar. Confira o e-mail; contas existentes devem ser vinculadas pelo responsável de acesso.');
  const { error: membershipError } = await supabaseAdmin.from('supplier_memberships').insert({ user_id: invited.user.id, supplier_id: data.supplierId });
  if (membershipError) throw new Error('Convite enviado, mas o vínculo falhou. O acesso aos pedidos continua bloqueado; solicite ao responsável o vínculo da conta.');
  return { ok: true };
});