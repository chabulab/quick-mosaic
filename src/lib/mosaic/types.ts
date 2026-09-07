export type GridShape = "voronoi" | "hexagon" | "triangle" | "square";

export interface MosaicSettings {
  grid: {
    shape: GridShape;
    tileSize: number;
    jitter: number;
  };
  glass: {
    refraction: number;
    frost: number;
    opacity: number;
  };
  grout: {
    color: string;
    thickness: number;
    bevel: boolean;
  };
}

export interface MosaicCell {
  points: [number, number][];
  centroid: [number, number];
  color: [number, number, number, number];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

export const DEFAULT_SETTINGS: MosaicSettings = {
  grid: {
    shape: "voronoi",
    tileSize: 25,
    jitter: 50,
  },
  glass: {
    refraction: 15,
    frost: 4,
    opacity: 85,
  },
  grout: {
    color: "#1a1a1a",
    thickness: 2,
    bevel: true,
  },
};
