import type { MosaicCell, MosaicSettings } from "./types";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateHexPoints(
  cx: number,
  cy: number,
  radius: number
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    points.push([
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
    ]);
  }
  return points;
}

function generateTrianglePoints(
  cx: number,
  cy: number,
  size: number,
  row: number,
  col: number
): [number, number][] {
  const h = (size * Math.sqrt(3)) / 2;
  const up = (row + col) % 2 === 0;
  if (up) {
    return [
      [cx, cy - (h * 2) / 3],
      [cx - size / 2, cy + h / 3],
      [cx + size / 2, cy + h / 3],
    ];
  }
  return [
    [cx, cy + (h * 2) / 3],
    [cx - size / 2, cy - h / 3],
    [cx + size / 2, cy - h / 3],
  ];
}

function generateSquarePoints(
  cx: number,
  cy: number,
  size: number
): [number, number][] {
  const half = size / 2;
  return [
    [cx - half, cy - half],
    [cx + half, cy - half],
    [cx + half, cy + half],
    [cx - half, cy + half],
  ];
}

function pointInPolygon(
  x: number,
  y: number,
  polygon: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function generateGrid(
  width: number,
  height: number,
  settings: MosaicSettings
): [number, number][][] {
  const { shape, tileSize, jitter } = settings.grid;
  const jitterFactor = jitter / 100;
  const rand = seededRandom(42);

  switch (shape) {
    case "voronoi":
      return generateVoronoiGrid(width, height, tileSize, jitterFactor, rand);
    case "hexagon":
      return generateHexGrid(width, height, tileSize, jitterFactor, rand);
    case "triangle":
      return generateTriGrid(width, height, tileSize, jitterFactor, rand);
    case "square":
      return generateSquareGrid(width, height, tileSize, jitterFactor, rand);
  }
}

function generateVoronoiGrid(
  w: number,
  h: number,
  size: number,
  jitter: number,
  rand: () => number
): [number, number][][] {
  const cols = Math.ceil(w / size) + 2;
  const rows = Math.ceil(h / size) + 2;
  const points: [number, number][] = [];

  for (let r = -1; r <= rows; r++) {
    for (let c = -1; c <= cols; c++) {
      const cx = c * size + size / 2;
      const cy = r * size + size / 2;
      const jx = (rand() - 0.5) * size * jitter;
      const jy = (rand() - 0.5) * size * jitter;
      points.push([cx + jx, cy + jy]);
    }
  }

  // Spatial hash for fast neighbor lookup
  const cellSize = size * 3;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < points.length; i++) {
    const gx = Math.floor(points[i][0] / cellSize);
    const gy = Math.floor(points[i][1] / cellSize);
    const key = `${gx},${gy}`;
    const arr = grid.get(key);
    if (arr) arr.push(i);
    else grid.set(key, [i]);
  }

  const cells: [number, number][][] = [];
  for (let i = 0; i < points.length; i++) {
    const center = points[i];
    const neighbors = getNeighborIndices(center, points, cellSize, grid, 5);
    const cell = voronoiCell(center, points, neighbors, w, h);
    if (cell.length >= 3) cells.push(cell);
  }
  return cells;
}

function getNeighborIndices(
  center: [number, number],
  _points: [number, number][],
  cellSize: number,
  grid: Map<string, number[]>,
  radius: number
): number[] {
  const gx = Math.floor(center[0] / cellSize);
  const gy = Math.floor(center[1] / cellSize);
  const result: number[] = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const key = `${gx + dx},${gy + dy}`;
      const cell = grid.get(key);
      if (cell) result.push(...cell);
    }
  }
  return result;
}

function voronoiCell(
  center: [number, number],
  allPoints: [number, number][],
  neighborIndices: number[],
  w: number,
  h: number
): [number, number][] {
  let polygon: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];

  for (const idx of neighborIndices) {
    const other = allPoints[idx];
    if (other[0] === center[0] && other[1] === center[1]) continue;
    const mx = (center[0] + other[0]) / 2;
    const my = (center[1] + other[1]) / 2;
    const dx = other[0] - center[0];
    const dy = other[1] - center[1];
    const nx = -dy;
    const ny = dx;

    polygon = clipPolygon(polygon, mx, my, nx, ny);
    if (polygon.length < 3) return polygon;
  }

  return polygon;
}

