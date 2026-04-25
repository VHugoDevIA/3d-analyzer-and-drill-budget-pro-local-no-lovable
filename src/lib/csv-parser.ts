import { HoleData, HoleAxis, HoleType } from "@/types/holes";

const AXIS_ALIGNMENT_TOL = 0.95;
const MIN_VALID_DEPTH = 0.01;
const HOLE_AXES: HoleAxis[] = ["Z+", "Z-", "X+", "X-", "Y+", "Y-", "Obliquo"];

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function field(item: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (item[key] !== undefined) return item[key];
  }
  return undefined;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const parsed = parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isHoleAxis(value: unknown): value is HoleAxis {
  return typeof value === "string" && HOLE_AXES.includes(value as HoleAxis);
}

function classifyAxis(nx: number, ny: number, nz: number, tol = AXIS_ALIGNMENT_TOL): HoleAxis {
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  const m = Math.max(ax, ay, az);
  if (m < 1e-6) return "Obliquo";
  if (ax >= tol && ax === m) return nx > 0 ? "X+" : "X-";
  if (ay >= tol && ay === m) return ny > 0 ? "Y+" : "Y-";
  if (az >= tol && az === m) return nz > 0 ? "Z+" : "Z-";
  return "Obliquo";
}

function isObliqueNormal(nx: number, ny: number, nz: number, tol = AXIS_ALIGNMENT_TOL): boolean {
  const maxComponent = Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz));
  return maxComponent > 1e-6 && maxComponent < tol;
}

function keepHoleWhenDepthValidOrObliqueMissing(hole: HoleData): boolean {
  if (hole.depth === null) {
    return isObliqueNormal(hole.normalX, hole.normalY, hole.normalZ);
  }

  return hole.depth > MIN_VALID_DEPTH;
}

export function parseCSV(text: string): HoleData[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());

  const colMap = {
    face: header.findIndex((h) => h.includes("face")),
    obj: header.findIndex((h) => h.includes("objeto") || h.includes("object")),
    cx: header.findIndex((h) => h.includes("centro x") || h.includes("center x") || h === "x"),
    cy: header.findIndex((h) => h.includes("centro y") || h.includes("center y") || h === "y"),
    cz: header.findIndex((h) => h.includes("centro z") || h.includes("center z") || h === "z"),
    diameter: header.findIndex((h) => h.includes("diâmetro") || h.includes("diametro") || h.includes("diameter")),
    nx: header.findIndex((h) => h.includes("normal x") || h === "nx"),
    ny: header.findIndex((h) => h.includes("normal y") || h === "ny"),
    nz: header.findIndex((h) => h.includes("normal z") || h === "nz"),
    angle: header.findIndex((h) => h.includes("ângulo") || h.includes("angulo") || h.includes("angle")),
    depth: header.findIndex((h) => h.includes("profundidade") || h.includes("depth")),
    type: header.findIndex((h) => h.includes("tipo") || h.includes("type")),
    axis: header.findIndex((h) => h.includes("eixo") || h.includes("axis")),
  };

  const holes: HoleData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/).map((c) => c.trim());
    if (cols.length < 3) continue;

    const num = (idx: number) => {
      if (idx < 0 || idx >= cols.length) return null;
      const v = parseFloat(cols[idx].replace(",", "."));
      return isNaN(v) ? null : v;
    };
    const str = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx] : "");

    const nx = num(colMap.nx) ?? 0;
    const ny = num(colMap.ny) ?? 0;
    const nz = num(colMap.nz) ?? 1;
    const typeStr = str(colMap.type);
    const axisStr = str(colMap.axis);

    holes.push({
      id: crypto.randomUUID(),
      faceNumber: num(colMap.face) ?? i,
      objectName: str(colMap.obj) || "—",
      centerX: num(colMap.cx) ?? 0,
      centerY: num(colMap.cy) ?? 0,
      centerZ: num(colMap.cz) ?? 0,
      diameter: num(colMap.diameter),
      normalX: nx,
      normalY: ny,
      normalZ: nz,
      angle: num(colMap.angle),
      depth: num(colMap.depth),
      type: (typeStr === "Passante" || typeStr === "Cego" ? typeStr : "Desconhecido") as HoleType,
      axis: (HOLE_AXES.includes(axisStr as HoleAxis) ? axisStr : classifyAxis(nx, ny, nz)) as HoleAxis,
      colorRGB: null,
    });
  }

  return holes.filter(keepHoleWhenDepthValidOrObliqueMissing);
}

