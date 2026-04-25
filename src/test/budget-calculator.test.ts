import { describe, expect, it } from "vitest";
import {
  calculateBudget,
  calculateHolePrice,
  findMatchingRule,
} from "@/lib/budget-calculator";
import { HoleData, PricingRule } from "@/types/holes";

function makeHole(overrides: Partial<HoleData> = {}): HoleData {
  return {
    id: "hole-1",
    faceNumber: 1,
    objectName: "peca-teste",
    centerX: 0,
    centerY: 0,
    centerZ: 0,
    diameter: 8,
    normalX: 0,
    normalY: 0,
    normalZ: 1,
    angle: 0,
    depth: 20,
    type: "Cego",
    axis: "Z+",
    colorRGB: null,
    ...overrides,
  };
}

function makeRule(overrides: Partial<PricingRule> = {}): PricingRule {
  return {
    id: "rule-1",
    name: "Regra teste",
    minDiameter: 5,
    maxDiameter: 10,
    minDepth: 10,
    maxDepth: 30,
    minAngle: 0,
    maxAngle: 5,
    pricePerHole: 2.5,
    pricePerMm: 0.1,
    ...overrides,
  };
}

describe("budget calculations", () => {
  it("finds the first pricing rule that matches diameter, depth and angle", () => {
    const hole = makeHole({ diameter: 8, depth: 20, angle: 3 });
    const matchingRule = makeRule({ id: "matching", name: "Furo Ø8" });

    expect(findMatchingRule(hole, [matchingRule])).toBe(matchingRule);
  });

  it("treats rule boundaries as inclusive", () => {
    const rule = makeRule({
      minDiameter: 8,
      maxDiameter: 8,
      minDepth: 20,
      maxDepth: 20,
      minAngle: 3,
      maxAngle: 3,
    });

    expect(findMatchingRule(makeHole({ diameter: 8, depth: 20, angle: 3 }), [rule])).toBe(rule);
  });

  it("returns null when no rule matches", () => {
    const rule = makeRule({ minDiameter: 20, maxDiameter: 30 });

    expect(findMatchingRule(makeHole({ diameter: 8 }), [rule])).toBeNull();
  });

  it("calculates each hole price from fixed price plus depth price", () => {
    const hole = makeHole({ depth: 20 });
    const rule = makeRule({ pricePerHole: 2.5, pricePerMm: 0.1 });

    expect(calculateHolePrice(hole, rule)).toBe(4.5);
  });

  it("sets unmatched hole prices to zero and sums matched lines", () => {
    const rule = makeRule({ pricePerHole: 2.5, pricePerMm: 0.1 });
    const matchedHole = makeHole({ id: "matched", diameter: 8, depth: 20 });
    const unmatchedHole = makeHole({ id: "unmatched", diameter: 80, depth: 20 });

    const budget = calculateBudget([matchedHole, unmatchedHole], [rule], "peca.step");

    expect(budget.lines).toHaveLength(2);
    expect(budget.lines[0]).toMatchObject({ hole: matchedHole, rule, price: 4.5 });
    expect(budget.lines[1]).toMatchObject({ hole: unmatchedHole, rule: null, price: 0 });
    expect(budget.total).toBe(4.5);
    expect(budget.fileName).toBe("peca.step");
  });
});
