import { useState, useMemo } from "react";
import { HoleData, HoleAxis, AXIS_ORDER, AXIS_COLORS } from "@/types/holes";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, ChevronUp, CircleDot, Filter, X, CheckSquare, Square, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface HolesTableProps {
  holes: HoleData[];
  excludedIds: Set<string>;
  onToggleHole: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

function fmt(v: number | null, decimals = 2): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(decimals);
}

type SortField = "faceNumber" | "diameter" | "depth" | "angle" | "centerX" | "centerY" | "centerZ" | "type" | null;
type SortDir = "asc" | "desc";

const AXIS_FILTER_OPTIONS = [
  { label: "X+", value: "X+" },
  { label: "X−", value: "X-" },
  { label: "Y+", value: "Y+" },
  { label: "Y−", value: "Y-" },
  { label: "Z+", value: "Z+" },
  { label: "Z−", value: "Z-" },
  { label: "Oblíquo", value: "Obliquo" },
] as const;

interface RangeFilter { min: string; max: string; }
const emptyRange = (): RangeFilter => ({ min: "", max: "" });

function inRange(value: number | null, range: RangeFilter): boolean {
  const v = value ?? 0;
  const lo = parseFloat(range.min);
  const hi = parseFloat(range.max);
  if (!isNaN(lo) && v < lo) return false;
  if (!isNaN(hi) && v > hi) return false;
  return true;
}

