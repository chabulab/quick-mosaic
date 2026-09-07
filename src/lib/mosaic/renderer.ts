import type { MosaicCell, MosaicSettings } from "./types";

// Light direction for specular calculations (normalized)
const LIGHT_X = 0.3;
const LIGHT_Y = -0.5;
const LIGHT_Z = 0.8;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function distToEdge(
  x: number,
  y: number,
  polygon: [number, number][]
): number {
  let minDist = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[j];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : clamp(((x - x1) * dx + (y - y1) * dy) / lenSq, 0, 1);
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const d = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function sampleBlurred(
  imageData: ImageData,
  cx: number,
  cy: number,
  radius: number,
  w: number,
  h: number
): [number, number, number] {
  if (radius <= 0) {
    const c = samplePixel(imageData, cx, cy, w, h);
    return [c[0], c[1], c[2]];
  }

  let r = 0,
    g = 0,
    b = 0,
    count = 0;
  const step = Math.max(1, Math.floor(radius / 3));

  for (let dy = -radius; dy <= radius; dy += step) {
    for (let dx = -radius; dx <= radius; dx += step) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const weight = 1 - dist / radius;
      const c = samplePixel(imageData, cx + dx, cy + dy, w, h);
      r += c[0] * weight;
      g += c[1] * weight;
      b += c[2] * weight;
      count += weight;
    }
  }

  if (count === 0) {
    const c = samplePixel(imageData, cx, cy, w, h);
    return [c[0], c[1], c[2]];
  }

  return [r / count, g / count, b / count];
}

function samplePixel(
  imageData: ImageData,
  x: number,
  y: number,
  w: number,
  h: number
): [number, number, number, number] {
  const px = clamp(Math.round(x), 0, w - 1);
  const py = clamp(Math.round(y), 0, h - 1);
  const idx = (py * w + px) * 4;
  return [
    imageData.data[idx],
    imageData.data[idx + 1],
    imageData.data[idx + 2],
    imageData.data[idx + 3],
  ];
}

