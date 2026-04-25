import occtimportjs from "occt-import-js";
import * as THREE from "three";

export interface StepMeshData {
  geometry: THREE.BufferGeometry;
  meshes: StepFaceInfo[];
  boundingBox: THREE.Box3;
  /** Rotation quaternion to align Z with largest planar face normal */
  alignmentQuaternion: THREE.Quaternion;
  /** Per-face separate geometries for raycasting in alignment picker */
  faceGeometries: { geometry: THREE.BufferGeometry; faceIndex: number; normal: THREE.Vector3; center: THREE.Vector3 }[];
}

export interface StepFaceInfo {
  index: number;
  name: string;
  vertexCount: number;
  faceType: "cylindrical" | "planar" | "conical" | "spherical" | "toroidal" | "unknown";
  color: [number, number, number] | null;
  area: number;
  estimatedDiameter?: number;
  estimatedDepth?: number;
  center?: [number, number, number];
  normal?: [number, number, number];
}

export interface DetectedFeature {
  type: "hole" | "chamfer" | "pocket" | "thread" | "unknown";
  holeType?: "Passante" | "Cego";
  diameter?: number;
  depth?: number;
  center: [number, number, number];
  normal: [number, number, number];
  faceIndices: number[];
  /** depth/thickness ratio for threshold-based classification */
  _ratio?: number;
}

const STEP_DEBUG_QUERY_PARAM = "debugStep";
const STEP_DEBUG_STORAGE_KEY = "drillAnalyzer.debug.step";

function isStepDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const queryEnabled = new URLSearchParams(window.location.search).get(STEP_DEBUG_QUERY_PARAM) === "1";
    const storageEnabled = window.localStorage.getItem(STEP_DEBUG_STORAGE_KEY) === "true";
    return queryEnabled || storageEnabled;
  } catch {
    return false;
  }
}

function logStepDebug(message: string, ...args: unknown[]): void {
  if (isStepDebugEnabled()) {
    console.log(message, ...args);
  }
}

interface OcctReadOptions {
  linearDeflection: number;
  angularDeflection: number;
}

interface OcctBrepFace {
  first: number;
  last: number;
  color?: number[];
}

interface OcctMesh {
  name?: string;
  color?: number[];
  attributes: {
    position: { array: Float32Array | number[] };
    normal?: { array: Float32Array | number[] };
  };
  index: { array: Uint32Array | number[] };
  brep_faces?: OcctBrepFace[];
}

interface OcctReadResult {
  meshes: OcctMesh[];
}

interface OcctImporter {
  ReadStepFile(buffer: Uint8Array, options: OcctReadOptions | null): OcctReadResult;
}

let occtInstance: OcctImporter | null = null;

async function getOcct(): Promise<OcctImporter> {
  if (!occtInstance) {
    occtInstance = await occtimportjs({
      locateFile: (name: string) => {
        if (name.endsWith(".wasm")) {
          return "/wasm/occt-import-js.wasm";
        }
        return name;
      },
    }) as OcctImporter;
  }
  return occtInstance;
}

/**
 * Compute the area of a triangle mesh from positions + index arrays.
 */
function computeMeshArea(positions: Float32Array | number[], indices: Uint32Array | number[]): number {
  let area = 0;
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];
    v0.set(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    v1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    v2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    area += edge1.cross(edge2).length() * 0.5;
  }
  return area;
}

function getFaceTriangleIndices(
  indices: Uint32Array | number[],
  firstTriangle: number,
  lastTriangle: number
): number[] {
  const start = Math.max(0, Math.floor(firstTriangle)) * 3;
  const end = Math.min(indices.length, (Math.floor(lastTriangle) + 1) * 3);
  const triangleIndices: number[] = [];
  for (let i = start; i < end; i++) {
    triangleIndices.push(indices[i]);
  }
  return triangleIndices;
}

function getUniqueVertexIndices(indices: number[]): number[] {
  return Array.from(new Set(indices));
}

