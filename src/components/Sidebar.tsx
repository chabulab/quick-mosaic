import type { MosaicSettings, GridShape } from "@/lib/mosaic/types";
import { PRESETS } from "@/lib/mosaic/presets";
import { exportMosaic } from "@/lib/mosaic/renderer";
import { generateGrid, computeMosaicCells } from "@/lib/mosaic/grid";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";

interface SidebarPanelProps {
  settings: MosaicSettings;
  onSettingsChange: (settings: MosaicSettings) => void;
  sourceImage: HTMLImageElement | null;
}

export function SidebarPanel({
  settings,
  onSettingsChange,
  sourceImage,
}: SidebarPanelProps) {
  const update = (patch: Partial<MosaicSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };

  const firstVal = (v: number | readonly number[]) =>
    Array.isArray(v) ? v[0] : v;

  const handleExport = () => {
    if (!sourceImage) return;
    const cells = generateCellsForExport(sourceImage, settings);
    const canvas = exportMosaic(sourceImage, cells, settings);
    const link = document.createElement("a");
    link.download = "mosaic.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const applyPreset = (presetName: string | null) => {
    if (!presetName) return;
    const preset = PRESETS.find((p) => p.name === presetName);
    if (preset) onSettingsChange({ ...preset.settings });
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar
        side="right"
        variant="floating"
        collapsible="offcanvas"
        className="fixed right-0 top-0 z-50 h-full w-72"
      >
        <SidebarHeader className="flex flex-row items-center justify-between border-b border-sidebar-border px-4 py-3">
          <span className="text-sm font-semibold">Mosaic Controls</span>
          <SidebarTrigger className="h-7 w-7" />
        </SidebarHeader>

        <SidebarContent className="px-4 py-2">
          {/* Presets */}
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/60 px-0">
              Quick Presets
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <Select onValueChange={applyPreset}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a preset..." />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((preset) => (
                    <SelectItem key={preset.name} value={preset.name}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator className="my-3" />

          {/* Grid Base */}
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/60 px-0">
              Grid Base
            </SidebarGroupLabel>
            <SidebarGroupContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-sidebar-foreground/70">Shape</label>
                <Select
                  value={settings.grid.shape}
                  onValueChange={(v) =>
                    update({ grid: { ...settings.grid, shape: (v ?? "voronoi") as GridShape } })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="voronoi">Voronoi (Stained Glass)</SelectItem>
                    <SelectItem value="hexagon">Hexagon</SelectItem>
                    <SelectItem value="triangle">Triangle</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-sidebar-foreground/70">Tile Size</label>
                  <span className="text-xs text-sidebar-foreground/50 tabular-nums">
                    {settings.grid.tileSize}px
                  </span>
                </div>
                <Slider
                  value={[settings.grid.tileSize]}
                  onValueChange={(v) =>
                    update({ grid: { ...settings.grid, tileSize: firstVal(v) } })
                  }
                  min={10}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-sidebar-foreground/70">
                    Jitter / Randomness
                  </label>
                  <span className="text-xs text-sidebar-foreground/50 tabular-nums">
                    {settings.grid.jitter}%
                  </span>
                </div>
                <Slider
                  value={[settings.grid.jitter]}
                  onValueChange={(v) =>
                    update({ grid: { ...settings.grid, jitter: firstVal(v) } })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator className="my-3" />

          {/* Glass Effects */}
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/60 px-0">
              Glass Effects
            </SidebarGroupLabel>
            <SidebarGroupContent className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-sidebar-foreground/70">
                    Refraction (Offset)
                  </label>
                  <span className="text-xs text-sidebar-foreground/50 tabular-nums">
                    {settings.glass.refraction}px
                  </span>
                </div>
                <Slider
                  value={[settings.glass.refraction]}
                  onValueChange={(v) =>
                    update({ glass: { ...settings.glass, refraction: firstVal(v) } })
                  }
                  min={0}
                  max={50}
                  step={1}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-sidebar-foreground/70">
                    Frost / Blur
                  </label>
                  <span className="text-xs text-sidebar-foreground/50 tabular-nums">
                    {settings.glass.frost}px
                  </span>
                </div>
                <Slider
                  value={[settings.glass.frost]}
                  onValueChange={(v) =>
                    update({ glass: { ...settings.glass, frost: firstVal(v) } })
                  }
                  min={0}
                  max={20}
                  step={1}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-sidebar-foreground/70">
                    Glass Opacity
                  </label>
                  <span className="text-xs text-sidebar-foreground/50 tabular-nums">
                    {settings.glass.opacity}%
                  </span>
                </div>
                <Slider
                  value={[settings.glass.opacity]}
                  onValueChange={(v) =>
                    update({ glass: { ...settings.glass, opacity: firstVal(v) } })
                  }
                  min={10}
                  max={100}
                  step={1}
                />
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator className="my-3" />

          {/* Grout & Bevel */}
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/60 px-0">
              Grout & Bevel
            </SidebarGroupLabel>
            <SidebarGroupContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-sidebar-foreground/70">Grout Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.grout.color}
                    onChange={(e) =>
                      update({
                        grout: { ...settings.grout, color: e.target.value },
                      })
                    }
                    className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="text-xs text-sidebar-foreground/50 font-mono">
                    {settings.grout.color}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-sidebar-foreground/70">
                    Line Thickness
                  </label>
                  <span className="text-xs text-sidebar-foreground/50 tabular-nums">
                    {settings.grout.thickness}px
                  </span>
                </div>
                <Slider
                  value={[settings.grout.thickness]}
                  onValueChange={(v) =>
                    update({ grout: { ...settings.grout, thickness: firstVal(v) } })
                  }
                  min={0}
                  max={8}
                  step={0.5}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-sidebar-foreground/70">
                  Bevel Highlight
                </label>
                <Toggle
                  pressed={settings.grout.bevel}
                  onPressedChange={(pressed) =>
                    update({ grout: { ...settings.grout, bevel: pressed } })
                  }
                  size="sm"
                >
                  {settings.grout.bevel ? "On" : "Off"}
                </Toggle>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator className="my-3" />

          {/* Export */}
          <div className="pb-4">
            <Button
              onClick={handleExport}
              disabled={!sourceImage}
              className="w-full"
            >
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download PNG
            </Button>
          </div>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}

function generateCellsForExport(
  image: HTMLImageElement,
  settings: MosaicSettings
) {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const offscreen = document.createElement("canvas");
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const gridCells = generateGrid(w, h, settings);
  return computeMosaicCells(gridCells, imageData, w, h, settings);
}
