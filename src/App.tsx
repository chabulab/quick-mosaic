import { useState, useCallback } from "react";
import type { MosaicSettings } from "@/lib/mosaic/types";
import { DEFAULT_SETTINGS } from "@/lib/mosaic/types";
import { MosaicCanvas } from "@/components/MosaicCanvas";
import { SidebarPanel } from "@/components/Sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

function App() {
  const [settings, setSettings] = useState<MosaicSettings>(DEFAULT_SETTINGS);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);

  const handleImageLoad = useCallback((img: HTMLImageElement) => {
    setSourceImage(img);
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <MosaicCanvas
          settings={settings}
          sourceImage={sourceImage}
          onImageLoad={handleImageLoad}
        />
        <SidebarPanel
          settings={settings}
          onSettingsChange={setSettings}
          sourceImage={sourceImage}
        />
      </div>
    </SidebarProvider>
  );
}

export default App;