/**
 * Groups raw face entries by (X, Y) center within a tolerance,
 * keeping the largest diameter per group and computing depth from Z range.
 */
function groupFacesByPosition(faces: HoleData[], tolerance = 0.5): HoleData[] {
  const groups: HoleData[][] = [];

  for (const face of faces) {
    let found = false;
    for (const group of groups) {
      const ref = group[0];
      const sameNormal =
        Math.abs(face.normalX - ref.normalX) < 0.3 &&
        Math.abs(face.normalY - ref.normalY) < 0.3 &&
        Math.abs(face.normalZ - ref.normalZ) < 0.3;

      if (
        sameNormal &&
        Math.abs(face.centerX - ref.centerX) < tolerance &&
        Math.abs(face.centerY - ref.centerY) < tolerance
      ) {
        group.push(face);
        found = true;
        break;
      }
    }

    if (!found) {
      groups.push([face]);
    }
  }

  return groups.map((group, idx) => {
    const best = group.reduce((a, b) =>
      (b.diameter ?? 0) > (a.diameter ?? 0) ? b : a
    );

    const zValues = group.map((f) => f.centerZ);
    const zMin = Math.min(...zValues);
    const zMax = Math.max(...zValues);
    const computedDepth = zMax - zMin > MIN_VALID_DEPTH ? Math.abs(zMax - zMin) : best.depth;

    return {
      ...best,
      id: crypto.randomUUID(),
      faceNumber: idx + 1,
      depth: computedDepth,
    };
  });
}

export function parseJSON(text: string): HoleData[] {
  try {
    const sanitized = text.replace(/\bNaN\b/g, "null").replace(/\bInfinity\b/g, "null").replace(/\b-Infinity\b/g, "null");
    const data: unknown = JSON.parse(sanitized);
    const source = Array.isArray(data)
      ? data
      : isRecord(data)
        ? field(data, ["furos", "holes"])
        : [];
    const arr = Array.isArray(source) ? source.filter(isRecord) : [];

    const raw: HoleData[] = arr.map((item, i) => {
      const nx = toNumber(field(item, ["Normal X", "normalX", "nx"])) ?? 0;
      const ny = toNumber(field(item, ["Normal Y", "normalY", "ny"])) ?? 0;
      const nz = toNumber(field(item, ["Normal Z", "normalZ", "nz"])) ?? 1;
      const eixo = field(item, ["_eixo", "Eixo", "axis"]);
      const tipo = toText(field(item, ["Tipo", "type"]));

      let colorRGB: [number, number, number] | null = null;
      const cor = field(item, ["_cor_rgb", "Cor (R,G,B)"]);
      if (Array.isArray(cor) && cor.length === 3) {
        colorRGB = [
          toNumber(cor[0]) ?? 0,
          toNumber(cor[1]) ?? 0,
          toNumber(cor[2]) ?? 0,
        ];
      } else if (typeof cor === "string") {
        const nums = cor.match(/\d+/g);
        if (nums && nums.length === 3) {
          colorRGB = [parseInt(nums[0]), parseInt(nums[1]), parseInt(nums[2])];
        }
      }

      return {
        id: crypto.randomUUID(),
        faceNumber: toNumber(field(item, ["Face #", "face"])) ?? i + 1,
        objectName: toText(field(item, ["Objeto", "objectName", "object"])) ?? "—",
        centerX: toNumber(field(item, ["Centro X", "centerX", "x"])) ?? 0,
        centerY: toNumber(field(item, ["Centro Y", "centerY", "y"])) ?? 0,
        centerZ: toNumber(field(item, ["Centro Z", "centerZ", "z"])) ?? 0,
        diameter: toNumber(field(item, ["Diâmetro (mm)", "diameter", "diametro"])),
        normalX: nx,
        normalY: ny,
        normalZ: nz,
        angle: toNumber(field(item, ["Ângulo vs Z (graus)", "Ângulo vs Z (°)", "angle", "angulo"])),
        depth: toNumber(field(item, ["Profundidade (mm)", "depth", "profundidade"])),
        type: (tipo === "Passante" || tipo === "Cego" ? tipo : "Desconhecido") as HoleType,
        axis: isHoleAxis(eixo) ? eixo : classifyAxis(nx, ny, nz),
        colorRGB,
      };
    });

    return groupFacesByPosition(raw).filter(keepHoleWhenDepthValidOrObliqueMissing);
  } catch {
    return [];
  }
}