export async function loadStepFile(buffer: ArrayBuffer): Promise<StepMeshData> {
  const occt = await getOcct();
  const fileBuffer = new Uint8Array(buffer);
  const result = occt.ReadStepFile(fileBuffer, { linearDeflection: 0.1, angularDeflection: 0.5 });

  const mergedPositions: number[] = [];
  const mergedNormals: number[] = [];
  const mergedColors: number[] = [];
  const mergedIndices: number[] = [];
  const meshes: StepFaceInfo[] = [];
  const faceGeometries: StepMeshData["faceGeometries"] = [];

  let vertexOffset = 0;

  for (let i = 0; i < result.meshes.length; i++) {
    const mesh = result.meshes[i];
    const positions = mesh.attributes.position.array;
    const normals = mesh.attributes.normal?.array;
    const index = mesh.index.array;
    const vertexCount = positions.length / 3;

    let color: [number, number, number] | null = null;
    let r = 0.53, g = 0.6, b = 0.67;
    if (mesh.color) {
      r = mesh.color[0];
      g = mesh.color[1];
      b = mesh.color[2];
      color = [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    const vertexColors = new Array(vertexCount * 3).fill(0);
    for (let j = 0; j < vertexCount; j++) {
      vertexColors[j * 3] = r;
      vertexColors[j * 3 + 1] = g;
      vertexColors[j * 3 + 2] = b;
    }

    const brepFaces = Array.isArray(mesh.brep_faces) ? mesh.brep_faces : [];

    if (brepFaces.length > 0) {
      for (let faceIdx = 0; faceIdx < brepFaces.length; faceIdx++) {
        const brepFace = brepFaces[faceIdx];
        const triangleIndices = getFaceTriangleIndices(index, brepFace.first, brepFace.last);
        if (triangleIndices.length < 3) continue;

        const faceVertexIndices = getUniqueVertexIndices(triangleIndices);
        if (faceVertexIndices.length < 3) continue;

        const fc = Array.isArray(brepFace.color) ? brepFace.color : [r, g, b];
        for (let t = 0; t < triangleIndices.length; t++) {
          const vi = triangleIndices[t];
          vertexColors[vi * 3] = fc[0];
          vertexColors[vi * 3 + 1] = fc[1];
          vertexColors[vi * 3 + 2] = fc[2];
        }

        const area = computeMeshArea(positions, triangleIndices);
        const faceType = classifyFace(normals, faceVertexIndices);
        let featureData: Partial<StepFaceInfo> | undefined;
        if (faceType !== "planar" && faceVertexIndices.length >= 4) {
          featureData = extractCylindricalData(positions, normals, faceVertexIndices);
        } else if (faceType === "planar" && faceVertexIndices.length >= 6) {
          featureData = extractCylindricalData(positions, normals, faceVertexIndices);
        }

        const currentFaceIndex = meshes.length;
        meshes.push({
          index: currentFaceIndex,
          name: `${mesh.name || `Mesh_${i}`}_Face_${faceIdx}`,
          vertexCount: faceVertexIndices.length,
          faceType,
          color: [Math.round(fc[0] * 255), Math.round(fc[1] * 255), Math.round(fc[2] * 255)],
          area,
          ...(featureData || {}),
        });

        // Build per-face geometry for raycasting (only planar faces worth picking)
        if (faceType === "planar" && area > 0.5) {
          const faceGeo = buildFaceGeometry(positions, normals, triangleIndices, faceVertexIndices);
          if (faceGeo) {
            faceGeometries.push({
              geometry: faceGeo.geometry,
              faceIndex: currentFaceIndex,
              normal: faceGeo.normal,
              center: faceGeo.center,
            });
          }
        }
      }
    } else {
      const allVertexIndices = Array.from({ length: vertexCount }, (_, idx) => idx);
      const area = computeMeshArea(positions, index);
      const faceType = classifyFace(normals, allVertexIndices);
      let featureData: Partial<StepFaceInfo> | undefined;
      if (allVertexIndices.length >= 4) {
        featureData = extractCylindricalData(positions, normals, allVertexIndices);
      }

      const currentFaceIndex = meshes.length;
      meshes.push({
        index: currentFaceIndex,
        name: mesh.name || `Face_${i}`,
        vertexCount,
        faceType,
        color,
        area,
        ...(featureData || {}),
      });

      if (faceType === "planar" && area > 0.5) {
        const faceGeo = buildFaceGeometry(positions, normals, Array.from(index), allVertexIndices);
        if (faceGeo) {
          faceGeometries.push({
            geometry: faceGeo.geometry,
            faceIndex: currentFaceIndex,
            normal: faceGeo.normal,
            center: faceGeo.center,
          });
        }
      }
    }

    for (let j = 0; j < positions.length; j++) mergedPositions.push(positions[j]);
    if (normals) {
      for (let j = 0; j < normals.length; j++) mergedNormals.push(normals[j]);
    }
    for (let j = 0; j < vertexCount; j++) {
      mergedColors.push(vertexColors[j * 3], vertexColors[j * 3 + 1], vertexColors[j * 3 + 2]);
    }
    for (let j = 0; j < index.length; j++) mergedIndices.push(index[j] + vertexOffset);
    vertexOffset += vertexCount;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mergedPositions, 3));
  if (mergedNormals.length > 0) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mergedNormals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(mergedColors, 3));
  geometry.setIndex(mergedIndices);
  geometry.computeBoundingBox();

  const alignmentQuaternion = computeAlignmentQuaternion(meshes);

  return {
    geometry,
    meshes,
    boundingBox: geometry.boundingBox!,
    alignmentQuaternion,
    faceGeometries,
  };
}