export function renderMosaic(
  ctx: CanvasRenderingContext2D,
  cells: MosaicCell[],
  settings: MosaicSettings,
  width: number,
  height: number,
  sourceImageData?: ImageData
) {
  const { opacity } = settings.glass;
  const { color: groutHex, thickness, bevel } = settings.grout;

  // Use imageData for pixel-level rendering when available
  if (sourceImageData) {
    renderMosaicPixelPerfect(
      ctx,
      cells,
      settings,
      width,
      height,
      sourceImageData
    );
    return;
  }

  // Fallback: canvas-based rendering
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = groutHex;
  ctx.fillRect(0, 0, width, height);

  for (const cell of cells) {
    const [cr, cg, cb] = cell.color;
    const alpha = (opacity / 100);

    ctx.beginPath();
    ctx.moveTo(cell.points[0][0], cell.points[0][1]);
    for (let i = 1; i < cell.points.length; i++) {
      ctx.lineTo(cell.points[i][0], cell.points[i][1]);
    }
    ctx.closePath();

    // Base glass color with refraction tint
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.fill();

    // Specular highlight
    if (bevel) {
      ctx.save();
      ctx.clip();

      const grad = ctx.createRadialGradient(
        cell.centroid[0] - 5,
        cell.centroid[1] - 5,
        0,
        cell.centroid[0],
        cell.centroid[1],
        Math.max(cell.bbox.maxX - cell.bbox.minX, cell.bbox.maxY - cell.bbox.minY) / 2
      );
      grad.addColorStop(0, `rgba(255,255,255,0.18)`);
      grad.addColorStop(0.5, `rgba(255,255,255,0.05)`);
      grad.addColorStop(1, `rgba(0,0,0,0.05)`);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.restore();
    }
  }

  // Grout lines
  if (thickness > 0) {
    ctx.strokeStyle = groutHex;
    ctx.lineWidth = thickness;
    ctx.lineJoin = "round";
    for (const cell of cells) {
      ctx.beginPath();
      ctx.moveTo(cell.points[0][0], cell.points[0][1]);
      for (let i = 1; i < cell.points.length; i++) {
        ctx.lineTo(cell.points[i][0], cell.points[i][1]);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function renderMosaicPixelPerfect(
  ctx: CanvasRenderingContext2D,
  cells: MosaicCell[],
  settings: MosaicSettings,
  width: number,
  height: number,
  sourceImageData: ImageData
) {
  const { refraction, frost, opacity } = settings.glass;
  const { color: groutHex, thickness } = settings.grout;
  const [gr, gg, gb] = parseHex(groutHex);
  const alpha = opacity / 100;
  const outData = ctx.createImageData(width, height);
  const out = outData.data;

  // Fill background with grout color
  for (let i = 0; i < out.length; i += 4) {
    out[i] = gr;
    out[i + 1] = gg;
    out[i + 2] = gb;
    out[i + 3] = 255;
  }

  // For each cell, render pixel by pixel
  for (const cell of cells) {
    const { minX, minY, maxX, maxY } = cell.bbox;
    const x0 = Math.max(0, Math.floor(minX));
    const y0 = Math.max(0, Math.floor(minY));
    const x1 = Math.min(width - 1, Math.ceil(maxX));
    const y1 = Math.min(height - 1, Math.ceil(maxY));

    // Compute centroid and cell radius for effects
    const [, ccy] = cell.centroid;
    const cellRadius =
      Math.max(maxX - minX, maxY - minY) / 2;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!pointInPolygon(x, y, cell.points)) continue;

        const outIdx = (y * width + x) * 4;

        // Edge distance for edge darkening and bevel
        const edgeDist = distToEdge(x, y, cell.points);
        const edgeFactor = clamp(edgeDist / (cellRadius * 0.3), 0, 1);

        // === REFRACTION: sample source image at shifted position ===
        const dirX = x - width / 2;
        const dirY = y - height / 2;
        const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        const refX = x + (dirX / dirLen) * refraction * edgeFactor;
        const refY = y + (dirY / dirLen) * refraction * edgeFactor;

        // === FROST/BLUR: sample averaged pixels ===
        let sr: number, sg: number, sb: number;
        if (frost > 0) {
          const blurRadius = frost * edgeFactor;
          const blurred = sampleBlurred(
            sourceImageData,
            refX,
            refY,
            blurRadius,
            width,
            height
          );
          [sr, sg, sb] = blurred;
        } else {
          const c = samplePixel(sourceImageData, refX, refY, width, height);
          [sr, sg, sb] = c;
        }

        // === CHROMATIC ABERRATION: offset RGB channels slightly ===
        if (refraction > 5) {
          const aberration = refraction * 0.015;
          const cR = samplePixel(
            sourceImageData,
            refX - aberration,
            refY - aberration,
            width,
            height
          );
          const cB = samplePixel(
            sourceImageData,
            refX + aberration,
            refY + aberration,
            width,
            height
          );
          sr = (sr * 0.6 + cR[0] * 0.2 + cB[0] * 0.2);
          sg = (sg * 0.6 + cR[1] * 0.2 + cB[1] * 0.2);
          sb = (sb * 0.6 + cR[2] * 0.2 + cB[2] * 0.2);
        }

        // === SPECULAR HIGHLIGHT ===
        // Simulate a convex glass surface - normal points outward from centroid
        const nx = (x - ccy) / cellRadius;
        const ny = (y - ccy) / cellRadius;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));

        // Half-vector between light and view (view is straight on: 0,0,1)
        const hx = LIGHT_X;
        const hy = LIGHT_Y;
        const hz = LIGHT_Z + 1;
        const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
        const specDot = clamp(
          (nx * hx + ny * hy + nz * hz) / hLen,
          0,
          1
        );
        const specular = Math.pow(specDot, 32) * 0.6;

        // Fresnel: more reflection at grazing angles
        const viewDot = nz;
        const fresnel = Math.pow(1 - viewDot, 3) * 0.25;

        // === EDGE DARKENING ===
        const edgeDarken = 1 - (1 - edgeFactor) * 0.2;

        // === COMPOSE ===
        const glassAlpha = clamp(alpha + fresnel, 0, 1);
        let r = sr * glassAlpha * edgeDarken + gr * (1 - glassAlpha);
        let g = sg * glassAlpha * edgeDarken + gg * (1 - glassAlpha);
        let b = sb * glassAlpha * edgeDarken + gb * (1 - glassAlpha);

        // Add specular highlight
        r = clamp(r + specular * 255, 0, 255);
        g = clamp(g + specular * 255, 0, 255);
        b = clamp(b + specular * 255, 0, 255);

        // Add subtle depth tint (thicker glass = slightly blue/green tint)
        const depthTint = (1 - edgeFactor) * 0.06;
        g = clamp(g + depthTint * 20, 0, 255);
        b = clamp(b + depthTint * 30, 0, 255);

        out[outIdx] = r;
        out[outIdx + 1] = g;
        out[outIdx + 2] = b;
        out[outIdx + 3] = 255;
      }
    }
  }

  // === GROUT LINES via edge detection ===
  if (thickness > 0) {
    for (const cell of cells) {
      for (let i = 0; i < cell.points.length; i++) {
        const j = (i + 1) % cell.points.length;
        drawThickLine(
          out,
          width,
          height,
          cell.points[i][0],
          cell.points[i][1],
          cell.points[j][0],
          cell.points[j][1],
          thickness,
          gr,
          gg,
          gb
        );
      }
    }
  }

  ctx.putImageData(outData, 0, 0);
}

function drawThickLine(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
  r: number,
  g: number,
  b: number
) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  const steps = Math.ceil(len);
  const halfT = thickness / 2;

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = x0 + dx * t;
    const cy = y0 + dy * t;

    // Perpendicular direction
    const px = -dy / len;
    const py = dx / len;

    for (let d = -halfT; d <= halfT; d++) {
      const lx = Math.round(cx + px * d);
      const ly = Math.round(cy + py * d);
      if (lx < 0 || lx >= w || ly < 0 || ly >= h) continue;
      const idx = (ly * w + lx) * 4;
      out[idx] = r;
      out[idx + 1] = g;
      out[idx + 2] = b;
      out[idx + 3] = 255;
    }
  }
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

export function renderPreview(
  ctx: CanvasRenderingContext2D,
  _sourceImage: HTMLImageElement,
  cells: MosaicCell[],
  settings: MosaicSettings,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
  sourceImageData?: ImageData
) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const scaleX = canvasWidth / imageWidth;
  const scaleY = canvasHeight / imageHeight;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (canvasWidth - imageWidth * scale) / 2;
  const offsetY = (canvasHeight - imageHeight * scale) / 2;

  // Render at source resolution then scale
  const offscreen = document.createElement("canvas");
  offscreen.width = imageWidth;
  offscreen.height = imageHeight;
  const offCtx = offscreen.getContext("2d")!;

  renderMosaic(offCtx, cells, settings, imageWidth, imageHeight, sourceImageData);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(offscreen, offsetX, offsetY, imageWidth * scale, imageHeight * scale);
}

export function exportMosaic(
  sourceImage: HTMLImageElement,
  cells: MosaicCell[],
  settings: MosaicSettings,
  sourceImageData?: ImageData
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.naturalWidth;
  canvas.height = sourceImage.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  renderMosaic(
    ctx,
    cells,
    settings,
    canvas.width,
    canvas.height,
    sourceImageData
  );
  return canvas;
}
