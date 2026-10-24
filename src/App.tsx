import { useState, useCallback, useRef } from "react";
import type { MosaicSettings } from "@/lib/mosaic/types";
import { DEFAULT_SETTINGS } from "@/lib/mosaic/types";
import { MosaicCanvas, type MosaicCanvasHandle } from "@/components/MosaicCanvas";
import { SidebarPanel } from "@/components/Sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

function App() {
  const [settings, setSettings] = useState<MosaicSettings>(DEFAULT_SETTINGS);
  const [hasImage, setHasImage] = useState(false);
  const canvasRef = useRef<MosaicCanvasHandle>(null);

  const handleImageLoad = useCallback(() => {
    setHasImage(true);
  }, []);

  const handleExport = useCallback(() => {
    canvasRef.current?.exportPNG();
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <MosaicCanvas
          ref={canvasRef}
          settings={settings}
          onImageLoad={handleImageLoad}
        />
        <SidebarPanel
          settings={settings}
          onSettingsChange={setSettings}
          hasImage={hasImage}
          onExport={handleExport}
        />
      </div>
    </SidebarProvider>
  );
}

export default App;