function buildFaceGeometry(
  positions: Float32Array | number[],
  normals: Float32Array | number[] | undefined,
  triangleIndices: number[],
  vertexIndices: number[]
): { geometry: THREE.BufferGeometry; normal: THREE.Vector3; center: THREE.Vector3 } | null {
  if (vertexIndices.length < 3) return null;

  // Compute average normal and center
  const avgNormal = new THREE.Vector3();
  const center = new THREE.Vector3();
  for (const vi of vertexIndices) {
    center.add(new THREE.Vector3(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]));
    if (normals) {
      avgNormal.add(new THREE.Vector3(normals[vi * 3], normals[vi * 3 + 1], normals[vi * 3 + 2]));
    }
  }
  center.divideScalar(vertexIndices.length);
  if (avgNormal.lengthSq() > 0) avgNormal.normalize();

  // Build a standalone geometry for this face
  const vertexMap = new Map<number, number>();
  const facePositions: number[] = [];
  const faceNormals: number[] = [];
  let newIdx = 0;
  for (const vi of vertexIndices) {
    if (!vertexMap.has(vi)) {
      vertexMap.set(vi, newIdx++);
      facePositions.push(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]);
      if (normals) faceNormals.push(normals[vi * 3], normals[vi * 3 + 1], normals[vi * 3 + 2]);
    }
  }
  const faceIndices: number[] = [];
  for (const ti of triangleIndices) {
    faceIndices.push(vertexMap.get(ti) ?? 0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(facePositions, 3));
  if (faceNormals.length > 0) geo.setAttribute("normal", new THREE.Float32BufferAttribute(faceNormals, 3));
  geo.setIndex(faceIndices);

  return { geometry: geo, normal: avgNormal, center };
}

/**
 * Compute alignment quaternion from two user-selected face normals.
 * zNormal becomes Z+, xNormal provides the X+ reference direction.
 */
export function computeAlignmentFromFaces(
  zNormal: THREE.Vector3,
  xNormal: THREE.Vector3
): THREE.Quaternion {
  const zDir = zNormal.clone().normalize();
  const zUp = new THREE.Vector3(0, 0, 1);

  // First rotation: align zNormal to Z+
  const q1 = new THREE.Quaternion().setFromUnitVectors(zDir, zUp);

  // Rotate xNormal by q1 to find where it ends up
  const xRotated = xNormal.clone().normalize().applyQuaternion(q1);

  // Project onto XY plane (Z=0) to get the X reference
  xRotated.z = 0;
  if (xRotated.lengthSq() < 1e-6) {
    // xNormal was parallel to zNormal, can't determine X
    return q1;
  }
  xRotated.normalize();

  // Second rotation: rotate around Z to align xRotated with X+
  const xAxis = new THREE.Vector3(1, 0, 0);
  const q2 = new THREE.Quaternion().setFromUnitVectors(xRotated, xAxis);

  // Combined: first q1, then q2
  return q2.multiply(q1);
}

/**
 * Compute quaternion that rotates the normal of the largest planar face to Z+.
 */
