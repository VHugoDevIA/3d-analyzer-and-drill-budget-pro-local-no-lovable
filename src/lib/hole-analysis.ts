import * as THREE from "three";
import type { DetectedFeature } from "@/lib/step-loader";
import type { HoleAxis, HoleData } from "@/types/holes";

export function computeAxis(normal: [number, number, number]): HoleAxis {
  const [nx, ny, nz] = normal.map(Math.abs);
  const threshold = 0.85;
  if (nz >= nx && nz >= ny) {
    return nz >= threshold ? (normal[2] >= 0 ? "Z+" : "Z-") : "Obliquo";
  }
  if (nx >= ny && nx >= nz) {
    return nx >= threshold ? (normal[0] >= 0 ? "X+" : "X-") : "Obliquo";
  }
  return ny >= threshold ? (normal[1] >= 0 ? "Y+" : "Y-") : "Obliquo";
}

export function computeAngle(normal: [number, number, number]): number {
  const [nx, ny, nz] = normal.map(Math.abs);
  const maxComp = Math.max(nx, ny, nz);
  return Math.round(Math.acos(Math.min(1, maxComp)) * (180 / Math.PI) * 10) / 10;
}

export function featuresToHoles(
  features: DetectedFeature[],
  fileName: string,
  alignmentQ: THREE.Quaternion,
  throughThreshold: number
): HoleData[] {
  const raw = features
    .filter((f) => f.type === "hole")
    .map((f, i) => {
      const rotNormal = new THREE.Vector3(...f.normal).applyQuaternion(alignmentQ).normalize();
      const normal: [number, number, number] = [rotNormal.x, rotNormal.y, rotNormal.z];
      const rotCenter = new THREE.Vector3(...f.center).applyQuaternion(alignmentQ);

      // Re-classify using the adjustable threshold.
      let holeType: HoleData["type"] = f.holeType ?? "Desconhecido";
      if (f._ratio != null) {
        holeType = f._ratio >= throughThreshold ? "Passante" : "Cego";
      }

      return {
        id: crypto.randomUUID(),
        faceNumber: i + 1,
        objectName: fileName,
        centerX: rotCenter.x,
        centerY: rotCenter.y,
        centerZ: rotCenter.z,
        diameter: f.diameter ?? null,
        normalX: normal[0],
        normalY: normal[1],
        normalZ: normal[2],
        angle: computeAngle(normal),
        depth: f.depth ?? null,
        type: holeType,
        axis: computeAxis(normal),
        colorRGB: null,
      };
    });

  return deduplicateHoles(raw);
}

export function deduplicateHoles(holes: HoleData[]): HoleData[] {
  const result: HoleData[] = [];
  const used = new Set<number>();

  for (let i = 0; i < holes.length; i++) {
    if (used.has(i)) continue;
    let best = holes[i];
    used.add(i);

    for (let j = i + 1; j < holes.length; j++) {
      if (used.has(j)) continue;
      const h = holes[j];
      if (best.diameter == null || h.diameter == null) continue;
      if (Math.abs(best.diameter - h.diameter) > 0.05) continue;

      const nDot = Math.abs(
        best.normalX * h.normalX + best.normalY * h.normalY + best.normalZ * h.normalZ
      );
      if (nDot < 0.95) continue;

      const nx = best.normalX, ny = best.normalY, nz = best.normalZ;
      const dx = h.centerX - best.centerX;
      const dy = h.centerY - best.centerY;
      const dz = h.centerZ - best.centerZ;
      const alongAxis = dx * nx + dy * ny + dz * nz;
      const perpX = dx - alongAxis * nx;
      const perpY = dy - alongAxis * ny;
      const perpZ = dz - alongAxis * nz;
      const perpDist = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
      if (perpDist > 1.5) continue;

      used.add(j);
      if ((h.depth ?? 0) > (best.depth ?? 0)) {
        best = h;
      }
    }

    result.push(best);
  }

  return result.map((h, i) => ({ ...h, faceNumber: i + 1 }));
}
