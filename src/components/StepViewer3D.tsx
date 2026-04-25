import { useRef, useMemo, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Html } from "@react-three/drei";
import * as THREE from "three";
import { StepMeshData, DetectedFeature } from "@/lib/step-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Box, Circle, Cylinder } from "lucide-react";

interface StepViewer3DProps {
  meshData: StepMeshData;
  features: DetectedFeature[];
}

function ModelMesh({ meshData }: { meshData: StepMeshData }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.3,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
    []
  );

  return (
    <group quaternion={meshData.alignmentQuaternion}>
      <mesh ref={meshRef} geometry={meshData.geometry} material={material} castShadow receiveShadow />
    </group>
  );
}

function FeatureMarkers({ features, quaternion }: { features: DetectedFeature[]; quaternion: THREE.Quaternion }) {
  return (
    <group quaternion={quaternion}>
      {features.map((f, i) => (
        <group key={i} position={f.center}>
          <mesh>
            <sphereGeometry args={[Math.max((f.diameter ?? 2) * 0.3, 0.5), 16, 16]} />
            <meshStandardMaterial
              color={f.type === "hole" ? "#ef4444" : "#3b82f6"}
              transparent
              opacity={0.5}
            />
          </mesh>
        </group>
      ))}
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

export function StepViewer3D({ meshData, features }: StepViewer3DProps) {
  const [showFeatures, setShowFeatures] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<DetectedFeature | null>(null);

  const { cameraPosition, targetPosition } = useMemo(() => {
    const box = meshData.boundingBox;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Apply alignment quaternion to center
    const rotCenter = center.clone().applyQuaternion(meshData.alignmentQuaternion);

    return {
      cameraPosition: [rotCenter.x + maxDim * 1.2, rotCenter.y + maxDim * 0.8, rotCenter.z + maxDim * 1.5] as [number, number, number],
      targetPosition: [rotCenter.x, rotCenter.y, rotCenter.z] as [number, number, number],
    };
  }, [meshData]);

  const holes = features.filter((f) => f.type === "hole");
  const faceStats = meshData.meshes.reduce(
    (acc, m) => {
      acc[m.faceType] = (acc[m.faceType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="h-[500px] bg-gradient-to-b from-muted/30 to-muted/60">
            <Canvas shadows>
              <Suspense fallback={<LoadingFallback />}>
                <PerspectiveCamera makeDefault position={cameraPosition} fov={45} />
                <OrbitControls target={targetPosition} enableDamping dampingFactor={0.1} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 10]} intensity={0.8} castShadow />
                <directionalLight position={[-10, -5, -10]} intensity={0.3} />
                <directionalLight position={[0, 0, -10]} intensity={0.2} />
                <ModelMesh meshData={meshData} />
                {showFeatures && <FeatureMarkers features={features} quaternion={meshData.alignmentQuaternion} />}
              </Suspense>
            </Canvas>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Box className="w-4 h-4" />
              Estatísticas do Modelo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Faces total</span>
              <span className="font-mono">{meshData.meshes.length}</span>
            </div>
            {Object.entries(faceStats).map(([type, count]) => (
              <div key={type} className="flex justify-between text-sm">
                <span className="text-muted-foreground capitalize">{type}</span>
                <span className="font-mono">{count}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border">
              <span>Furos detetados</span>
              <span className="text-primary font-mono">{holes.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Cylinder className="w-4 h-4" />
                Features Detetadas ({features.length})
              </CardTitle>
              <button
                onClick={() => setShowFeatures(!showFeatures)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showFeatures ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
            {features.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma feature detetada
              </p>
            ) : (
              features.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedFeature(selectedFeature === f ? null : f)}
                  className={`w-full text-left p-2 rounded-md border transition-colors text-xs ${
                    selectedFeature === f
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {f.type === "hole" ? (
                        <><Circle className="w-3 h-3 mr-1" />Furo</>
                      ) : (
                        f.type
                      )}
                    </Badge>
                    {f.diameter && (
                      <span className="font-mono text-primary">Ø{f.diameter.toFixed(1)}</span>
                    )}
                  </div>
                  {f.depth != null && (
                    <span className="text-muted-foreground">
                      Prof: {f.depth.toFixed(1)}mm
                    </span>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
