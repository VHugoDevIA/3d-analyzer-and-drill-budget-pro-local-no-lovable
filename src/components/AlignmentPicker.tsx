import { useRef, useMemo, useState, Suspense, useCallback } from "react";
import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Html } from "@react-three/drei";
import * as THREE from "three";
import { StepMeshData, computeAlignmentFromFaces } from "@/lib/step-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowUp, ArrowRight, RotateCcw, Check } from "lucide-react";

interface AlignmentPickerProps {
  meshData: StepMeshData;
  onConfirm: (alignmentQuaternion: THREE.Quaternion) => void;
  onSkip: () => void;
}

type SelectionStep = "z+" | "x+" | "done";

interface SelectedFace {
  faceIndex: number;
  normal: THREE.Vector3;
  center: THREE.Vector3;
}

function ModelMesh({ meshData }: { meshData: StepMeshData }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.3,
        roughness: 0.5,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    []
  );

  return <mesh geometry={meshData.geometry} material={material} castShadow receiveShadow />;
}

function ClickableFaces({
  faceGeometries,
  onFaceClick,
  selectedZ,
  selectedX,
  step,
}: {
  faceGeometries: StepMeshData["faceGeometries"];
  onFaceClick: (face: { faceIndex: number; normal: THREE.Vector3; center: THREE.Vector3 }) => void;
  selectedZ: SelectedFace | null;
  selectedX: SelectedFace | null;
  step: SelectionStep;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <group>
      {faceGeometries.map((fg) => {
        const isSelectedZ = selectedZ?.faceIndex === fg.faceIndex;
        const isSelectedX = selectedX?.faceIndex === fg.faceIndex;
        const isHovered = hoveredIndex === fg.faceIndex;
        const isSelectable = step !== "done";

        let color = "#ffffff";
        let opacity = 0.0;

        if (isSelectedZ) {
          color = "#3b82f6";
          opacity = 0.5;
        } else if (isSelectedX) {
          color = "#22c55e";
          opacity = 0.5;
        } else if (isHovered && isSelectable) {
          color = step === "z+" ? "#60a5fa" : "#4ade80";
          opacity = 0.35;
        }

        return (
          <mesh
            key={fg.faceIndex}
            geometry={fg.geometry}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              if (isSelectable) onFaceClick({ faceIndex: fg.faceIndex, normal: fg.normal, center: fg.center });
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              if (isSelectable) setHoveredIndex(fg.faceIndex);
            }}
            onPointerOut={() => setHoveredIndex(null)}
          >
            <meshStandardMaterial
              color={color}
              transparent
              opacity={opacity}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function NormalArrow({ origin, direction, color, length }: { origin: THREE.Vector3; direction: THREE.Vector3; color: string; length: number }) {
  const arrowLength = length * 0.3;
  const dir = direction.clone().normalize();
  const end = origin.clone().add(dir.clone().multiplyScalar(arrowLength));

  const points = useMemo(() => [origin, end], [origin, end]);
  const lineGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  // Compute cone orientation to point along the normal direction
  const coneQuaternion = useMemo(() => {
    const defaultDir = new THREE.Vector3(0, 1, 0); // cone default points up
    return new THREE.Quaternion().setFromUnitVectors(defaultDir, dir);
  }, [dir]);

  return (
    <group>
      <primitive object={new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color }))} />
      <mesh position={end} quaternion={coneQuaternion}>
        <coneGeometry args={[arrowLength * 0.08, arrowLength * 0.2, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>A carregar modelo...</span>
      </div>
    </Html>
  );
}

export function AlignmentPicker({ meshData, onConfirm, onSkip }: AlignmentPickerProps) {
  const [step, setStep] = useState<SelectionStep>("z+");
  const [selectedZ, setSelectedZ] = useState<SelectedFace | null>(null);
  const [selectedX, setSelectedX] = useState<SelectedFace | null>(null);

  const { cameraPosition, targetPosition, maxDim } = useMemo(() => {
    const box = meshData.boundingBox;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const center = new THREE.Vector3();
    box.getCenter(center);

    return {
      cameraPosition: [center.x + maxDim * 1.2, center.y + maxDim * 0.8, center.z + maxDim * 1.5] as [number, number, number],
      targetPosition: [center.x, center.y, center.z] as [number, number, number],
      maxDim,
    };
  }, [meshData]);

  const handleFaceClick = useCallback(
    (face: { faceIndex: number; normal: THREE.Vector3; center: THREE.Vector3 }) => {
      if (step === "z+") {
        setSelectedZ(face);
        setStep("x+");
      } else if (step === "x+") {
        // Don't allow same face or parallel normal
        if (selectedZ && Math.abs(selectedZ.normal.dot(face.normal)) > 0.95) {
          return; // too parallel, not useful for X
        }
        setSelectedX(face);
        setStep("done");
      }
    },
    [step, selectedZ]
  );

  const handleReset = useCallback(() => {
    setSelectedZ(null);
    setSelectedX(null);
    setStep("z+");
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedZ && selectedX) {
      const q = computeAlignmentFromFaces(selectedZ.normal, selectedX.normal);
      onConfirm(q);
    }
  }, [selectedZ, selectedX, onConfirm]);

  const stepLabel = step === "z+" ? "Selecione a face para Z+ (topo)" : step === "x+" ? "Selecione a face para X+ (frente)" : "Alinhamento definido!";
  const stepColor = step === "z+" ? "text-blue-500" : step === "x+" ? "text-green-500" : "text-primary";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Alinhamento do Modelo
          </CardTitle>
          <p className={`text-sm font-semibold ${stepColor} flex items-center gap-1.5`}>
            <span className="inline-flex w-4 h-4 shrink-0" aria-hidden="true">
              <ArrowUp className={`w-4 h-4 ${step === "z+" ? "block" : "hidden"}`} />
              <ArrowRight className={`w-4 h-4 ${step === "x+" ? "block" : "hidden"}`} />
              <Check className={`w-4 h-4 ${step === "done" ? "block" : "hidden"}`} />
            </span>
            <span>{stepLabel}</span>
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[500px] bg-gradient-to-b from-muted/30 to-muted/60 cursor-crosshair">
            <Canvas shadows>
              <Suspense fallback={<LoadingFallback />}>
                <PerspectiveCamera makeDefault position={cameraPosition} fov={45} />
                <OrbitControls target={targetPosition} enableDamping dampingFactor={0.1} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 10]} intensity={0.8} castShadow />
                <directionalLight position={[-10, -5, -10]} intensity={0.3} />
                <ModelMesh meshData={meshData} />
                <ClickableFaces
                  faceGeometries={meshData.faceGeometries}
                  onFaceClick={handleFaceClick}
                  selectedZ={selectedZ}
                  selectedX={selectedX}
                  step={step}
                />
                {selectedZ && (
                  <NormalArrow
                    origin={selectedZ.center}
                    direction={selectedZ.normal}
                    color="#3b82f6"
                    length={maxDim}
                  />
                )}
                {selectedX && (
                  <NormalArrow
                    origin={selectedX.center}
                    direction={selectedX.normal}
                    color="#22c55e"
                    length={maxDim}
                  />
                )}
              </Suspense>
            </Canvas>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Instruções</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`flex items-start gap-2 p-2 rounded-md border transition-colors ${step === "z+" ? "border-blue-500 bg-blue-500/5" : selectedZ ? "border-border bg-muted/30" : "border-border"}`}>
              <Badge variant={selectedZ ? "default" : "outline"} className="text-[10px] mt-0.5 shrink-0 bg-blue-500">
                1
              </Badge>
              <div>
                <p className="text-xs font-semibold">Face Z+ (Topo)</p>
                <p className="text-xs text-muted-foreground">
                  Clique na face que deve ficar orientada para cima
                </p>
                {selectedZ && (
                  <p className="text-xs text-blue-500 font-mono mt-1">
                    Normal: [{selectedZ.normal.x.toFixed(2)}, {selectedZ.normal.y.toFixed(2)}, {selectedZ.normal.z.toFixed(2)}]
                  </p>
                )}
              </div>
            </div>

            <div className={`flex items-start gap-2 p-2 rounded-md border transition-colors ${step === "x+" ? "border-green-500 bg-green-500/5" : selectedX ? "border-border bg-muted/30" : "border-border"}`}>
              <Badge variant={selectedX ? "default" : "outline"} className="text-[10px] mt-0.5 shrink-0 bg-green-500">
                2
              </Badge>
              <div>
                <p className="text-xs font-semibold">Face X+ (Frente)</p>
                <p className="text-xs text-muted-foreground">
                  Clique na face que deve ficar orientada para a frente
                </p>
                {selectedX && (
                  <p className="text-xs text-green-500 font-mono mt-1">
                    Normal: [{selectedX.normal.x.toFixed(2)}, {selectedX.normal.y.toFixed(2)}, {selectedX.normal.z.toFixed(2)}]
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              {meshData.faceGeometries.length} faces planares disponíveis para seleção
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="flex-1"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Recomeçar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={step !== "done"}
                className="flex-1"
              >
                <Check className="w-3 h-3 mr-1" />
                Confirmar
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="w-full text-xs text-muted-foreground"
            >
              Saltar — usar alinhamento automático
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
