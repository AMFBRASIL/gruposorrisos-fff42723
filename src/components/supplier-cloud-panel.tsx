import { Link } from '@tanstack/react-router';
import type { SupplierRequest } from '@/lib/supplier-orders';
import { Button } from './ui/button';

export function SupplierCloudPanel({ supplierName }: { supplierId: string; supplierName: string; requests: SupplierRequest[] }) {
  return <section className="border-t border-border pt-6 space-y-4"><h3 className="font-semibold">Portal de {supplierName}</h3><p className="text-sm text-muted-foreground">Demonstração · dados temporários, sem gravação</p><Button asChild variant="outline"><Link to="/portal-fornecedor">Abrir portal do fornecedor</Link></Button></section>;
}
