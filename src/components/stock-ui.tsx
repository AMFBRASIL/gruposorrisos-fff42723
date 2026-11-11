import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function StockStat({ label, value, icon: Icon, tone = "primary" }: { label: string; value: string | number; icon: LucideIcon; tone?: "success" | "info" | "primary" | "warning" | "destructive" }) {
  const bg = { success: "bg-success/10 text-success", info: "bg-info/10 text-info", primary: "bg-primary/10 text-primary", warning: "bg-warning/10 text-warning", destructive: "bg-destructive/10 text-destructive" }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${bg}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}
