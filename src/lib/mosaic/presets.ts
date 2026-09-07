import type { MosaicSettings } from "./types";

export interface Preset {
  name: string;
  settings: MosaicSettings;
}

export const PRESETS: Preset[] = [
  {
    name: "Classic Stained Glass",
    settings: {
      grid: { shape: "voronoi", tileSize: 30, jitter: 60 },
      glass: { refraction: 18, frost: 3, opacity: 80 },
      grout: { color: "#1a1a1a", thickness: 2.5, bevel: true },
    },
  },
  {
    name: "Frosted Bathroom Tile",
    settings: {
      grid: { shape: "square", tileSize: 20, jitter: 5 },
      glass: { refraction: 5, frost: 12, opacity: 70 },
      grout: { color: "#e0e0e0", thickness: 1.5, bevel: false },
    },
  },
  {
    name: "Crystal Prism",
    settings: {
      grid: { shape: "triangle", tileSize: 35, jitter: 20 },
      glass: { refraction: 25, frost: 2, opacity: 90 },
      grout: { color: "#0a0a0a", thickness: 1, bevel: true },
    },
  },
  {
    name: "Honeycomb",
    settings: {
      grid: { shape: "hexagon", tileSize: 28, jitter: 10 },
      glass: { refraction: 12, frost: 5, opacity: 85 },
      grout: { color: "#2d2d2d", thickness: 2, bevel: true },
    },
  },
];