function computeAlignmentQuaternion(meshes: StepFaceInfo[]): THREE.Quaternion {
  const zUp = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion();

  // Find the largest planar face
  let largestPlanar: StepFaceInfo | null = null;
  for (const m of meshes) {
    if (m.faceType === "planar" && m.normal) {
      if (!largestPlanar || m.area > largestPlanar.area) {
        largestPlanar = m;
      }
    }
  }

  if (largestPlanar?.normal) {
    const faceNormal = new THREE.Vector3(...largestPlanar.normal).normalize();
    q.setFromUnitVectors(faceNormal, zUp);
  }

  return q;
}

/**
 * Classify a face by analyzing normals.
 * Uses multiple strategies to detect cylindrical faces (holes):
 * 1. Planarity check — all normals same direction
 * 2. Cross-product axis detection with WIDE sampling pairs (not just consecutive)
 * 3. PCA-like check — normals span 2D (cylinder) vs 1D (plane) vs 3D (freeform)
 * 4. Average normal cancellation fallback
 */
function classifyFace(
  normals?: Float32Array | number[],
  vertexIndices?: number[]
): StepFaceInfo["faceType"] {
  if (!normals || !vertexIndices || vertexIndices.length < 3) return "unknown";

  // Collect evenly-spaced sample normals
  const sampleCount = Math.min(vertexIndices.length, 80);
  const sampleNormals: THREE.Vector3[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const sampleIdx = Math.floor((i / sampleCount) * vertexIndices.length);
    const idx = vertexIndices[sampleIdx];
    const n = new THREE.Vector3(normals[idx * 3], normals[idx * 3 + 1], normals[idx * 3 + 2]);
    if (n.lengthSq() > 0.001) {
      n.normalize();
      sampleNormals.push(n);
    }
  }

  if (sampleNormals.length < 3) return "unknown";

  // === Strategy 1: Planarity — all normals ~same direction ===
  const n0 = sampleNormals[0];
  let allPlanar = true;
  for (let i = 1; i < sampleNormals.length; i++) {
    if (Math.abs(n0.dot(sampleNormals[i])) < 0.97) {
      allPlanar = false;
      break;
    }
  }
  if (allPlanar) return "planar";

  // === Strategy 2: Cross-product axis with WIDE pairs ===
  // Use pairs spread across the sample to get meaningful cross products
  const axes: THREE.Vector3[] = [];
  const step = Math.max(1, Math.floor(sampleNormals.length / 6));
  for (let i = 0; i < sampleNormals.length; i += step) {
    for (let j = i + step; j < sampleNormals.length; j += step) {
      const cross = new THREE.Vector3().crossVectors(sampleNormals[i], sampleNormals[j]);
      if (cross.length() > 0.005) {
        cross.normalize();
        axes.push(cross);
      }
      if (axes.length > 15) break;
    }
    if (axes.length > 15) break;
  }

  if (axes.length >= 2) {
    // Orient axes consistently
    const ref = axes[0];
    for (const ax of axes) {
      if (ax.dot(ref) < 0) ax.negate();
    }
    // Check consistency
    let consistent = 0;
    for (const ax of axes) {
      if (Math.abs(ref.dot(ax)) > 0.85) consistent++;
    }
    if (consistent / axes.length > 0.5) {
      // Compute average axis
      const avgAxis = new THREE.Vector3();
      for (const ax of axes) avgAxis.add(ax);
      avgAxis.normalize();

      // Verify: normals should be roughly perpendicular to axis
      let perpCount = 0;
      for (const n of sampleNormals) {
        if (Math.abs(avgAxis.dot(n)) < 0.4) perpCount++;
      }
      if (perpCount / sampleNormals.length > 0.5) {
        return "cylindrical";
      }
    }
  }

  // === Strategy 3: Normal variance analysis ===
  // Compute covariance matrix of normals to check dimensionality
  const mean = new THREE.Vector3();
  for (const n of sampleNormals) mean.add(n);
  mean.divideScalar(sampleNormals.length);

  // Compute 3x3 covariance
  const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // row-major
  for (const n of sampleNormals) {
    const d = [n.x - mean.x, n.y - mean.y, n.z - mean.z];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        cov[r * 3 + c] += d[r] * d[c];
      }
    }
  }

  // Power iteration to find largest eigenvalue direction
  let ev = new THREE.Vector3(1, 1, 1).normalize();
  for (let iter = 0; iter < 20; iter++) {
    const next = new THREE.Vector3(
      cov[0] * ev.x + cov[1] * ev.y + cov[2] * ev.z,
      cov[3] * ev.x + cov[4] * ev.y + cov[5] * ev.z,
      cov[6] * ev.x + cov[7] * ev.y + cov[8] * ev.z
    );
    if (next.length() < 1e-10) break;
    next.normalize();
    ev = next;
  }

  // Check how much variance is captured by the first eigenvector
  let varAlongEv = 0, totalVar = 0;
  for (const n of sampleNormals) {
    const d = new THREE.Vector3(n.x - mean.x, n.y - mean.y, n.z - mean.z);
    varAlongEv += d.dot(ev) ** 2;
    totalVar += d.lengthSq();
  }

  // Cylindrical: normals vary mainly in a 2D plane (first eigenvalue captures ~50-90%)
  // If normals are in a 2D subspace → cylindrical or conical
  const ratio = totalVar > 0 ? varAlongEv / totalVar : 0;
  if (ratio > 0.3 && ratio < 0.95 && totalVar / sampleNormals.length > 0.005) {
    return "cylindrical";
  }

  // === Strategy 4: Average cancellation ===
  const avgLen = mean.length();
  // Full cylinder normals cancel; partial cylinders (holes) partially cancel
  if (avgLen < 0.7 && totalVar / sampleNormals.length > 0.01) {
    return "cylindrical";
  }

  return "unknown";
}

