import { HoleData, PricingRule, BudgetLine, Budget } from "@/types/holes";

export function findMatchingRule(hole: HoleData, rules: PricingRule[]): PricingRule | null {
  const d = hole.diameter ?? 0;
  const depth = hole.depth ?? 0;
  const angle = hole.angle ?? 0;

  for (const rule of rules) {
    if (
      d >= rule.minDiameter && d <= rule.maxDiameter &&
      depth >= rule.minDepth && depth <= rule.maxDepth &&
      angle >= rule.minAngle && angle <= rule.maxAngle
    ) {
      return rule;
    }
  }
  return null;
}

export function calculateHolePrice(hole: HoleData, rule: PricingRule): number {
  const depth = hole.depth ?? 0;
  return rule.pricePerHole + (depth * rule.pricePerMm);
}

export function calculateBudget(holes: HoleData[], rules: PricingRule[], fileName: string): Budget {
  const lines: BudgetLine[] = holes.map((hole) => {
    const rule = findMatchingRule(hole, rules);
    const price = rule ? calculateHolePrice(hole, rule) : 0;
    return { hole, rule, price };
  });

  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.price, 0),
    fileName,
    date: new Date().toLocaleDateString("pt-PT"),
  };
}

export const DEFAULT_RULES: PricingRule[] = [
  {
    id: crypto.randomUUID(),
    name: "Furo pequeno reto",
    minDiameter: 0, maxDiameter: 10,
    minDepth: 0, maxDepth: 100,
    minAngle: 0, maxAngle: 5,
    pricePerHole: 2.50, pricePerMm: 0.10,
  },
  {
    id: crypto.randomUUID(),
    name: "Furo médio reto",
    minDiameter: 10, maxDiameter: 30,
    minDepth: 0, maxDepth: 200,
    minAngle: 0, maxAngle: 5,
    pricePerHole: 5.00, pricePerMm: 0.15,
  },
  {
    id: crypto.randomUUID(),
    name: "Furo grande reto",
    minDiameter: 30, maxDiameter: 100,
    minDepth: 0, maxDepth: 500,
    minAngle: 0, maxAngle: 5,
    pricePerHole: 10.00, pricePerMm: 0.25,
  },
  {
    id: crypto.randomUUID(),
    name: "Furo inclinado",
    minDiameter: 0, maxDiameter: 100,
    minDepth: 0, maxDepth: 500,
    minAngle: 5, maxAngle: 90,
    pricePerHole: 15.00, pricePerMm: 0.40,
  },
];
