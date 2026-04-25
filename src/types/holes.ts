export type HoleAxis = "Z+" | "Z-" | "X+" | "X-" | "Y+" | "Y-" | "Obliquo";
export type HoleType = "Passante" | "Cego" | "Desconhecido";

export interface HoleData {
  id: string;
  faceNumber: number;
  objectName: string;
  centerX: number;
  centerY: number;
  centerZ: number;
  diameter: number | null;
  normalX: number;
  normalY: number;
  normalZ: number;
  angle: number | null;
  depth: number | null;
  type: HoleType;
  axis: HoleAxis;
  colorRGB: [number, number, number] | null;
}

export interface PricingRule {
  id: string;
  name: string;
  minDiameter: number;
  maxDiameter: number;
  minDepth: number;
  maxDepth: number;
  minAngle: number;
  maxAngle: number;
  pricePerHole: number;
  pricePerMm: number;
}

export interface BudgetLine {
  hole: HoleData;
  rule: PricingRule | null;
  price: number;
}

export interface Budget {
  lines: BudgetLine[];
  total: number;
  fileName: string;
  date: string;
}

export const AXIS_ORDER: HoleAxis[] = ["Z+", "Z-", "X+", "X-", "Y+", "Y-", "Obliquo"];

export const AXIS_COLORS: Record<HoleAxis, string> = {
  "Z+": "217 91% 52%",
  "Z-": "216 98% 61%",
  "X+": "142 45% 33%",
  "X-": "135 53% 49%",
  "Y+": "38 92% 33%",
  "Y-": "38 72% 49%",
  "Obliquo": "262 52% 52%",
};