function computePrincipalAxisFromPositions(
  positions: Float32Array | number[],
  vertexIndices: number[]
): THREE.Vector3 {
  if (vertexIndices.length < 3) {
    return new THREE.Vector3(0, 0, 1);
  }

  let cx = 0, cy = 0, cz = 0;
  for (const vi of vertexIndices) {
    cx += positions[vi * 3];
    cy += positions[vi * 3 + 1];
    cz += positions[vi * 3 + 2];
  }
  cx /= vertexIndices.length;
  cy /= vertexIndices.length;
  cz /= vertexIndices.length;

  const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const vi of vertexIndices) {
    const dx = positions[vi * 3] - cx;
    const dy = positions[vi * 3 + 1] - cy;
    const dz = positions[vi * 3 + 2] - cz;
    cov[0] += dx * dx; cov[1] += dx * dy; cov[2] += dx * dz;
    cov[3] += dy * dx; cov[4] += dy * dy; cov[5] += dy * dz;
    cov[6] += dz * dx; cov[7] += dz * dy; cov[8] += dz * dz;
  }

  let axis = new THREE.Vector3(1, 1, 1).normalize();
  for (let iter = 0; iter < 24; iter++) {
    const next = new THREE.Vector3(
      cov[0] * axis.x + cov[1] * axis.y + cov[2] * axis.z,
      cov[3] * axis.x + cov[4] * axis.y + cov[5] * axis.z,
      cov[6] * axis.x + cov[7] * axis.y + cov[8] * axis.z
    );
    if (next.lengthSq() < 1e-12) break;
    axis = next.normalize();
  }
  return axis;
}

