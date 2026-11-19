import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProcurementSession as useSession, branchName, usePurchasing, poLabels, addQuote, approvePo, sendPo } from "@/lib/procurement-live";
import { materials, getMaterial, brl, useStock } from "@/lib/stock-live";
import { Star, Plus } from "lucide-react";
import { PurchaseReceivingWizard } from '@/components/purchase-receiving-wizard';
import { PurchaseCreationWizard } from '@/components/purchase-creation-wizard';
import { ProcurementContext } from '@/components/procurement-context';
import { PurchaseTrace } from '@/components/purchase-trace';
import { rankQuotes } from '@/lib/procurement-rules';
import type { PurchaseOrder } from '@/lib/purchasing';

export const Route = createFileRoute("/compras")({
  head: () => ({ meta: [
    { title: "Compras e Fornecedores | Grupo Sorrisos" },
    { name: "description", content: "Requisições, cotações, ordens de compra, recebimento e cadastro de fornecedores." },
    { property: "og:title", content: "Compras e Fornecedores | Grupo Sorrisos" },
    { property: "og:description", content: "Gestão de compras e fornecedores." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ComprasPage,
});

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
function ComprasPage() {
  useStock();
  const { pos, sup } = usePurchasing(); const ses = useSession();
  const canBuy = ses.can("compras.gerenciar");
  const [trace, setTrace] = useState<string | null>(null);
  const [mode, setMode] = useState<'cost' | 'balanced'>('cost');
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [creating, setCreating] = useState<'requisition' | 'supplier' | null>(null);
  const [quote, setQuote] = useState<{ supplierId: string; price: number | ''; days: string; freight: number | '' }>({ supplierId: "s1", price: "", days: "5", freight: 0 });
  const [reqMat, setReqMat] = useState(materials[0]?.id ?? ""); const [reqQty, setReqQty] = useState(50);
  const [ns, setNs] = useState({ name: "", cnpj: "", contact: "", email: "" });
  const t = (e: string | null | Promise<string | null>, m: string) => { void Promise.resolve(e).then((error) => error ? toast.error(error) : toast.success(m)); };
  const quoteSupplier = sup.some((supplier) => supplier.id === quote.supplierId) ? quote.supplierId : sup[0]?.id ?? "";
  return (
    <AppShell title="Compras e Fornecedores" subtitle="Requisição → Cotação → Aprovação → Pedido → Recebimento → Entrada no estoque" primaryAction={null}>
      <div className="p-4 md:p-8">
        {!canBuy && <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 text-sm p-3">Seu perfil só pode consultar compras.</div>}
        <Tabs defaultValue="oc">
          <TabsList><TabsTrigger value="oc">Ordens de compra</TabsTrigger><TabsTrigger value="forn">Fornecedores</TabsTrigger></TabsList>
          <TabsContent value="oc" className="space-y-4">
            {canBuy && <div className="flex justify-end"><Button size="sm" onClick={() => setCreating('requisition')}><Plus className="h-4 w-4 mr-1" />Nova requisição</Button></div>}
            {pos.filter(p => ses.scope.includes(p.branchId)).map(p => (
              <Card key={p.id} className="p-5 space-y-3">
                <div className="flex flex-wrap justify-between gap-2"><div><span className="font-mono text-sm">{p.number}</span> <span className="text-sm text-muted-foreground">· {branchName(p.branchId)} · {p.createdAt.split("-").reverse().join("/")}</span></div><Badge variant="outline">{poLabels[p.status]}</Badge></div>
                {p.items.map(i => (
                  <div key={i.materialId} className="rounded-md border border-border p-3 text-sm space-y-2">
                    <div className="flex justify-between"><span className="font-medium">{getMaterial(i.materialId).name}</span><span>{i.received}/{i.qty} {getMaterial(i.materialId).unit}</span></div>
                    <div className="flex flex-wrap gap-2">{i.quotes.length === 0 && <span className="text-muted-foreground text-xs">Sem cotações</span>}
                      {rankQuotes(i.quotes, i.qty, sup, mode).map(q => <Badge key={q.supplierId} variant="outline" className={i.chosen === q.supplierId ? "bg-success/10 text-success border-success/30" : ""}>{sup.find(s => s.id === q.supplierId)?.name}: {brl(q.unitPrice)} · {q.days}d · total {brl(q.total)} · avaliação {q.rating}</Badge>)}</div>
                    {canBuy && (p.status === "requisicao" || p.status === "cotacao") && <div className="flex flex-wrap gap-2 items-center">
                      <select className={sel} value={quoteSupplier} onChange={e => setQuote({ ...quote, supplierId: e.target.value })}>{sup.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                      <CurrencyInput aria-label={`Preço unitário ${getMaterial(i.materialId).name}`} className="w-36 h-9" value={quote.price} onValueChange={price => setQuote({ ...quote, price })} />
                      <CurrencyInput aria-label={`Frete ${getMaterial(i.materialId).name}`} className="w-36 h-9" value={quote.freight} onValueChange={freight => setQuote({ ...quote, freight })} /><Input placeholder="Prazo" className="w-20 h-9" value={quote.days} onChange={e => setQuote({ ...quote, days: e.target.value })} />
                      <Button size="sm" variant="outline" onClick={() => Number(quote.price) > 0 && quoteSupplier ? t(addQuote(p.id, i.materialId, { supplierId: quoteSupplier, unitPrice: Number(quote.price), days: Number(quote.days), freight: Number(quote.freight) }), "Cotação registrada") : toast.error("Informe o preço")}>Registrar cotação</Button>
                    </div>}
                  </div>
                ))}
                <ProcurementContext branchId={p.branchId} excludeId={p.id} items={p.items.map(i => ({ materialId: i.materialId, requested: i.qty, unitPrice: i.quotes.find(q => q.supplierId === i.chosen)?.unitPrice ?? rankQuotes(i.quotes, i.qty, sup, mode)[0]?.unitPrice }))} /><Button variant="outline" size="sm" onClick={() => setTrace(p.id)}>Visão completa do pedido</Button>{canBuy && <div className="flex flex-wrap gap-2">
                  {(p.status === "requisicao" || p.status === "cotacao") && <><select aria-label="Critério de comparação" className={sel} value={mode} onChange={e => setMode(e.target.value as 'cost' | 'balanced')}><option value="cost">Menor custo com frete</option><option value="balanced">Custo, prazo e avaliação</option></select><Button size="sm" onClick={() => t(approvePo(p.id, mode), "Cotação aprovada")}>Aprovar cotação selecionada</Button></>}
                  {p.status === "aprovado" && <Button size="sm" onClick={() => t(sendPo(p.id), "Ordem enviada ao fornecedor")}>Enviar ao fornecedor</Button>}
                  {(p.status === "enviado" || p.status === "recebido_parcial") && <Button size="sm" onClick={() => setReceiving(p)}>Conferir recebimento</Button>}
                </div>}
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="forn" className="space-y-4">
            {canBuy && <div className="flex justify-end"><Button size="sm" onClick={() => setCreating('supplier')}><Plus className="h-4 w-4 mr-1" />Novo fornecedor</Button></div>}
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sup.map(s => <Card key={s.id} className="p-5 space-y-1 text-sm">
                <div className="font-semibold">{s.name}</div><div className="text-muted-foreground">{s.cnpj}</div>
                <div>{s.contact} · {s.email}</div>
                <div className="flex items-center gap-3 text-muted-foreground"><span className="flex items-center gap-1"><Star className="h-3 w-3" />{s.rating}</span><span>Prazo médio {s.leadDays} dias</span></div>
                <div className="flex flex-wrap gap-1 pt-1">{s.categories.map(c => <Badge key={c} variant="outline">{c}</Badge>)}</div>
              </Card>)}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {trace && <PurchaseTrace id={trace} onClose={() => setTrace(null)} />}{receiving && <PurchaseReceivingWizard order={receiving} onClose={() => setReceiving(null)} />}
      {creating && <PurchaseCreationWizard kind={creating} onClose={() => setCreating(null)} />}
    </AppShell>
  );
}
