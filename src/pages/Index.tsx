import { useState, useMemo, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { HoleData, HoleAxis, PricingRule } from "@/types/holes";
import { calculateBudget, DEFAULT_RULES } from "@/lib/budget-calculator";
import { FileImport } from "@/components/FileImport";
import { HolesTable } from "@/components/HolesTable";
import { PricingEditor } from "@/components/PricingEditor";
import { BudgetView } from "@/components/BudgetView";
import { StatsCards } from "@/components/StatsCards";
import { DiameterDistribution } from "@/components/DiameterDistribution";
import { SummaryView } from "@/components/SummaryView";
import { StepViewer3D } from "@/components/StepViewer3D";
import { AlignmentPicker } from "@/components/AlignmentPicker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CircleDot, Loader2 } from "lucide-react";
import { loadStepFile, detectFeatures, StepMeshData, DetectedFeature } from "@/lib/step-loader";
import { useToast } from "@/hooks/use-toast";
import * as THREE from "three";

function computeAxis(normal: [number, number, number]): HoleAxis {
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

function computeAngle(normal: [number, number, number]): number {
  const [nx, ny, nz] = normal.map(Math.abs);
  const maxComp = Math.max(nx, ny, nz);
  return Math.round(Math.acos(Math.min(1, maxComp)) * (180 / Math.PI) * 10) / 10;
}

function featuresToHoles(
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

      // Re-classify using the adjustable threshold
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

  // Deduplicate: same Ø (±0.01) and same plane position (±0.5mm) → keep deepest
  return deduplicateHoles(raw);
}

function deduplicateHoles(holes: HoleData[]): HoleData[] {
  const result: HoleData[] = [];
  const used = new Set<number>();

  for (let i = 0; i < holes.length; i++) {
    if (used.has(i)) continue;
    let best = holes[i];
    used.add(i);

    for (let j = i + 1; j < holes.length; j++) {
      if (used.has(j)) continue;
      const h = holes[j];
      // Same diameter (±0.05mm)
      if (best.diameter == null || h.diameter == null) continue;
      if (Math.abs(best.diameter - h.diameter) > 0.05) continue;
      // Same normal direction (coaxial)
      const nDot = Math.abs(
        best.normalX * h.normalX + best.normalY * h.normalY + best.normalZ * h.normalZ
      );
      if (nDot < 0.95) continue;
      // Project centers onto the plane perpendicular to the hole axis
      // Distance in that plane must be small (same hole position)
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
      // Keep the one with greater depth
      used.add(j);
      if ((h.depth ?? 0) > (best.depth ?? 0)) {
        best = h;
      }
    }

    result.push(best);
  }

  // Re-number
  return result.map((h, i) => ({ ...h, faceNumber: i + 1 }));
}

type AppPhase = "import" | "alignment" | "analysis";

const Index = () => {
  const [holes, setHoles] = useState<HoleData[]>([]);
  const [fileName, setFileName] = useState("");
  const [rules, setRules] = useState<PricingRule[]>(DEFAULT_RULES);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [stepMesh, setStepMesh] = useState<StepMeshData | null>(null);
  const [stepFeatures, setStepFeatures] = useState<DetectedFeature[]>([]);
  const [loadingStep, setLoadingStep] = useState(false);
  const [phase, setPhase] = useState<AppPhase>("import");
  const [throughThreshold, setThroughThreshold] = useState(0.75);
  const { toast } = useToast();

  const selectedHoles = useMemo(
    () => holes.filter((h) => !excludedIds.has(h.id)),
    [holes, excludedIds]
  );

  const budget = useMemo(
    () => (selectedHoles.length > 0 ? calculateBudget(selectedHoles, rules, fileName) : null),
    [selectedHoles, rules, fileName]
  );

  const handleImport = useCallback((newHoles: HoleData[], name: string) => {
    setHoles(newHoles);
    setFileName(name);
    setExcludedIds(new Set());
    setStepMesh(null);
    setStepFeatures([]);
    setPhase("analysis");
  }, []);

  const handleStepImport = useCallback(async (buffer: ArrayBuffer, name: string) => {
    setLoadingStep(true);
    setFileName(name);
    try {
      const meshData = await loadStepFile(buffer);
      setStepMesh(meshData);
      setStepFeatures([]);
      setHoles([]);
      setExcludedIds(new Set());
      // Go to alignment step
      setPhase("alignment");
      toast({
        title: "STEP carregado",
        description: `${meshData.meshes.length} faces analisadas. Selecione as faces de referência.`,
      });
    } catch (err) {
      console.error("STEP import error:", err);
      toast({
        title: "Erro ao importar STEP",
        description: "Não foi possível processar o ficheiro. Verifique o formato.",
        variant: "destructive",
      });
    } finally {
      setLoadingStep(false);
    }
  }, [toast]);

  const runAnalysis = useCallback(
    (meshData: StepMeshData, alignmentQ: THREE.Quaternion) => {
      const features = detectFeatures(meshData);
      setStepFeatures(features);

      // Update the mesh data alignment quaternion
      const updatedMesh = { ...meshData, alignmentQuaternion: alignmentQ };
      setStepMesh(updatedMesh);

      const holeData = featuresToHoles(features, fileName, alignmentQ, throughThreshold);
      setHoles(holeData);
      setExcludedIds(new Set());
      setPhase("analysis");

      toast({
        title: "Análise concluída",
        description: `${features.length} features detetadas, ${holeData.length} furos identificados`,
      });
    },
    [fileName, toast, throughThreshold]
  );

  // Re-classify holes when threshold changes
  const handleThresholdChange = useCallback((newThreshold: number) => {
    setThroughThreshold(newThreshold);
    if (stepFeatures.length > 0 && stepMesh) {
      const holeData = featuresToHoles(stepFeatures, fileName, stepMesh.alignmentQuaternion, newThreshold);
      setHoles(holeData);
    }
  }, [stepFeatures, stepMesh, fileName]);

  const handleAlignmentConfirm = useCallback(
    (alignmentQ: THREE.Quaternion) => {
      if (stepMesh) runAnalysis(stepMesh, alignmentQ);
    },
    [stepMesh, runAnalysis]
  );

  const handleAlignmentSkip = useCallback(() => {
    if (stepMesh) runAnalysis(stepMesh, stepMesh.alignmentQuaternion);
  }, [stepMesh, runAnalysis]);

  const handleToggleHole = useCallback((id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => setExcludedIds(new Set()), []);
  const handleDeselectAll = useCallback(
    () => setExcludedIds(new Set(holes.map((h) => h.id))),
    [holes]
  );

  const handleNewImport = useCallback(() => {
    setPhase("import");
    setHoles([]);
    setStepMesh(null);
    setStepFeatures([]);
    setFileName("");
    setExcludedIds(new Set());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <CircleDot className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">DrillAnalyzer Pro</h1>
              <p className="text-xs text-muted-foreground">
                Análise de Furação em Modelos 3D
              </p>
            </div>
          </div>
          {phase !== "import" && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                PRO v2.0
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Loading overlay */}
      {loadingStep && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-lg font-semibold">A processar ficheiro STEP...</p>
            <p className="text-sm text-muted-foreground">Isto pode demorar alguns segundos para ficheiros grandes</p>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {phase === "import" && (
          <div className="max-w-lg mx-auto pt-12">
            <FileImport onImport={handleImport} onStepImport={handleStepImport} />
            <p className="text-center text-xs text-muted-foreground mt-4">
              Exporte os dados do FreeCAD como JSON ou importe ficheiros STEP diretamente
            </p>
          </div>
        )}

        {phase === "alignment" && stepMesh && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Ficheiro: <span className="text-foreground">{fileName}</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Passo 1/2 — Defina o alinhamento do modelo antes da análise
                </p>
              </div>
            </div>
            <AlignmentPicker
              meshData={stepMesh}
              onConfirm={handleAlignmentConfirm}
              onSkip={handleAlignmentSkip}
            />
          </>
        )}

        {phase === "analysis" && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Ficheiro: <span className="text-foreground">{fileName}</span>
                </h2>
              </div>
              {stepFeatures.length > 0 && (
                <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2">
                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    Limiar Passante/Cego:
                  </span>
                  <Slider
                    value={[throughThreshold * 100]}
                    onValueChange={([v]) => handleThresholdChange(v / 100)}
                    min={30}
                    max={100}
                    step={5}
                    className="w-32"
                  />
                  <span className="text-xs font-mono font-bold text-primary w-10 text-right">
                    {Math.round(throughThreshold * 100)}%
                  </span>
                </div>
              )}
              <FileImport onImport={handleImport} onStepImport={handleStepImport} />
            </div>

            <StatsCards holes={holes} selectedHoles={selectedHoles} budget={budget} />

            <Tabs defaultValue={stepMesh ? "3d" : "table"} className="space-y-4">
              <TabsList className="bg-secondary">
                {stepMesh && <TabsTrigger value="3d">Vista 3D</TabsTrigger>}
                <TabsTrigger value="table">Tabela de Furos</TabsTrigger>
                <TabsTrigger value="budget">Orçamento</TabsTrigger>
                <TabsTrigger value="summary">Resumo</TabsTrigger>
                <TabsTrigger value="pricing">Preços</TabsTrigger>
              </TabsList>

              {stepMesh && (
                <TabsContent value="3d">
                  <StepViewer3D meshData={stepMesh} features={stepFeatures} />
                </TabsContent>
              )}

              <TabsContent value="table">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
                  <HolesTable
                    holes={holes}
                    excludedIds={excludedIds}
                    onToggleHole={handleToggleHole}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                  />
                  <DiameterDistribution holes={selectedHoles} />
                </div>
              </TabsContent>

              <TabsContent value="budget">
                {budget && <BudgetView budget={budget} />}
              </TabsContent>

              <TabsContent value="summary">
                <SummaryView holes={holes} selectedHoles={selectedHoles} fileName={fileName} />
              </TabsContent>

              <TabsContent value="pricing">
                <PricingEditor rules={rules} onChange={setRules} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
