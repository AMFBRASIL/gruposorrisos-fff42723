import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, X, Send, Bot, Loader2 } from "lucide-react";
import { useProjects, useTasks, useUserProfiles } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { assistantReply } from "@/lib/ai-mock";

interface Msg { role: "user" | "assistant"; text: string; }

const SUGGESTIONS = [
  "Quais projetos estão em risco?",
  "O que devo fazer agora?",
  "Resumo semanal",
  "Como está a carga da equipe?",
];

function renderMarkdown(text: string) {
  // Mini markdown: **bold** + linhas
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={i} className="leading-relaxed">
        {parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>
        )}
      </div>
    );
  });
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Olá! Sou a **IA do Grupo Sorrisos**. Posso te ajudar a entender o status dos projetos, sugerir prioridades e gerar resumos. O que você quer saber?" },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const tasks = useTasks();
  const projects = useProjects();
  const users = useUserProfiles();
  const auth = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking]);

  const ask = (q: string) => {
    if (!q.trim()) return;
    setMsgs(m => [...m, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const reply = assistantReply(q, { tasks, projects, users, meId: auth.user?.id ?? users[0]?.id ?? "" });
      setMsgs(m => [...m, { role: "assistant", text: reply }]);
      setThinking(false);
    }, 600 + Math.random() * 500);
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-primary via-chart-5 to-primary text-primary-foreground shadow-2xl shadow-primary/40 hover:scale-110 transition-transform flex items-center justify-center group"
        aria-label="Abrir assistente IA"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6 group-hover:rotate-12 transition-transform" />}
        {!open && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-success border-2 border-background animate-pulse" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-8rem)] rounded-2xl border bg-card shadow-2xl flex flex-col overflow-hidden animate-fade-in">
          <div className="relative px-5 py-4 border-b bg-gradient-to-br from-primary/10 via-chart-5/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center text-primary-foreground shadow-lg">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-sm">Assistente IA</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Online · análise local
                </div>
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
                  {renderMarkdown(m.text)}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando dados...
                </div>
              </div>
            )}
          </div>

          {msgs.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => ask(s)}
                  className="text-[11px] rounded-full border border-border bg-background hover:border-primary hover:bg-primary/5 px-2.5 py-1 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="border-t p-3 flex gap-2">
            <Input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") ask(input); }}
              placeholder="Pergunte algo..."
              className="h-10 text-sm"
            />
            <Button size="icon" className="h-10 w-10 shrink-0" onClick={() => ask(input)} disabled={!input.trim() || thinking}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
