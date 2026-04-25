import { useMemo } from "react";
import { HoleData, AXIS_ORDER } from "@/types/holes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface SummaryViewProps {
  holes: HoleData[];
  selectedHoles: HoleData[];
  fileName: string;
}

export function SummaryView({ holes, selectedHoles, fileName }: SummaryViewProps) {
  const summary = useMemo(() => {
    const diams = selectedHoles.map((h) => h.diameter).filter((d): d is number => d != null);
    const depths = selectedHoles.map((h) => h.depth).filter((d): d is number => d != null);
    const allDepths = holes.map((h) => h.depth).filter((d): d is number => d != null);
    const obliq = selectedHoles.filter((h) => h.axis === "Obliquo").length;
    const through = selectedHoles.filter((h) => h.type === "Passante").length;
    const blind = selectedHoles.filter((h) => h.type === "Cego").length;

    const diamCounts: Record<number, number> = {};
    for (const d of diams) {
      const k = Math.round(d * 100) / 100;
      diamCounts[k] = (diamCounts[k] || 0) + 1;
    }

    const axisCounts: Record<string, number> = {};
    for (const h of selectedHoles) {
      axisCounts[h.axis] = (axisCounts[h.axis] || 0) + 1;
    }

    const totalLength = allDepths.reduce((a, b) => a + b, 0);
    const selectedLength = depths.reduce((a, b) => a + b, 0);

    return {
      total: selectedHoles.length,
      allTotal: holes.length,
      uniqueDiams: Object.keys(diamCounts).length,
      minD: diams.length > 0 ? Math.min(...diams) : null,
      maxD: diams.length > 0 ? Math.max(...diams) : null,
      avgD: diams.length > 0 ? diams.reduce((a, b) => a + b, 0) / diams.length : null,
      maxDepth: depths.length > 0 ? Math.max(...depths) : null,
      totalLength,
      selectedLength,
      obliq,
      through,
      blind,
      diamCounts: Object.entries(diamCounts).sort(([a], [b]) => parseFloat(a) - parseFloat(b)),
      axisCounts,
    };
  }, [holes, selectedHoles]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-PT");
  const timeStr = now.toLocaleTimeString("pt-PT");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-5 h-5 text-primary" />
          Relatório de Análise
        </CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          <span className="text-muted-foreground">{"═".repeat(56)}</span>{"\n"}
          <span className="text-primary font-bold">  RELATÓRIO DE ANÁLISE DE FURAÇÃO</span>{"\n"}
          <span className="text-muted-foreground">  {dateStr}  {timeStr}</span>{"\n"}
          <span className="text-muted-foreground">{"═".repeat(56)}</span>{"\n\n"}

          <span className="text-success font-bold">FICHEIRO</span>{"\n"}
          {"  "}{fileName}{"\n\n"}

          <span className="text-success font-bold">SUMÁRIO</span>{"\n"}
          {"  Furos selecion. : "}{summary.total} / {summary.allTotal}{"\n"}
          {"  Ø únicos        : "}{summary.uniqueDiams}{"\n"}
          {summary.minD != null && <>{"  Ø mínimo        : "}{summary.minD.toFixed(3)} mm{"\n"}</>}
          {summary.maxD != null && <>{"  Ø máximo        : "}{summary.maxD.toFixed(3)} mm{"\n"}</>}
          {summary.avgD != null && <>{"  Ø médio         : "}{summary.avgD.toFixed(3)} mm{"\n"}</>}
          {summary.maxDepth != null && <>{"  Prof. máxima    : "}{summary.maxDepth.toFixed(2)} mm{"\n"}</>}
          {"  Comp. selec.    : "}{summary.selectedLength.toFixed(2)} mm{"\n"}
          {"  Comp. total     : "}{summary.totalLength.toFixed(2)} mm{"\n"}
          {"  Furos oblíquos  : "}{summary.obliq}{"\n"}
          {"  Passantes       : "}{summary.through}{"\n"}
          {"  Cegos           : "}{summary.blind}{"\n\n"}

          <span className="text-success font-bold">POR EIXO</span>{"\n"}
          {AXIS_ORDER.filter((a) => summary.axisCounts[a]).map((a) => (
            <span key={a}>{"  "}{a.padEnd(10)}: {summary.axisCounts[a]} furo(s){"\n"}</span>
          ))}
          {"\n"}

          <span className="text-success font-bold">DISTRIBUIÇÃO POR DIÂMETRO</span>{"\n"}
          {summary.diamCounts.map(([d, cnt]) => {
            const bar = "█".repeat(Math.min(cnt, 28));
            return <span key={d}>{"  Ø "}{parseFloat(d).toFixed(3).padStart(8)} mm  {bar}  ({cnt}×){"\n"}</span>;
          })}
          {"\n"}

          <span className="text-success font-bold">DETALHE</span>{"\n"}
          <span className="text-muted-foreground">{"  "}{" #".padEnd(5)}{"Ø mm".padStart(9)}{"Prof".padStart(9)}{"Ang".padStart(7)}{"  Centro"}</span>{"\n"}
          <span className="text-muted-foreground">{"  "}{"─".repeat(54)}</span>{"\n"}
          {selectedHoles.map((h) => (
            <span key={h.id}>
              {"  "}{String(h.faceNumber).padStart(4)}{"  "}
              {(h.diameter?.toFixed(3) ?? "—").padStart(8)}{"  "}
              {(h.depth?.toFixed(2) ?? "—").padStart(8)}{"  "}
              {((h.angle?.toFixed(1) ?? "0") + "°").padStart(6)}{"  "}
              ({h.centerX.toFixed(1)}, {h.centerY.toFixed(1)}, {h.centerZ.toFixed(1)}){"\n"}
            </span>
          ))}
        </pre>
      </CardContent>
    </Card>
  );
}