function AxisGroup({
  axis, holes, excludedIds, onToggleHole, defaultOpen = false,
}: {
  axis: HoleAxis;
  holes: HoleData[];
  excludedIds: Set<string>;
  onToggleHole: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const color = AXIS_COLORS[axis];
  const selectedCount = holes.filter((h) => !excludedIds.has(h.id)).length;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-mono font-bold text-white cursor-pointer hover:brightness-110 transition-all"
        style={{ backgroundColor: `hsl(${color})` }}
      >
        <span className="w-1 h-full self-stretch bg-white/30 rounded" />
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span translate="no">{axis}</span>
        <span className="text-white/80 font-normal">— {selectedCount}/{holes.length} furo(s)</span>
        <span className="ml-auto text-white/60 text-xs">{holes.length}</span>
      </button>
      {open && (
        <Table>
          <TableBody>
            {holes.map((hole, idx) => {
              const excluded = excludedIds.has(hole.id);
              return (
                <TableRow
                  key={hole.id}
                  className={`border-border ${excluded ? "opacity-40" : ""} ${idx % 2 === 0 ? "bg-card" : "bg-card/60"} hover:bg-secondary/50`}
                >
                  <TableCell className="w-10 px-2">
                    <Checkbox checked={!excluded} onCheckedChange={() => onToggleHole(hole.id)} />
                  </TableCell>
                  <TableCell className="w-1 p-0">
                    <div className="w-1.5 h-full min-h-[2rem]" style={{ backgroundColor: `hsl(${color})` }} />
                  </TableCell>
                  <TableCell className="font-mono text-sm w-14">{hole.faceNumber}</TableCell>
                  <TableCell className="font-mono text-sm font-semibold" style={{ color: `hsl(${color})` }}>
                    {fmt(hole.diameter, 3)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{fmt(hole.depth)}</TableCell>
                  <TableCell className="text-sm">
                    <Badge variant={hole.type === "Passante" ? "default" : "secondary"} className="text-xs font-mono">
                      {hole.type}
                    </Badge>
                  </TableCell>
                  <TableCell className={`font-mono text-sm ${(hole.angle ?? 0) > 10 ? "text-warning" : ""}`}>
                    {fmt(hole.angle, 1)}°
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{fmt(hole.centerX, 3)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{fmt(hole.centerY, 3)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{fmt(hole.centerZ, 3)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{fmt(hole.normalX, 4)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{fmt(hole.normalY, 4)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{fmt(hole.normalZ, 4)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function HolesTable({ holes, excludedIds, onToggleHole, onSelectAll, onDeselectAll }: HolesTableProps) {
  const [diaFilter, setDiaFilter] = useState<RangeFilter>(emptyRange());
  const [depthFilter, setDepthFilter] = useState<RangeFilter>(emptyRange());
  const [angleFilter, setAngleFilter] = useState<RangeFilter>(emptyRange());
  const [axisFilter, setAxisFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const clearAll = () => {
    setDiaFilter(emptyRange());
    setDepthFilter(emptyRange());
    setAngleFilter(emptyRange());
    setAxisFilter(new Set());
    setTypeFilter("all");
    setActiveFilter(false);
  };

  const toggleAxis = (val: string) => {
    const next = new Set(axisFilter);
    if (next.has(val)) next.delete(val); else next.add(val);
    setAxisFilter(next);
  };

  const filtered = useMemo(() => {
    if (!activeFilter) return holes;
    return holes.filter((h) => {
      if (!inRange(h.diameter, diaFilter)) return false;
      if (!inRange(h.depth, depthFilter)) return false;
      if (!inRange(h.angle, angleFilter)) return false;
      if (axisFilter.size > 0 && !axisFilter.has(h.axis)) return false;
      if (typeFilter !== "all" && h.type !== typeFilter) return false;
      return true;
    });
  }, [holes, diaFilter, depthFilter, angleFilter, axisFilter, typeFilter, activeFilter]);

  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let va: number | string, vb: number | string;
      switch (sortField) {
        case "faceNumber": va = a.faceNumber; vb = b.faceNumber; break;
        case "diameter": va = a.diameter ?? 0; vb = b.diameter ?? 0; break;
        case "depth": va = a.depth ?? 0; vb = b.depth ?? 0; break;
        case "angle": va = a.angle ?? 0; vb = b.angle ?? 0; break;
        case "centerX": va = a.centerX; vb = b.centerX; break;
        case "centerY": va = a.centerY; vb = b.centerY; break;
        case "centerZ": va = a.centerZ; vb = b.centerZ; break;
        case "type": va = a.type; vb = b.type; break;
        default: return 0;
      }
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortField(null); setSortDir("asc"); }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const grouped = useMemo(() => {
    const groups: Record<string, HoleData[]> = {};
    for (const h of sorted) {
      if (!groups[h.axis]) groups[h.axis] = [];
      groups[h.axis].push(h);
    }
    return AXIS_ORDER
      .filter((a) => groups[a]?.length)
      .map((a) => ({ axis: a, holes: groups[a] }));
  }, [sorted]);

  const selectedCount = holes.filter((h) => !excludedIds.has(h.id)).length;

  if (holes.length === 0) return null;

  const RangeInput = ({ label, value, onChange }: { label: string; value: RangeFilter; onChange: (v: RangeFilter) => void }) => (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground font-mono w-8 shrink-0">{label}</span>
      <Input type="number" placeholder="min" value={value.min} onChange={(e) => onChange({ ...value, min: e.target.value })} className="h-7 w-20 text-xs font-mono" />
      <span className="text-muted-foreground text-xs">—</span>
      <Input type="number" placeholder="max" value={value.max} onChange={(e) => onChange({ ...value, max: e.target.value })} className="h-7 w-20 text-xs font-mono" />
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleDot className="w-5 h-5 text-primary" />
            Furos Detetados
            <span className="text-muted-foreground font-normal text-sm">
              {selectedCount}/{holes.length} selecionados
              {activeFilter && <span className="ml-1 text-primary">({filtered.length} filtrados)</span>}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onSelectAll}>
              <CheckSquare className="w-3 h-3" /> Todos
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onDeselectAll}>
              <Square className="w-3 h-3" /> Nenhum
            </Button>
            <span className="text-muted-foreground">|</span>
            <Button size="sm" variant={filtersOpen ? "secondary" : "outline"} className="h-7 text-xs gap-1" onClick={() => setFiltersOpen(!filtersOpen)}>
              <Filter className="w-3 h-3" /> Filtros
              {filtersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            {activeFilter && (
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={clearAll}>
                <X className="w-3 h-3" /> Limpar
              </Button>
            )}
          </div>
        </div>
        {filtersOpen && (
          <div className="mt-3 p-3 rounded-md bg-secondary/50 border border-border space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <RangeInput label="Ø" value={diaFilter} onChange={setDiaFilter} />
              <RangeInput label="Prof." value={depthFilter} onChange={setDepthFilter} />
              <RangeInput label="Âng." value={angleFilter} onChange={setAngleFilter} />
            </div>
            <div className="flex items-start gap-1.5 pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground font-mono w-8 shrink-0 pt-0.5">Eixo</span>
              <div className="flex flex-wrap gap-2">
                {AXIS_FILTER_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1 cursor-pointer">
                    <Checkbox
                      checked={axisFilter.has(opt.value)}
                      onCheckedChange={() => toggleAxis(opt.value)}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-xs font-mono" translate="no">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-mono w-8 shrink-0">Tipo</span>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-7 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Passante">Passante</SelectItem>
                    <SelectItem value="Cego">Cego</SelectItem>
                    <SelectItem value="Desconhecido">Desconhecido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => setActiveFilter(true)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="w-10 px-2" />
                <TableHead className="w-1.5 p-0" />
                <TableHead className="text-muted-foreground w-14 cursor-pointer select-none" onClick={() => handleSort("faceNumber")}>
                  <span className="flex items-center gap-1">Furo <SortIcon field="faceNumber" /></span>
                </TableHead>
                <TableHead className="text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("diameter")}>
                  <span className="flex items-center gap-1" translate="no">Ø (mm) <SortIcon field="diameter" /></span>
                </TableHead>
                <TableHead className="text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("depth")}>
                  <span className="flex items-center gap-1">Prof. (mm) <SortIcon field="depth" /></span>
                </TableHead>
                <TableHead className="text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("type")}>
                  <span className="flex items-center gap-1">Tipo <SortIcon field="type" /></span>
                </TableHead>
                <TableHead className="text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("angle")}>
                  <span className="flex items-center gap-1">Ângulo (°) <SortIcon field="angle" /></span>
                </TableHead>
                <TableHead className="text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("centerX")}>
                  <span className="flex items-center gap-1" translate="no">X <SortIcon field="centerX" /></span>
                </TableHead>
                <TableHead className="text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("centerY")}>
                  <span className="flex items-center gap-1" translate="no">Y <SortIcon field="centerY" /></span>
                </TableHead>
                <TableHead className="text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("centerZ")}>
                  <span className="flex items-center gap-1" translate="no">Z <SortIcon field="centerZ" /></span>
                </TableHead>
                <TableHead className="text-muted-foreground" translate="no">NX</TableHead>
                <TableHead className="text-muted-foreground" translate="no">NY</TableHead>
                <TableHead className="text-muted-foreground" translate="no">NZ</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
          {grouped.map(({ axis, holes: groupHoles }) => (
            <AxisGroup
              key={axis}
              axis={axis}
              holes={groupHoles}
              excludedIds={excludedIds}
              onToggleHole={onToggleHole}
            />
          ))}
          {grouped.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">
              Nenhum furo corresponde ao filtro.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
