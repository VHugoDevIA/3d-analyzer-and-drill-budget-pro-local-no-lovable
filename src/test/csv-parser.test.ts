import { describe, expect, it } from "vitest";
import { parseCSV, parseJSON } from "@/lib/csv-parser";

describe("CSV import parser", () => {
  it("parses semicolon-separated files", () => {
    const csv = [
      "face;object;x;y;z;diameter;nx;ny;nz;angle;depth;type",
      "1;peca-a;1;2;3;6;1;0;0;0;12;Passante",
    ].join("\n");

    const holes = parseCSV(csv);

    expect(holes).toHaveLength(1);
    expect(holes[0]).toMatchObject({
      faceNumber: 1,
      objectName: "peca-a",
      centerX: 1,
      centerY: 2,
      centerZ: 3,
      diameter: 6,
      depth: 12,
      type: "Passante",
      axis: "X+",
    });
  });

  it("parses comma-separated files", () => {
    const csv = [
      "face,object,x,y,z,diameter,nx,ny,nz,angle,depth,type",
      "2,peca-b,4,5,6,8,0,-1,0,0,18,Cego",
    ].join("\n");

    const holes = parseCSV(csv);

    expect(holes).toHaveLength(1);
    expect(holes[0]).toMatchObject({
      faceNumber: 2,
      objectName: "peca-b",
      diameter: 8,
      depth: 18,
      type: "Cego",
      axis: "Y-",
    });
  });

  it("parses tab-separated files", () => {
    const csv = [
      "face\tobject\tx\ty\tz\tdiameter\tnx\tny\tnz\tangle\tdepth",
      "3\tpeca-c\t7\t8\t9\t10\t0\t0\t-1\t0\t25",
    ].join("\n");

    const holes = parseCSV(csv);

    expect(holes).toHaveLength(1);
    expect(holes[0]).toMatchObject({
      faceNumber: 3,
      objectName: "peca-c",
      diameter: 10,
      depth: 25,
      axis: "Z-",
    });
  });
});

describe("JSON import parser", () => {
  it("parses a direct array of holes", () => {
    const input = JSON.stringify([
      {
        face: 1,
        object: "json-array",
        x: 10,
        y: 20,
        z: 30,
        diameter: 12,
        depth: 40,
        nx: 0,
        ny: 0,
        nz: 1,
      },
    ]);

    const holes = parseJSON(input);

    expect(holes).toHaveLength(1);
    expect(holes[0]).toMatchObject({
      objectName: "json-array",
      centerX: 10,
      centerY: 20,
      centerZ: 30,
      diameter: 12,
      depth: 40,
      axis: "Z+",
    });
  });

  it("parses an object with a furos array", () => {
    const input = JSON.stringify({
      furos: [
        {
          "Face #": 4,
          Objeto: "json-furos",
          "Centro X": 1,
          "Centro Y": 2,
          "Centro Z": 3,
          "Diâmetro (mm)": 5,
          "Profundidade (mm)": 15,
          "Normal X": -1,
          "Normal Y": 0,
          "Normal Z": 0,
        },
      ],
    });

    const holes = parseJSON(input);

    expect(holes).toHaveLength(1);
    expect(holes[0]).toMatchObject({
      faceNumber: 1,
      objectName: "json-furos",
      diameter: 5,
      depth: 15,
      axis: "X-",
    });
  });

  it("classifies axes from normals when no axis field is provided", () => {
    const input = JSON.stringify([
      { face: 1, object: "x", x: 0, y: 0, z: 0, diameter: 8, depth: 10, nx: 1, ny: 0, nz: 0 },
      { face: 2, object: "y", x: 2, y: 0, z: 0, diameter: 8, depth: 10, nx: 0, ny: -1, nz: 0 },
      { face: 3, object: "z", x: 4, y: 0, z: 0, diameter: 8, depth: 10, nx: 0, ny: 0, nz: 1 },
      { face: 4, object: "oblique", x: 6, y: 0, z: 0, diameter: 8, depth: 10, nx: 0.5, ny: 0, nz: 0.866 },
    ]);

    const axes = parseJSON(input).map((hole) => hole.axis);

    expect(axes).toEqual(["X+", "Y-", "Z+", "Obliquo"]);
  });
});
