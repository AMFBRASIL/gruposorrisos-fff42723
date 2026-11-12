import { z } from 'zod';

export const portalItemSchema = z.object({ materialId: z.string().min(1), requested: z.number().finite().positive().max(1e9), unitPrice: z.number().finite().nonnegative().max(1e9).optional(), supplierCode: z.string().max(100).optional() });
export const portalPayloadSchema = z.object({ supplierName: z.string().min(1).max(200), branchName: z.string().min(1).max(200), desiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), priority: z.string().max(30), notes: z.string().max(2000), items: z.array(portalItemSchema.extend({ name: z.string().min(1).max(300), code: z.string().min(1).max(100), unit: z.string().min(1).max(50), barcode: z.string().max(100).optional() })).min(1).max(2000) });
export type PortalPayload = z.infer<typeof portalPayloadSchema>;
export type PortalResponse = { id: string; items: z.infer<typeof portalItemSchema>[]; notes: string; file_name: string | null; created_at: string };
export type PortalRequest = { id: string; supplier_id: string; number: string; payload: PortalPayload; status: string; created_at: string; responses: PortalResponse[] };
export function validatePortalPrices(request: Pick<PortalRequest, 'status' | 'payload'>, items: z.infer<typeof portalItemSchema>[]) {
  if (!['aguardando', 'correcao'].includes(request.status)) return 'Pedido não está aberto para resposta';
  if (items.length !== request.payload.items.length || new Set(items.map(i => i.materialId)).size !== items.length) return 'Informe todos os materiais uma única vez';
  if (items.some(i => !portalItemSchema.safeParse(i).success || i.unitPrice === undefined || !request.payload.items.some(e => e.materialId === i.materialId && e.requested === i.requested))) return 'Confira materiais, quantidades e preços';
  return null;
}