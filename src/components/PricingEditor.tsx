import { useState } from "react";
import { PricingRule } from "@/types/holes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Settings2 } from "lucide-react";

interface PricingEditorProps {
  rules: PricingRule[];
  onChange: (rules: PricingRule[]) => void;
}

export function PricingEditor({ rules, onChange }: PricingEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const addRule = () => {
    const newRule: PricingRule = {
      id: crypto.randomUUID(),
      name: "Nova regra",
      minDiameter: 0,
      maxDiameter: 50,
      minDepth: 0,
      maxDepth: 200,
      minAngle: 0,
      maxAngle: 90,
      pricePerHole: 5.0,
      pricePerMm: 0.15,
    };
    onChange([...rules, newRule]);
    setEditingId(newRule.id);
  };

  const removeRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const updateRule = (id: string, field: keyof PricingRule, value: string) => {
    onChange(
      rules.map((r) => {
        if (r.id !== id) return r;
        if (field === "name") return { ...r, [field]: value };
        const num = parseFloat(value);
        return { ...r, [field]: isNaN(num) ? 0 : num };
      })
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="w-5 h-5 text-primary" />
            Tabela de Preços
          </CardTitle>
          <Button size="sm" onClick={addRule} className="gap-1.5">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Ø min</TableHead>
                <TableHead className="text-muted-foreground">Ø max</TableHead>
                <TableHead className="text-muted-foreground">Prof. min</TableHead>
                <TableHead className="text-muted-foreground">Prof. max</TableHead>
                <TableHead className="text-muted-foreground">Âng. min</TableHead>
                <TableHead className="text-muted-foreground">Âng. max</TableHead>
                <TableHead className="text-muted-foreground">€/furo</TableHead>
                <TableHead className="text-muted-foreground">€/mm</TableHead>
                <TableHead className="text-muted-foreground w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const isEditing = editingId === rule.id;
                return (
                  <TableRow
                    key={rule.id}
                    className="border-border cursor-pointer hover:bg-secondary/50"
                    onClick={() => setEditingId(isEditing ? null : rule.id)}
                  >
                    {isEditing ? (
                      <>
                        <TableCell>
                          <Input
                            value={rule.name}
                            onChange={(e) => updateRule(rule.id, "name", e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        {(["minDiameter", "maxDiameter", "minDepth", "maxDepth", "minAngle", "maxAngle", "pricePerHole", "pricePerMm"] as const).map((field) => (
                          <TableCell key={field}>
                            <Input
                              type="number"
                              step="0.01"
                              value={rule[field]}
                              onChange={(e) => updateRule(rule.id, field, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 text-sm w-20 font-mono"
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); removeRule(rule.id); }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium text-sm">{rule.name}</TableCell>
                        <TableCell className="font-mono text-sm">{rule.minDiameter}</TableCell>
                        <TableCell className="font-mono text-sm">{rule.maxDiameter}</TableCell>
                        <TableCell className="font-mono text-sm">{rule.minDepth}</TableCell>
                        <TableCell className="font-mono text-sm">{rule.maxDepth}</TableCell>
                        <TableCell className="font-mono text-sm">{rule.minAngle}</TableCell>
                        <TableCell className="font-mono text-sm">{rule.maxAngle}</TableCell>
                        <TableCell className="font-mono text-sm text-primary">{rule.pricePerHole.toFixed(2)}€</TableCell>
                        <TableCell className="font-mono text-sm text-primary">{rule.pricePerMm.toFixed(2)}€</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); removeRule(rule.id); }}
                            className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
