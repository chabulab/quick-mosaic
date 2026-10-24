import {
  useCallback,
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import type { MosaicSettings } from "@/lib/mosaic/types";
import { GlassRenderer } from "@/lib/mosaic/webgl/GlassRenderer";

export interface MosaicCanvasHandle {
  exportPNG: () => void;
}

interface MosaicCanvasProps {
  settings: MosaicSettings;
  onImageLoad: (img: HTMLImageElement) => void;
}

export const MosaicCanvas = forwardRef<MosaicCanvasHandle, MosaicCanvasProps>(
  function MosaicCanvas({ settings, onImageLoad }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [webglOk, setWebglOk] = useState<boolean | null>(null);
    const [hasImage, setHasImage] = useState(false);
    const rendererRef = useRef<GlassRenderer | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    // Initialize WebGL renderer once
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const renderer = new GlassRenderer(canvas);
        rendererRef.current = renderer;
        setWebglOk(true);
      } catch {
        setWebglOk(false);
      }

      return () => {
        rendererRef.current?.destroy();
        rendererRef.current = null;
      };
    }, []);

    // Alert user if WebGL is unavailable
    useEffect(() => {
      if (webglOk === false) {
        alert(
          "WebGL2 is not supported by your browser, so the mosaic effect cannot be rendered."
        );
      }
    }, [webglOk]);

    // Handle new source image
    const handleSourceImage = useCallback((img: HTMLImageElement) => {
      imageRef.current = img;
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.setSource(img);
        renderer.imageSize = { width: img.naturalWidth, height: img.naturalHeight };
      }
      setHasImage(true);
      onImageLoad(img);
    }, [onImageLoad]);

    const handleFile = useCallback(
      (file: File) => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => handleSourceImage(img);
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      },
      [handleSourceImage]
    );

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      },
      [handleFile]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
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

    // Re-render when settings change, image loads, or on resize
    useEffect(() => {
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!renderer || !canvas || !container || webglOk !== true) return;

      const draw = () => {
        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        canvas.width = rect.width;
        canvas.height = rect.height;
        renderer.render(settings, canvas.width, canvas.height);
      };

      draw();
      const observer = new ResizeObserver(draw);
      observer.observe(container);
      return () => observer.disconnect();
    }, [settings, webglOk, hasImage]);

    // Export
    useImperativeHandle(ref, () => ({
      exportPNG: () => {
        const renderer = rendererRef.current;
        const image = imageRef.current;
        if (!renderer || !image) return;
        const out = renderer.exportToCanvas(image, settings);
        const link = document.createElement("a");
        link.download = "mosaic.png";
        link.href = out.toDataURL("image/png");
        link.click();
      },
    }));

    return (
      <div
        ref={containerRef}
        className={`relative min-h-0 flex-1 overflow-hidden bg-neutral-950 transition-colors ${
          isDragging ? "ring-2 ring-blue-500 ring-inset" : ""
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {!hasImage && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 cursor-pointer select-none"
            onClick={handleClick}
          >
            <div className="rounded-2xl border-2 border-dashed border-neutral-500 bg-neutral-900/80 p-12 text-center transition-colors hover:border-neutral-300 hover:bg-neutral-800/80">
              <svg
                className="mx-auto mb-4 h-16 w-16 text-neutral-400"
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
              <p className="text-xl font-medium text-neutral-200">
                Drop an image here
              </p>
              <p className="mt-2 text-sm text-neutral-400">
                or click to browse
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);