function extractCylindricalData(
  positions: Float32Array | number[],
  normals?: Float32Array | number[],
  vertexIndices?: number[]
): Partial<StepFaceInfo> | undefined {
  if (!normals || !vertexIndices || vertexIndices.length < 4) return undefined;

  // Find cylinder axis from cross products of well-separated normals
  const sampled: number[] = [];
  const sampleCount = Math.min(vertexIndices.length, 64);
  for (let i = 0; i < sampleCount; i++) {
    sampled.push(vertexIndices[Math.floor((i / sampleCount) * vertexIndices.length)]);
  }

  const sampleNormals: THREE.Vector3[] = [];
  for (const vi of sampled) {
    const n = new THREE.Vector3(normals[vi * 3], normals[vi * 3 + 1], normals[vi * 3 + 2]);
    if (n.lengthSq() > 1e-6) {
      sampleNormals.push(n.normalize());
    }
  }

  if (sampleNormals.length < 3) return undefined;

  const axes: THREE.Vector3[] = [];
  const step = Math.max(1, Math.floor(sampleNormals.length / 6));
  for (let i = 0; i < sampleNormals.length; i += step) {
    for (let j = i + step; j < sampleNormals.length; j += step) {
      const cross = new THREE.Vector3().crossVectors(sampleNormals[i], sampleNormals[j]);
      if (cross.lengthSq() < 2.5e-5) continue;
      cross.normalize();
      axes.push(cross);
      if (axes.length > 20) break;
    }
    if (axes.length > 20) break;
  }

  // Average axis direction
  let axis = computePrincipalAxisFromPositions(positions, vertexIndices);
  if (axes.length >= 2) {
    const ref = axes[0];
    const avgAxis = new THREE.Vector3();
    for (const a of axes) {
      // Ensure consistent direction
      if (a.dot(ref) < 0) a.negate();
      avgAxis.add(a);
    }
    if (avgAxis.lengthSq() > 1e-6) {
      axis = avgAxis.normalize();
    }
  }

  // Project positions onto axis to get depth, and onto perpendicular plane for radius
  let cx = 0, cy = 0, cz = 0;
  for (const vi of vertexIndices) {
    cx += positions[vi * 3];
    cy += positions[vi * 3 + 1];
    cz += positions[vi * 3 + 2];
  }
  cx /= vertexIndices.length;
  cy /= vertexIndices.length;
  cz /= vertexIndices.length;
  const center = new THREE.Vector3(cx, cy, cz);

  // Project onto axis for depth
  let minProj = Infinity, maxProj = -Infinity;
  const radii: number[] = [];

  const basisU = Math.abs(axis.z) < 0.9
    ? new THREE.Vector3(0, 0, 1).cross(axis).normalize()
    : new THREE.Vector3(0, 1, 0).cross(axis).normalize();
  const basisV = new THREE.Vector3().crossVectors(axis, basisU).normalize();

  const bins = 24;
  const occupied = new Set<number>();

  for (const vi of vertexIndices) {
    const p = new THREE.Vector3(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]);
    const rel = p.clone().sub(center);
    const proj = rel.dot(axis);
    minProj = Math.min(minProj, proj);
    maxProj = Math.max(maxProj, proj);

    // Perpendicular distance = radius
    const along = axis.clone().multiplyScalar(proj);
    const perp = rel.clone().sub(along);
    const radius = perp.length();
    radii.push(radius);

    const ang = Math.atan2(perp.dot(basisV), perp.dot(basisU));
    const normAng = (ang + Math.PI) / (2 * Math.PI);
    occupied.add(Math.min(bins - 1, Math.max(0, Math.floor(normAng * bins))));
  }

  const avgR = radii.reduce((sum, r) => sum + r, 0) / radii.length;
  const varianceR = radii.reduce((sum, r) => sum + (r - avgR) ** 2, 0) / radii.length;
  const stdR = Math.sqrt(varianceR);
  const radialCoV = avgR > 1e-6 ? stdR / avgR : Infinity;
  const angularCoverage = occupied.size / bins;

  const diameter = avgR * 2;
  const depth = maxProj - minProj;

  if (!Number.isFinite(diameter) || !Number.isFinite(depth)) return undefined;
  if (diameter < 0.01 || depth < 0.005) return undefined;
  if (radialCoV > 0.5) return undefined;
  if (angularCoverage < 0.08) return undefined;

  return {
    estimatedDiameter: Math.round(diameter * 100) / 100,
    estimatedDepth: Math.round(depth * 100) / 100,
    center: [Math.round(cx * 100) / 100, Math.round(cy * 100) / 100, Math.round(cz * 100) / 100],
    normal: [axis.x, axis.y, axis.z],
  };
}

