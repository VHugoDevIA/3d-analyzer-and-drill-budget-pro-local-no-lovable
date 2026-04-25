import { HoleData, Budget } from "@/types/holes";
import { Card, CardContent } from "@/components/ui/card";
import { CircleDot, Ruler, TrendingUp, AlertTriangle, Crosshair, Eye } from "lucide-react";

interface StatsCardsProps {
  holes: HoleData[];
  selectedHoles: HoleData[];
  budget: Budget | null;
}

export function StatsCards({ holes, selectedHoles, budget }: StatsCardsProps) {
  if (holes.length === 0) return null;

  const diameters = selectedHoles.map((h) => h.diameter).filter((d): d is number => d !== null);
  const depths = selectedHoles.map((h) => h.depth).filter((d): d is number => d !== null);
  const allDepths = holes.map((h) => h.depth).filter((d): d is number => d !== null);
  const uniqueDiameters = new Set(diameters.map((d) => Math.round(d * 100) / 100)).size;
  const oblique = selectedHoles.filter((h) => h.axis === "Obliquo").length;
  const through = selectedHoles.filter((h) => h.type === "Passante").length;
  const minD = diameters.length > 0 ? Math.min(...diameters) : 0;
  const maxD = diameters.length > 0 ? Math.max(...diameters) : 0;

  const totalLength = allDepths.reduce((a, b) => a + b, 0);
  const selectedLength = depths.reduce((a, b) => a + b, 0);

  const stats = [
    { label: "Furos Selecionados", value: `${selectedHoles.length}/${holes.length}`, icon: CircleDot, color: "primary" },
    { label: "Ø Únicos", value: uniqueDiameters, icon: Crosshair, color: "success" },
    { label: "Ø Min (mm)", value: minD > 0 ? minD.toFixed(2) : "—", icon: Ruler, color: "warning" },
    { label: "Ø Max (mm)", value: maxD > 0 ? maxD.toFixed(2) : "—", icon: Ruler, color: "destructive" },
    { label: "Comp. Total (mm)", value: `${selectedLength.toFixed(1)} / ${totalLength.toFixed(1)}`, icon: TrendingUp, color: "muted" },
    { label: "Oblíquos", value: oblique, icon: AlertTriangle, color: "warning" },
    { label: "Passantes", value: through, icon: Eye, color: "primary" },
    { label: "Total €", value: budget ? `${budget.total.toFixed(0)}€` : "—", icon: TrendingUp, color: "success" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-${s.color}/10 flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 text-${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
