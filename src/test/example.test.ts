import { describe, it, expect } from "vitest";
import { parseJSON } from "@/lib/csv-parser";

describe("hole depth filtering", () => {
  it("keeps only valid depths plus oblique holes with missing depth", () => {
    const input = JSON.stringify([
      {
        face: 1,
        object: "obl-null",
        x: 0,
        y: 0,
        z: 0,
        diameter: 10,
        nx: -0.5,
        ny: 0,
        nz: 0.866,
        depth: null,
      },
      {
        face: 2,
        object: "straight-null",
        x: 10,
        y: 0,
        z: 0,
        diameter: 10,
        nx: 0,
        ny: 0,
        nz: 1,
        depth: null,
      },
      {
        face: 3,
        object: "zero",
        x: 20,
        y: 0,
        z: 0,
        diameter: 10,
        nx: 0,
        ny: 0,
        nz: 1,
        depth: 0,
      },
      {
        face: 4,
        object: "near-zero",
        x: 30,
        y: 0,
        z: 0,
        diameter: 10,
        nx: 0,
        ny: 0,
        nz: 1,
        depth: 0.005,
      },
      {
        face: 5,
        object: "valid",
        x: 40,
        y: 0,
        z: 0,
        diameter: 10,
        nx: 0,
        ny: 0,
        nz: 1,
        depth: 12,
      }
    ]);

    const holes = parseJSON(input);

    expect(holes).toHaveLength(2);
    expect(holes.some((hole) => hole.objectName === "obl-null" && hole.depth === null && hole.axis === "Obliquo")).toBe(true);
    expect(holes.some((hole) => hole.objectName === "valid" && hole.depth === 12)).toBe(true);
    expect(holes.some((hole) => hole.objectName === "straight-null")).toBe(false);
    expect(holes.some((hole) => hole.objectName === "zero")).toBe(false);
    expect(holes.some((hole) => hole.objectName === "near-zero")).toBe(false);
  });
});
