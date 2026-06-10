import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme, themeStore } from "@/lib/store";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [
    { title: "Configurações — Grupo Sorrisos Tasks" },
    { name: "description", content: "Preferências do sistema." },
  ]}),
  component: SettingsPage,
});

function SettingsPage() {
  const theme = useTheme();
  return (
    <AppShell title="Configurações" subtitle="Preferências da plataforma">
      <div className="p-4 md:p-8 max-w-3xl space-y-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-1">Aparência</h3>
          <p className="text-xs text-muted-foreground mb-4">Personalize o tema da plataforma</p>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="dark">Tema escuro</Label>
              <p className="text-xs text-muted-foreground">Use o modo escuro durante o dia ou noite</p>
            </div>
            <Switch id="dark" checked={theme === "dark"} onCheckedChange={() => themeStore.toggle()} />
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-1">Notificações</h3>
          <p className="text-xs text-muted-foreground mb-4">Como você quer ser notificado</p>
          <div className="space-y-3">
            {[
              { id: "email", label: "Email", desc: "Receber alertas e resumos por email" },
              { id: "system", label: "Sistema", desc: "Notificações dentro da plataforma" },
              { id: "wpp", label: "WhatsApp (em breve)", desc: "Integração via API oficial" },
              { id: "summary", label: "Resumo semanal", desc: "Toda segunda-feira às 08h" },
            ].map(o => (
              <div key={o.id} className="flex items-center justify-between border-t border-border pt-3 first:border-0 first:pt-0">
                <div><Label>{o.label}</Label><p className="text-xs text-muted-foreground">{o.desc}</p></div>
                <Switch defaultChecked={o.id !== "wpp"} disabled={o.id === "wpp"} />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-1">Perfil</h3>
          <p className="text-xs text-muted-foreground mb-4">Suas informações</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Nome</Label><Input defaultValue="Maria Silva" className="mt-1.5" /></div>
            <div><Label>Email</Label><Input defaultValue="maria@gruposorrisos.com" className="mt-1.5" /></div>
            <div><Label>Cargo</Label><Input defaultValue="Gerente" className="mt-1.5" /></div>
            <div><Label>Departamento</Label><Input defaultValue="Operações" className="mt-1.5" /></div>
          </div>
          <div className="flex justify-end mt-4"><Button>Salvar alterações</Button></div>
        </Card>
      </div>
    </AppShell>
  );
}
