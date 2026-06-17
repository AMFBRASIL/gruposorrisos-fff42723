import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTemplates, templatesStore } from "@/lib/store";
import { Plus, ListChecks, Clock, Sparkles, Trash2 } from "lucide-react";
import { CreateTemplateWizard } from "@/components/create-template-wizard";
import type { ProjectTemplate } from "@/lib/mock-data";

export const Route = createFileRoute("/templates")({
  head: () => ({ meta: [
    { title: "Templates de Projeto — Grupo Sorrisos Tasks" },
    { name: "description", content: "Modelos prontos para acelerar a criação de projetos." },
  ]}),
  component: TemplatesPage,
});

function TemplatesPage() {
  const templates = useTemplates();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectTemplate | null>(null);

  return (
    <AppShell
      title="Templates de Projeto"
      subtitle="Crie projetos completos em segundos a partir de modelos"
      primaryAction={
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Template
        </Button>
      }
    >
      <div className="p-4 md:p-8 max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => { setEditing(t); setOpen(true); }}
              className="group relative text-left rounded-2xl border border-border bg-card p-5 overflow-hidden transition-all hover:border-primary/40 hover:shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.3)] hover:-translate-y-0.5"
            >
              <div
                className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity"
                style={{ background: `linear-gradient(135deg, ${t.color}33, transparent 70%)` }}
              />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 rounded-xl bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center text-2xl shadow-sm">
                    {t.icon}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
                </div>
                <h3 className="font-semibold leading-tight">{t.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />{t.tasks.length} tarefas</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t.defaultDurationDays}d</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Editar / Usar
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Remover template "${t.name}"?`)) templatesStore.removeTemplate(t.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground mb-1">
            <Sparkles className="h-4 w-4 text-primary" /> Como usar
          </div>
          Ao criar um novo projeto, escolha um template no primeiro passo do assistente. Todas as tarefas serão criadas automaticamente com prazos, dependências e responsáveis pré-configurados.
        </div>
      </div>

      <CreateTemplateWizard
        open={open}
        template={editing}
        onClose={() => { setOpen(false); setEditing(null); }}
      />
    </AppShell>
  );
}
