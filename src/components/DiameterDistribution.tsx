import { useMemo } from "react";
import { HoleData, AXIS_COLORS } from "@/types/holes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface DiameterDistributionProps {
  holes: HoleData[];
}

export function DiameterDistribution({ holes }: DiameterDistributionProps) {
  const distribution = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const h of holes) {
      if (h.diameter == null) continue;
      const key = Math.round(h.diameter * 10) / 10;
      counts[key] = (counts[key] || 0) + 1;
    }
    const entries = Object.entries(counts)
      .map(([d, c]) => ({ diameter: parseFloat(d), count: c }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
    return entries;
  }, [holes]);

  const max = Math.max(1, ...distribution.map((d) => d.count));

  if (distribution.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="w-5 h-5 text-primary" />
          Distribuição Ø
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {distribution.map(({ diameter, count }) => (
          <div key={diameter} className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground w-16 text-right">
              Ø{diameter.toFixed(1)}
            </span>
            <div className="flex-1 h-3 bg-secondary rounded-sm overflow-hidden">
              <div
                className="h-full bg-primary rounded-sm transition-all"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="font-mono text-xs text-muted-foreground w-10">
              ×{count}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
