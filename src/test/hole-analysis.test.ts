import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  computeAngle,
  computeAxis,
  deduplicateHoles,
  featuresToHoles,
} from "@/lib/hole-analysis";
import type { DetectedFeature } from "@/lib/step-loader";
import type { HoleData } from "@/types/holes";

function makeHole(overrides: Partial<HoleData> = {}): HoleData {
  return {
    id: "hole-1",
    faceNumber: 1,
    objectName: "peca.step",
    centerX: 0,
    centerY: 0,
    centerZ: 0,
    diameter: 8,
    normalX: 0,
    normalY: 0,
    normalZ: 1,
    angle: 0,
    depth: 10,
    type: "Cego",
    axis: "Z+",
    colorRGB: null,
    ...overrides,
  };
}

describe("hole axis and angle analysis", () => {
  it("classifies axis-aligned normals", () => {
    expect(computeAxis([1, 0, 0])).toBe("X+");
    expect(computeAxis([-1, 0, 0])).toBe("X-");
    expect(computeAxis([0, 1, 0])).toBe("Y+");
    expect(computeAxis([0, -1, 0])).toBe("Y-");
    expect(computeAxis([0, 0, 1])).toBe("Z+");
    expect(computeAxis([0, 0, -1])).toBe("Z-");
  });

  it("classifies normals away from principal axes as oblique", () => {
    expect(computeAxis([Math.SQRT1_2, 0, Math.SQRT1_2])).toBe("Obliquo");
  });

  it("computes angle from the nearest principal axis", () => {
    expect(computeAngle([0, 0, 1])).toBe(0);
    expect(computeAngle([Math.SQRT1_2, 0, Math.SQRT1_2])).toBe(45);
  });
});

describe("hole deduplication", () => {
  it("deduplicates coaxial holes and keeps the deepest one", () => {
    const holes = [
      makeHole({ id: "shallow", depth: 10, centerX: 0, centerY: 0, centerZ: 0 }),
      makeHole({ id: "deep", depth: 25, centerX: 0.2, centerY: 0.2, centerZ: 15 }),
    ];

    const result = deduplicateHoles(holes);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "deep", depth: 25, faceNumber: 1 });
  });

  it("does not deduplicate holes with different position, diameter or axis", () => {
    const holes = [
      makeHole({ id: "base" }),
      makeHole({ id: "far-position", centerX: 5 }),
      makeHole({ id: "different-diameter", diameter: 8.2 }),
      makeHole({ id: "different-axis", normalX: 1, normalZ: 0, axis: "X+" }),
    ];

    const result = deduplicateHoles(holes);

    expect(result.map((hole) => hole.id)).toEqual([
      "base",
      "far-position",
      "different-diameter",
      "different-axis",
    ]);
  });
});

describe("feature conversion", () => {
  it("converts STEP hole features into HoleData with identity alignment", () => {
    const features: DetectedFeature[] = [
      {
        type: "hole",
        diameter: 6,
        depth: 12,
        center: [1, 2, 3],
        normal: [0, 0, 1],
        faceIndices: [10],
        _ratio: 0.8,
      },
      {
        type: "unknown",
        center: [0, 0, 0],
        normal: [1, 0, 0],
        faceIndices: [99],
      },
    ];

    const holes = featuresToHoles(features, "peca.step", new THREE.Quaternion(), 0.75);

    expect(holes).toHaveLength(1);
    expect(holes[0]).toMatchObject({
      faceNumber: 1,
      objectName: "peca.step",
      centerX: 1,
      centerY: 2,
      centerZ: 3,
      diameter: 6,
      depth: 12,
      type: "Passante",
      axis: "Z+",
      angle: 0,
      colorRGB: null,
    });
  });
});
