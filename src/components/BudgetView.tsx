import { Budget } from "@/types/holes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, AlertTriangle } from "lucide-react";

interface BudgetViewProps {
  budget: Budget;
}

export function BudgetView({ budget }: BudgetViewProps) {
  const unmatched = budget.lines.filter((l) => !l.rule);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-5 h-5 text-primary" />
            Orçamento — {budget.fileName}
          </CardTitle>
          <span className="text-xs text-muted-foreground">{budget.date}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {unmatched.length > 0 && (
          <div className="flex items-center gap-2 text-sm bg-warning/10 text-warning border border-warning/20 rounded-md px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {unmatched.length} furo(s) sem regra de preço correspondente
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">#</TableHead>
                <TableHead className="text-muted-foreground">Ø (mm)</TableHead>
                <TableHead className="text-muted-foreground">Prof. (mm)</TableHead>
                <TableHead className="text-muted-foreground">Ângulo</TableHead>
                <TableHead className="text-muted-foreground">Regra</TableHead>
                <TableHead className="text-muted-foreground text-right">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budget.lines.map((line, idx) => (
                <TableRow key={line.hole.id} className="border-border">
                  <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {line.hole.diameter?.toFixed(2) ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {line.hole.depth?.toFixed(2) ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {line.hole.angle?.toFixed(1) ?? "—"}°
                  </TableCell>
                  <TableCell className="text-sm">
                    {line.rule ? (
                      <span className="text-foreground">{line.rule.name}</span>
                    ) : (
                      <span className="text-destructive text-xs">Sem regra</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-right font-semibold">
                    {line.price > 0 ? `${line.price.toFixed(2)} €` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-primary font-mono">
              {budget.total.toFixed(2)} €
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