export function detectFeatures(meshData: StepMeshData): DetectedFeature[] {
  const features: DetectedFeature[] = [];
  const bboxSize = new THREE.Vector3();
  meshData.boundingBox.getSize(bboxSize);
  const maxDim = Math.max(bboxSize.x, bboxSize.y, bboxSize.z);

  // Log face classification summary for debugging
  const typeCounts: Record<string, number> = {};
  for (const mesh of meshData.meshes) {
    typeCounts[mesh.faceType] = (typeCounts[mesh.faceType] || 0) + 1;
  }
  logStepDebug("[STEP] Face classification:", typeCounts);

  for (const mesh of meshData.meshes) {
    if (!mesh.estimatedDiameter || !mesh.center || !mesh.normal) continue;
    if (mesh.estimatedDiameter < 0.05) continue;
    if (mesh.estimatedDepth != null && mesh.estimatedDepth < 0.01) continue;

    // Remove model-scale cylindrical surfaces (typically outer body) from hole candidates.
    if (mesh.estimatedDiameter > maxDim * 0.6) continue;

    const depth = mesh.estimatedDepth ?? 0;
    const depthDiaRatio = depth / mesh.estimatedDiameter;

    // Reject very long cylindrical surfaces that are usually outer/structural geometry (not holes)
    if (depth > maxDim * 0.85) {
      logStepDebug(`[STEP] Skipping long cylindrical surface: d=${mesh.estimatedDiameter} depth=${depth} face=${mesh.name}`);
      continue;
    }
    if (depthDiaRatio > 20 && depth > maxDim * 0.2) {
      logStepDebug(`[STEP] Skipping extreme depth/diameter surface: d=${mesh.estimatedDiameter} depth=${depth} ratio=${depthDiaRatio.toFixed(2)} face=${mesh.name}`);
      continue;
    }

    // Filter chamfers/fillets: very shallow depth relative to diameter
    if (depthDiaRatio < 0.2 && depthDiaRatio > 0) {
      logStepDebug(`[STEP] Skipping chamfer/fillet: d=${mesh.estimatedDiameter} depth=${depth} ratio=${depthDiaRatio.toFixed(3)} face=${mesh.name}`);
      continue;
    }

    // Filter planar faces that look circular (hole bottoms) — they have faceType=planar but extractCylindricalData found a diameter
    if (mesh.faceType === "planar") {
      logStepDebug(`[STEP] Skipping planar circular face (hole bottom): d=${mesh.estimatedDiameter} face=${mesh.name}`);
      continue;
    }

    logStepDebug(`[STEP] Candidate hole: d=${mesh.estimatedDiameter} depth=${depth} depthDiaRatio=${depthDiaRatio.toFixed(2)} normal=[${mesh.normal?.map(n=>n.toFixed(2))}] face=${mesh.name} type=${mesh.faceType}`);

    features.push({
      type: "hole",
      diameter: mesh.estimatedDiameter,
      depth: mesh.estimatedDepth,
      center: mesh.center,
      normal: mesh.normal,
      faceIndices: [mesh.index],
    });
  }

  logStepDebug("[STEP] Raw candidate features:", features.length);
  // Skip outlier filter when count is low — likely all real holes
  const filtered = features.length > 30 ? filterDiameterOutliers(features) : features;
  logStepDebug("[STEP] After outlier filter:", filtered.length);
  const merged = mergeNearbyFeatures(filtered);
  logStepDebug("[STEP] Post-merge features:", merged.length);

  // Classify holes as through (Passante) or blind (Cego)
  for (const f of merged) {
    if (f.type !== "hole" || f.depth == null) continue;
    const n = new THREE.Vector3(...f.normal).normalize();
    const c = new THREE.Vector3(...f.center);
    // Project bounding box extents onto hole normal to get model thickness along that direction
    const corners = [
      new THREE.Vector3(meshData.boundingBox.min.x, meshData.boundingBox.min.y, meshData.boundingBox.min.z),
      new THREE.Vector3(meshData.boundingBox.max.x, meshData.boundingBox.min.y, meshData.boundingBox.min.z),
      new THREE.Vector3(meshData.boundingBox.min.x, meshData.boundingBox.max.y, meshData.boundingBox.min.z),
      new THREE.Vector3(meshData.boundingBox.max.x, meshData.boundingBox.max.y, meshData.boundingBox.min.z),
      new THREE.Vector3(meshData.boundingBox.min.x, meshData.boundingBox.min.y, meshData.boundingBox.max.z),
      new THREE.Vector3(meshData.boundingBox.max.x, meshData.boundingBox.min.y, meshData.boundingBox.max.z),
      new THREE.Vector3(meshData.boundingBox.min.x, meshData.boundingBox.max.y, meshData.boundingBox.max.z),
      new THREE.Vector3(meshData.boundingBox.max.x, meshData.boundingBox.max.y, meshData.boundingBox.max.z),
    ];
    const projections = corners.map(c => c.dot(n));
    const thickness = Math.max(...projections) - Math.min(...projections);
    // A through hole's depth is close to the model thickness along its axis (within 20% tolerance)
    const ratio = f.depth / thickness;
    f._ratio = ratio;
    f.holeType = ratio >= 0.75 ? "Passante" : "Cego";
    logStepDebug(`[STEP] Hole d=${f.diameter} depth=${f.depth} thickness=${thickness.toFixed(2)} ratio=${ratio.toFixed(2)} => ${f.holeType}`);
  }

  return merged;
}

