import { useCallback, useRef, useEffect, useState } from "react";
import type { MosaicSettings, MosaicCell } from "@/lib/mosaic/types";
import { generateGrid, computeMosaicCells } from "@/lib/mosaic/grid";
import { renderPreview } from "@/lib/mosaic/renderer";

interface MosaicCanvasProps {
  settings: MosaicSettings;
  sourceImage: HTMLImageElement | null;
  onImageLoad: (img: HTMLImageElement) => void;
}

export function MosaicCanvas({
  settings,
  sourceImage,
  onImageLoad,
}: MosaicCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const cellsRef = useRef<MosaicCell[]>([]);
  const rafRef = useRef<number>(0);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => onImageLoad(img);
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [onImageLoad]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }, [handleFile]);

  useEffect(() => {
    if (!sourceImage || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = sourceImage.naturalWidth;
    const h = sourceImage.naturalHeight;

    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext("2d")!;
    offCtx.drawImage(sourceImage, 0, 0);
    const imageData = offCtx.getImageData(0, 0, w, h);

    const gridCells = generateGrid(w, h, settings);
    cellsRef.current = computeMosaicCells(gridCells, imageData, w, h, settings);

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        renderPreview(
          ctx,
          sourceImage,
          cellsRef.current,
          settings,
          canvas.width,
          canvas.height,
          w,
          h
        );
      });
    });

    resizeObserver.observe(container);

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    renderPreview(ctx, sourceImage, cellsRef.current, settings, canvas.width, canvas.height, w, h);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [sourceImage, settings]);

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 overflow-hidden bg-neutral-950 transition-colors ${
        isDragging ? "ring-2 ring-blue-500 ring-inset" : ""
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {!sourceImage && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 cursor-pointer select-none"
          onClick={handleClick}
        >
          <div className="rounded-2xl border-2 border-dashed border-neutral-600 p-16 text-center transition-colors hover:border-neutral-400">
            <svg
              className="mx-auto mb-4 h-12 w-12 text-neutral-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-lg font-medium text-neutral-300">
              Drop an image here
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              or click to browse
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
