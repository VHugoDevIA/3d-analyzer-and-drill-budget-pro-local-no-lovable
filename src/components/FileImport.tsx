import { useCallback } from "react";
import { Upload, FileText, Box } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { parseCSV, parseJSON } from "@/lib/csv-parser";
import { HoleData } from "@/types/holes";

interface FileImportProps {
  onImport: (holes: HoleData[], fileName: string) => void;
  onStepImport?: (buffer: ArrayBuffer, fileName: string) => void;
}

export function FileImport({ onImport, onStepImport }: FileImportProps) {
  const handleFile = useCallback(
    (file: File) => {
      const name = file.name.toLowerCase();
      if ((name.endsWith(".step") || name.endsWith(".stp")) && onStepImport) {
        file.arrayBuffer().then((buffer) => onStepImport(buffer, file.name));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const holes = file.name.endsWith(".json") ? parseJSON(text) : parseCSV(text);
        if (holes.length > 0) {
          onImport(holes, file.name);
        }
      };
      reader.readAsText(file);
    },
    [onImport, onStepImport]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.json,.txt,.step,.stp";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }, [handleFile]);

  return (
    <Card
      className="border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors cursor-pointer group"
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">
            Importar dados de furação
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Arraste um ficheiro CSV, JSON ou STEP, ou clique para selecionar
          </p>
        </div>
        <div className="flex gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-md">
            <FileText className="w-3 h-3" /> CSV
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-md">
            <FileText className="w-3 h-3" /> JSON
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-md">
            <Box className="w-3 h-3" /> STEP
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