function filterDiameterOutliers(features: DetectedFeature[]): DetectedFeature[] {
  if (features.length < 5) return features;

  const diameters = features
    .map((f) => f.diameter)
    .filter((d): d is number => typeof d === "number")
    .sort((a, b) => a - b);

  if (diameters.length < 5) return features;

  const q1 = diameters[Math.floor((diameters.length - 1) * 0.25)];
  const q3 = diameters[Math.floor((diameters.length - 1) * 0.75)];
  const iqr = q3 - q1;
  const min = Math.max(0.05, q1 - 1.5 * iqr);
  const max = q3 + 2.5 * iqr;

  return features.filter((f) => {
    const d = f.diameter ?? 0;
    return d >= min && d <= max;
  });
}

function mergeNearbyFeatures(features: DetectedFeature[], tolerance = 0.5): DetectedFeature[] {
  const merged: DetectedFeature[] = [];
  const used = new Set<number>();

  const isSameHoleCluster = (a: DetectedFeature, b: DetectedFeature): boolean => {
    const na = new THREE.Vector3(...a.normal).normalize();
    const nb = new THREE.Vector3(...b.normal).normalize();
    const nDot = Math.abs(na.dot(nb));
    if (nDot < 0.78) return false;

    const diaA = a.diameter ?? 1;
    const diaB = b.diameter ?? 1;
    const diaRatio = diaA / diaB;
    if (diaRatio <= 0.3 || diaRatio >= 3.2) return false;

    // Strategy 1: "Signature match" — same Ø (±5%), same depth (±10%), same normal
    // These are B-REP face segments of the same cylinder, merge regardless of center distance
    if (nDot > 0.95) {
      const diaClose = Math.abs(diaA - diaB) / Math.max(diaA, diaB) < 0.05;
      const depA = a.depth ?? 0;
      const depB = b.depth ?? 0;
      const depClose = depA > 0 && depB > 0 && Math.abs(depA - depB) / Math.max(depA, depB) < 0.10;
      if (diaClose && depClose) {
        return true;
      }
    }

    // Strategy 2: Coaxial proximity — different depth/diameter but same axis position
    const axis = na.clone().add(nb);
    if (axis.lengthSq() < 1e-8) return false;
    axis.normalize();

    const dx = b.center[0] - a.center[0];
    const dy = b.center[1] - a.center[1];
    const dz = b.center[2] - a.center[2];
    const alongAxis = dx * axis.x + dy * axis.y + dz * axis.z;
    const perpDist = Math.sqrt(
      (dx - alongAxis * axis.x) ** 2 +
      (dy - alongAxis * axis.y) ** 2 +
      (dz - alongAxis * axis.z) ** 2
    );

    const avgDia = (diaA + diaB) * 0.5;
    const localTol = Math.max(tolerance, avgDia * 1.2);

    return perpDist < localTol;
  };

  for (let i = 0; i < features.length; i++) {
    if (used.has(i)) continue;

    const cluster: number[] = [i];
    used.add(i);

    let expanded = true;
    while (expanded) {
      expanded = false;
      for (let j = 0; j < features.length; j++) {
        if (used.has(j)) continue;
        if (cluster.some((k) => isSameHoleCluster(features[k], features[j]))) {
          cluster.push(j);
          used.add(j);
          expanded = true;
        }
      }
    }

    const group = cluster.map((idx) => features[idx]);

    // Keep the feature with the greatest depth (typically the actual hole body)
    const best = group.reduce((a, b) => ((b.depth ?? 0) > (a.depth ?? 0) ? b : a));
    best.faceIndices = group.flatMap((f) => f.faceIndices);
    if (group.length > 1) {
      best.depth = Math.max(...group.map((f) => f.depth ?? 0));
    }
    merged.push(best);
  }

  return merged;
}
