import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Grupo Sorrisos Tasks" },
      { name: "description", content: "Acesse a plataforma de gestão de tarefas do Grupo Sorrisos." },
    { property: "og:title", content: "Entrar — Grupo Sorrisos Tasks" },
    { property: "og:description", content: "Acesse a plataforma de gestão de tarefas do Grupo Sorrisos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("maria@gruposorrisos.com");
  const [password, setPassword] = useState("••••••••");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => navigate({ to: "/" }), 700);
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background text-foreground">
      {/* Left — form */}
      <div className="flex flex-col px-6 sm:px-10 lg:px-16 py-8 lg:py-10">
        <header className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-5 text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20">
            GS
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Grupo | Sorrisos</div>
            <div className="text-xs text-muted-foreground">Plataforma Gestão</div>
          </div>
        </header>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-md mx-auto">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium mb-5">
              <Sparkles className="h-3 w-3" /> Bem-vindo de volta
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Acesse sua conta</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Gerencie as demandas da sua equipe com clareza e velocidade.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-7">
              <Button variant="outline" type="button" className="h-11">
                <GoogleIcon className="h-4 w-4 mr-2" /> Google
              </Button>
              <Button variant="outline" type="button" className="h-11">
                <MicrosoftIcon className="h-4 w-4 mr-2" /> Microsoft
              </Button>
            </div>

            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">ou com email</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email corporativo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-9 h-11" placeholder="voce@gruposorrisos.com" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link to="/login" className="text-xs text-primary hover:underline">Esqueci minha senha</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="pl-9 pr-10 h-11" required />
                  <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Mostrar/esconder senha">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox defaultChecked id="remember" />
                <span>Manter conectado por 30 dias</span>
              </label>

              <Button type="submit" disabled={loading} className="w-full h-11 text-sm font-semibold group">
                {loading ? "Entrando..." : <>Entrar <ArrowRight className="h-4 w-4 ml-1.5 transition-transform group-hover:translate-x-0.5" /></>}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Novo no Grupo Sorrisos? <a href="#" className="text-primary font-medium hover:underline">Solicite acesso</a>
            </p>
          </div>
        </div>

        <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground mt-6">
          <span>© 2026 Grupo Sorrisos · Todos os direitos reservados</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground">Privacidade</a>
            <a href="#" className="hover:text-foreground">Termos</a>
            <a href="#" className="hover:text-foreground">Suporte</a>
          </div>
        </footer>
      </div>

      {/* Right — visual */}
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-primary via-chart-5 to-chart-2 text-primary-foreground">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.25) 0%, transparent 45%)",
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }} />

        {/* floating cards */}
        <div className="absolute top-16 right-12 w-72 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-4 shadow-2xl rotate-3 animate-[float_6s_ease-in-out_infinite]">
          <div className="flex items-center gap-2 text-xs opacity-80 mb-2">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Implantação Sorocaba
          </div>
          <div className="text-sm font-semibold mb-3">Negociar contrato de locação</div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex -space-x-1.5">
              <div className="h-6 w-6 rounded-full bg-rose-400 border-2 border-white/30 flex items-center justify-center text-[10px] font-bold">MS</div>
              <div className="h-6 w-6 rounded-full bg-indigo-400 border-2 border-white/30 flex items-center justify-center text-[10px] font-bold">JP</div>
            </div>
            <span className="bg-white/20 rounded px-1.5 py-0.5 font-semibold">URGENTE</span>
          </div>
        </div>

        <div className="absolute bottom-32 right-32 w-64 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-4 shadow-2xl -rotate-2 animate-[float_7s_ease-in-out_infinite_1s]">
          <div className="text-xs opacity-80 mb-1">Saúde do projeto</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">84</span>
            <span className="text-xs opacity-80">/ 100</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full w-[84%] bg-gradient-to-r from-emerald-300 to-white rounded-full" />
          </div>
        </div>

        <div className="absolute bottom-10 left-16 w-56 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-3 shadow-2xl rotate-2 animate-[float_8s_ease-in-out_infinite_0.5s]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center"><Zap className="h-4 w-4" /></div>
            <div className="text-xs">
              <div className="font-semibold">+42% produtividade</div>
              <div className="opacity-80">últimos 30 dias</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col justify-end p-12 max-w-xl">
          <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
            A operação do Grupo Sorrisos, em um único lugar.
          </h2>
          <p className="mt-4 text-base opacity-90 leading-relaxed">
            Kanban, automações, calendário e relatórios executivos. Tudo conectado para que sua equipe entregue mais — com menos esforço.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 shrink-0" /> Autenticação 2FA e login com Google ou Microsoft</li>
            <li className="flex items-center gap-3"><Zap className="h-4 w-4 shrink-0" /> Tempo real, notificações e automações inteligentes</li>
            <li className="flex items-center gap-3"><Sparkles className="h-4 w-4 shrink-0" /> Indicador de saúde do projeto com IA</li>
          </ul>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); }
          50% { transform: translateY(-12px) rotate(var(--r, 0deg)); }
        }
      `}</style>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"/></svg>
  );
}
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24"><path fill="#F25022" d="M2 2h10v10H2z"/><path fill="#7FBA00" d="M12 2h10v10H12z"/><path fill="#00A4EF" d="M2 12h10v10H2z"/><path fill="#FFB900" d="M12 12h10v10H12z"/></svg>
  );
}
