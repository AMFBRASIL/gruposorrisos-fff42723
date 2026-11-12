import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

const tones = { success: "bg-success/10 text-success", info: "bg-info/10 text-info", primary: "bg-primary/10 text-primary", warning: "bg-warning/10 text-warning", destructive: "bg-destructive/10 text-destructive" };
export type Tone = keyof typeof tones;

export function StockStat({ label, value, icon: Icon, tone = "primary", hint }: { label: string; value: string | number; icon: LucideIcon; tone?: Tone; hint?: string }) {
  return (
    <Card className="p-4 relative overflow-hidden">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-xl font-semibold truncate">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
        </div>
      </div>
    </Card>
  );
}

export function ChartCard({ title, desc, children, className = "", action }: { title: string; desc?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-4">
        <div><div className="font-semibold text-sm">{title}</div>{desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}</div>{action}
      </div>
      <div className="h-56">{children}</div>
    </Card>
  );
}

export const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--success)", "var(--warning)", "var(--destructive)", "var(--info)"];
export const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" };
export const axisProps = { tick: { fontSize: 11, fill: "var(--muted-foreground)" }, axisLine: false, tickLine: false } as const;