function clipPolygon(
  polygon: [number, number][],
  px: number,
  py: number,
  nx: number,
  ny: number
): [number, number][] {
  if (polygon.length === 0) return [];
  const result: [number, number][] = [];
  const dist = (x: number, y: number) => nx * (x - px) + ny * (y - py);

  for (let i = 0; i < polygon.length; i++) {
    const curr = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const dCurr = dist(curr[0], curr[1]);
    const dNext = dist(next[0], next[1]);

    if (dCurr >= 0) {
      result.push(curr);
      if (dNext < 0) {
        const t = dCurr / (dCurr - dNext);
        result.push([
          curr[0] + t * (next[0] - curr[0]),
          curr[1] + t * (next[1] - curr[1]),
        ]);
      }
    } else if (dNext >= 0) {
      const t = dCurr / (dCurr - dNext);
      result.push([
        curr[0] + t * (next[0] - curr[0]),
        curr[1] + t * (next[1] - curr[1]),
      ]);
    }
  }
  return result;
}

function generateHexGrid(
  w: number,
  h: number,
  size: number,
  jitter: number,
  rand: () => number
): [number, number][][] {
  const r = size / 2;
  const hexH = r * Math.sqrt(3);
  const cols = Math.ceil(w / (r * 3)) + 2;
  const rows = Math.ceil(h / hexH) + 2;
  const cells: [number, number][][] = [];

  for (let row = -1; row <= rows; row++) {
    for (let col = -1; col <= cols; col++) {
      const cx = col * r * 3;
      const cy = row * hexH + (col % 2 === 0 ? 0 : hexH / 2);
      const jx = (rand() - 0.5) * size * jitter * 0.3;
      const jy = (rand() - 0.5) * size * jitter * 0.3;
      cells.push(generateHexPoints(cx + jx, cy + jy, r));
    }
  }
  return cells;
}

function generateTriGrid(
  w: number,
  h: number,
  size: number,
  jitter: number,
  rand: () => number
): [number, number][][] {
  const h2 = (size * Math.sqrt(3)) / 2;
  const cols = Math.ceil(w / size) + 2;
  const rows = Math.ceil(h / h2) + 2;
  const cells: [number, number][][] = [];

  for (let row = -1; row <= rows; row++) {
    for (let col = -1; col <= cols; col++) {
      const cx = col * size + (row % 2 === 0 ? 0 : size / 2);
      const cy = row * h2;
      const jx = (rand() - 0.5) * size * jitter * 0.2;
      const jy = (rand() - 0.5) * size * jitter * 0.2;
      cells.push(generateTrianglePoints(cx + jx, cy + jy, size, row, col));
    }
  }
  return cells;
}

function generateSquareGrid(
  w: number,
  h: number,
  size: number,
  jitter: number,
  rand: () => number
): [number, number][][] {
  const cols = Math.ceil(w / size) + 2;
  const rows = Math.ceil(h / size) + 2;
  const cells: [number, number][][] = [];

  for (let row = -1; row <= rows; row++) {
    for (let col = -1; col <= cols; col++) {
      const cx = col * size + size / 2;
      const cy = row * size + size / 2;
      const jx = (rand() - 0.5) * size * jitter * 0.3;
      const jy = (rand() - 0.5) * size * jitter * 0.3;
      cells.push(generateSquarePoints(cx + jx, cy + jy, size));
    }
  }
  return cells;
}

export function computeMosaicCells(
  cells: [number, number][][],
  imageData: ImageData,
  w: number,
  h: number,
  settings: MosaicSettings
): MosaicCell[] {
  const { refraction } = settings.glass;
  const result: MosaicCell[] = [];

  for (const points of cells) {
    let cx = 0,
      cy = 0;
    for (const [px, py] of points) {
      cx += px;
      cy += py;
    }
    cx /= points.length;
    cy /= points.length;

    // Refraction offset: shift sample point away from center of image
    const dirX = cx - w / 2;
    const dirY = cy - h / 2;
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const offsetX = (dirX / len) * refraction;
    const offsetY = (dirY / len) * refraction;

    // Compute surface normal for specular highlight
    // Use the gradient of distance to nearest edge
    const bbox = getBoundingBox(points);
    const sampleX = Math.max(0, Math.min(w - 1, Math.round(cx + offsetX)));
    const sampleY = Math.max(0, Math.min(h - 1, Math.round(cy + offsetY)));

    const color = sampleColor(imageData, sampleX, sampleY, w, h);

    result.push({
      points,
      centroid: [cx, cy],
      color,
      bbox,
    });
  }

  return result;
}

function getBoundingBox(
  points: [number, number][]
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function sampleColor(
  imageData: ImageData,
  x: number,
  y: number,
  w: number,
  h: number
): [number, number, number, number] {
  const px = Math.max(0, Math.min(w - 1, Math.round(x)));
  const py = Math.max(0, Math.min(h - 1, Math.round(y)));
  const idx = (py * w + px) * 4;
  return [
    imageData.data[idx],
    imageData.data[idx + 1],
    imageData.data[idx + 2],
    imageData.data[idx + 3],
  ];
}

export { pointInPolygon };
