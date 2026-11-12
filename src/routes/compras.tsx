import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession, branchName } from "@/lib/erp";
import { materials, getMaterial, brl } from "@/lib/stock";
import { usePurchasing, poLabels, addQuote, approvePo, sendPo, receivePo, addSupplier, createRequisition } from "@/lib/purchasing";
import { Star, Plus } from "lucide-react";
import { PurchaseReceivingWizard } from '@/components/purchase-receiving-wizard';
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
  const { pos, sup } = usePurchasing(); const ses = useSession();
  const canBuy = ses.can("compras.gerenciar");
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [quote, setQuote] = useState({ supplierId: "s1", price: "", days: "5" });
  const [reqMat, setReqMat] = useState(materials[0].id); const [reqQty, setReqQty] = useState(50);
  const [ns, setNs] = useState({ name: "", cnpj: "", contact: "", email: "" });
  const t = (e: string | null, m: string) => e ? toast.error(e) : toast.success(m);
  return (
    <AppShell title="Compras e Fornecedores" subtitle="Requisição → Cotação → Aprovação → Pedido → Recebimento → Entrada no estoque" primaryAction={null}>
      <div className="p-4 md:p-8">
        {!canBuy && <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 text-sm p-3">Seu perfil só pode consultar compras.</div>}
        <Tabs defaultValue="oc">
          <TabsList><TabsTrigger value="oc">Ordens de compra</TabsTrigger><TabsTrigger value="forn">Fornecedores</TabsTrigger></TabsList>
          <TabsContent value="oc" className="space-y-4">
            {canBuy && <Card className="p-4 flex flex-wrap items-end gap-2">
              <div className="text-sm font-medium w-full">Nova requisição para o Centro de Distribuição</div>
              <select className={sel} value={reqMat} onChange={e => setReqMat(e.target.value)}>{materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              <Input type="number" className="w-28 h-9" value={reqQty} onChange={e => setReqQty(Number(e.target.value))} />
              <Button size="sm" onClick={() => t(createRequisition("cd", [{ materialId: reqMat, qty: reqQty }]), "Requisição criada")}><Plus className="h-4 w-4 mr-1" />Criar requisição</Button>
            </Card>}
            {pos.map(p => (
              <Card key={p.id} className="p-5 space-y-3">
                <div className="flex flex-wrap justify-between gap-2"><div><span className="font-mono text-sm">{p.number}</span> <span className="text-sm text-muted-foreground">· {branchName(p.branchId)} · {p.createdAt.split("-").reverse().join("/")}</span></div><Badge variant="outline">{poLabels[p.status]}</Badge></div>
                {p.items.map(i => (
                  <div key={i.materialId} className="rounded-md border border-border p-3 text-sm space-y-2">
                    <div className="flex justify-between"><span className="font-medium">{getMaterial(i.materialId).name}</span><span>{i.received}/{i.qty} {getMaterial(i.materialId).unit}</span></div>
                    <div className="flex flex-wrap gap-2">{i.quotes.length === 0 && <span className="text-muted-foreground text-xs">Sem cotações</span>}
                      {i.quotes.map(q => <Badge key={q.supplierId} variant="outline" className={i.chosen === q.supplierId ? "bg-success/10 text-success border-success/30" : ""}>{sup.find(s => s.id === q.supplierId)?.name}: {brl(q.unitPrice)} · {q.days}d</Badge>)}</div>
                    {canBuy && (p.status === "requisicao" || p.status === "cotacao") && <div className="flex flex-wrap gap-2 items-center">
                      <select className={sel} value={quote.supplierId} onChange={e => setQuote({ ...quote, supplierId: e.target.value })}>{sup.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                      <Input placeholder="Preço unit." className="w-28 h-9" value={quote.price} onChange={e => setQuote({ ...quote, price: e.target.value })} />
                      <Input placeholder="Prazo" className="w-20 h-9" value={quote.days} onChange={e => setQuote({ ...quote, days: e.target.value })} />
                      <Button size="sm" variant="outline" onClick={() => Number(quote.price) > 0 ? t(addQuote(p.id, i.materialId, { supplierId: quote.supplierId, unitPrice: Number(quote.price), days: Number(quote.days) }), "Cotação registrada") : toast.error("Informe o preço")}>Registrar cotação</Button>
                    </div>}
                  </div>
                ))}
                {canBuy && <div className="flex gap-2">
                  {(p.status === "requisicao" || p.status === "cotacao") && <Button size="sm" onClick={() => t(approvePo(p.id), "Aprovado com a melhor cotação")}>Aprovar melhor preço</Button>}
                  {p.status === "aprovado" && <Button size="sm" onClick={() => t(sendPo(p.id), "Ordem enviada ao fornecedor")}>Enviar ao fornecedor</Button>}
                  {(p.status === "enviado" || p.status === "recebido_parcial") && <Button size="sm" onClick={() => setReceiving(p)}>Conferir recebimento</Button>}
                </div>}
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="forn" className="space-y-4">
            {canBuy && <Card className="p-4 flex flex-wrap gap-2 items-end">
              {(["name", "cnpj", "contact", "email"] as const).map(k => <Input key={k} className="w-48 h-9" placeholder={{ name: "Nome", cnpj: "CNPJ", contact: "Contato", email: "E-mail" }[k]} value={ns[k]} onChange={e => setNs({ ...ns, [k]: e.target.value })} />)}
              <Button size="sm" onClick={() => { const e = addSupplier({ ...ns, leadDays: 5, rating: 4, categories: [] }); t(e, "Fornecedor cadastrado"); if (!e) setNs({ name: "", cnpj: "", contact: "", email: "" }); }}><Plus className="h-4 w-4 mr-1" />Cadastrar</Button>
            </Card>}
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
      {receiving && <PurchaseReceivingWizard order={receiving} onClose={() => setReceiving(null)} />}
    </AppShell>
  );
}
