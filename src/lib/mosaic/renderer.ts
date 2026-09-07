import type { MosaicCell, MosaicSettings } from "./types";

export function renderMosaic(
  ctx: CanvasRenderingContext2D,
  cells: MosaicCell[],
  settings: MosaicSettings,
  width: number,
  height: number
) {
  const { frost, opacity } = settings.glass;
  const { color: groutHex, thickness, bevel } = settings.grout;

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = groutHex;
  ctx.fillRect(0, 0, width, height);

  for (const cell of cells) {
    const [r, g, b] = cell.color;

    ctx.beginPath();
    ctx.moveTo(cell.points[0][0], cell.points[0][1]);
    for (let i = 1; i < cell.points.length; i++) {
      ctx.lineTo(cell.points[i][0], cell.points[i][1]);
    }
    ctx.closePath();

    if (frost > 0) {
      const grad = ctx.createRadialGradient(
        cell.centroid[0],
        cell.centroid[1],
        0,
        cell.centroid[0],
        cell.centroid[1],
        frost * 5
      );
      grad.addColorStop(0, `rgba(${r},${g},${b},${(opacity / 100) * 0.6})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},${(opacity / 100) * 1.0})`);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = `rgba(${r},${g},${b},${(opacity / 100) * 1.0})`;
    }
    ctx.fill();

    if (bevel) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = `rgba(255,255,255,0.25)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cell.points[0][0], cell.points[0][1]);
      for (let i = 1; i < cell.points.length; i++) {
        ctx.lineTo(cell.points[i][0], cell.points[i][1]);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

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

export function renderPreview(
  ctx: CanvasRenderingContext2D,
  _sourceImage: HTMLImageElement,
  cells: MosaicCell[],
  settings: MosaicSettings,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number
) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const scaleX = canvasWidth / imageWidth;
  const scaleY = canvasHeight / imageHeight;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (canvasWidth - imageWidth * scale) / 2;
  const offsetY = (canvasHeight - imageHeight * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  renderMosaic(ctx, cells, settings, imageWidth, imageHeight);

  ctx.restore();
}

export function exportMosaic(
  sourceImage: HTMLImageElement,
  cells: MosaicCell[],
  settings: MosaicSettings
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.naturalWidth;
  canvas.height = sourceImage.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  renderMosaic(ctx, cells, settings, canvas.width, canvas.height);
  return canvas;
}
