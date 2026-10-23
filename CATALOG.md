---
project: quick-mosaic
path: quick-mosaic
title: Quick Mosaic
purpose: A browser tool that turns a photo into a stained-glass mosaic with Voronoi, hex, triangle or square tiles, then exports a PNG.
status: superseded-by:chabulab-tools/apps/mosaic
kind: web-app
stack: [react19, typescript, vite, tailwind4, shadcn, base-ui, canvas2d, oxlint]
repo: https://github.com/nhatchaubq/quick-mosaic
updated: 2026-10-23 (7de86f7)
---

# Quick Mosaic: catalog

## Purpose and users

A single-page experiment for making a stained-glass effect from one photo. The
visitor drops or picks an image, chooses a tile shape, and tunes tile size,
jitter, refraction, frost, glass opacity and grout. The preview fills the window
and the result downloads as a PNG at the source image's own resolution. It was
the prototype that became `chabulab-tools/apps/mosaic`; this repo still holds the
canvas renderer, but it is no longer the project to extend.

The committed branch is `master` at `7de86f7` ("real glass rendering engine").
The main working tree has an uncommitted rewrite, including scratch WebGL
scripts, that is not described here.

## Features

| Feature | What it does for the user | Where (paths) |
|---|---|---|
| Image intake | Drops an image on the canvas or opens a file picker, accepts any `image/*` | `src/components/MosaicCanvas.tsx` |
| Four tile shapes | Voronoi stained glass, hexagon, triangle and square grids | `src/lib/mosaic/grid.ts`, `src/components/Sidebar.tsx` |
| Tile size | Slider from 10 to 100 px | `Sidebar.tsx` |
| Jitter | Seeded randomness from 0 to 100 percent, stronger for Voronoi and weaker for hex and triangle | `grid.ts` |
| Glass refraction | Shifts each cell's sample point away from the image centre | `grid.ts`, `renderer.ts` |
| Frost | Weighted circular blur inside each tile | `renderer.ts` (`sampleBlurred`) |
| Glass opacity | Blends the sampled colour against the grout | `renderer.ts` |
| Grout and bevel | Grout colour, 0 to 8 px line thickness and a specular bevel toggle | `renderer.ts`, `Sidebar.tsx` |
| Presets | Classic Stained Glass, Frosted Bathroom Tile, Crystal Prism and Honeycomb | `src/lib/mosaic/presets.ts` |
| Live preview | Re-renders on settings change and when the container resizes | `MosaicCanvas.tsx`, `renderer.ts` (`renderPreview`) |
| PNG export | Regenerates the mosaic at the source image's natural size and downloads `mosaic.png` | `src/components/Sidebar.tsx`, `renderer.ts` (`exportMosaic`) |
| Collapsible control panel | A floating right sidebar with grouped sliders, selects and a colour input | `src/components/Sidebar.tsx`, `src/components/ui/` |

## Tech stack

- React 19.2.8, React DOM 19.2.8, TypeScript 6.0.3, Vite 8.2.2, Tailwind CSS
  4.3.3, shadcn 4.21.0 components over Base UI 1.8.0, Lucide 1.41.0.
- Canvas 2D only on this branch. There is no WebGL, no worker and no image
  codec dependency.
- Lint: oxlint 1.81.0. There is no test runner and no test script.
- Production dependencies: `@base-ui/react` 1.8.0 (MIT),
  `@fontsource-variable/geist` 5.3.0 (OFL-1.1),
  `class-variance-authority` 0.7.1 (Apache-2.0), `cn` 0.2.6 (MIT),
  `lucide-react` 1.41.0 (ISC), `react` and `react-dom` 19.2.8 (MIT), `shadcn`
  4.21.0 (MIT), `tailwindcss` 4.3.3 (MIT), `tw-animate-css` 1.4.0 (MIT).
- No deploy configuration and no `LICENSE` file.
- The README is still the stock Vite + React template.

## Techniques

- Voronoi cells are built by clipping the image rectangle against the
  perpendicular bisector of each point and its neighbours. A spatial hash limits
  the neighbour search to a 11x11 block of buckets, so a large tile count does
  not become quadratic (`grid.ts`, `generateVoronoiGrid`, `voronoiCell`).
- Jitter comes from a fixed-seed linear congruential generator. The same image,
  tile size and jitter produce the same cells on every reload, which makes a
  comparison between two settings meaningful (`seededRandom(42)`).
- The committed renderer is per-pixel: for every pixel inside a cell it samples
  the source with a refraction offset, optionally averages a weighted disc for
  frost, darkens near the cell edge, and adds a bevel highlight from a fixed
  light direction (`renderer.ts`, `renderMosaicPixelPerfect`).
- A vector fallback fills each polygon and paints a radial bevel, used when no
  `ImageData` is supplied. It keeps the preview working on the first frame
  before the pixel buffer exists (`renderMosaic`).
- The preview always renders at the source resolution into an offscreen canvas,
  then scales that canvas into the visible one with high-quality smoothing. The
  visible canvas never changes the tile math (`renderPreview`).
- Export builds a fresh grid and cell list at the original image size instead of
  upscaling the preview, so the downloaded PNG has true source detail
  (`Sidebar.tsx`, `generateCellsForExport`).
- The effect is keyed on the image and the whole settings object, so any slider
  rebuilds the cells. A container resize repaints from the cached cell list
  without rebuilding the grid (`MosaicCanvas.tsx`).

## Reusable pieces

| Piece | Kind | Path | Interface (one line) | Capabilities | Readiness | Notes |
|---|---|---|---|---|---|---|
| Mosaic grid generator | module | `src/lib/mosaic/grid.ts` | `generateGrid(w, h, settings)`, `computeMosaicCells(cells, imageData, w, h, settings)`, `pointInPolygon` | canvas-render, image-decode | extract | Four shapes and a seeded jitter. No tests; pure functions with `ImageData` in and polygons out. |
| Glass tile renderer | module | `src/lib/mosaic/renderer.ts` | `renderMosaic(ctx, cells, settings, w, h, imageData?)`, `renderPreview(...)` | canvas-render | extract | Per-pixel refraction, frost and bevel plus a vector fallback. No tests; CPU cost grows with pixels x cells. |
| PNG export | module | `src/lib/mosaic/renderer.ts` (`exportMosaic`) | `exportMosaic(image, cells, settings, imageData?) -> HTMLCanvasElement` | image-encode | as-is-untested | Renders at natural size and returns a canvas the caller turns into a data URL. No test. |
| Preset set | config | `src/lib/mosaic/presets.ts` | `PRESETS: {name, settings}[]` | design-tokens | reference | Four tuned combinations of grid, glass and grout settings. |
| Mosaic canvas | component | `src/components/MosaicCanvas.tsx` | `<MosaicCanvas settings sourceImage onImageLoad />` | file-intake, image-decode, canvas-render | extract | Owns drag/drop, the file picker, the offscreen buffer and `ResizeObserver`. Tied to the app's settings type. |
| Control sidebar | component | `src/components/Sidebar.tsx`, `src/components/ui/` | `<SidebarPanel settings onSettingsChange sourceImage />` | ui-components, settings-config | extract | A complete grouped settings panel over shadcn/Base UI primitives. Copy is app-specific. |

## Commands and gates

| Command | What it proves |
|---|---|
| `npm run dev` | Vite serves the app locally |
| `npm run build` | `tsc -b` and a production bundle |
| `npm run lint` | oxlint passes |
| `npm run preview` | The built bundle serves locally |

There is no gate beyond typecheck, lint and build. Nothing verifies the renderer,
the presets or the export path.

## Related projects

- `chabulab-tools/apps/mosaic` is the successor: the same stained-glass idea with
  a maintained app around it.
- `convertlab` handles browser image decode and PNG/JPG/WebP encode, but its
  writers and quality controls are a different approach.
- `crack-bloom` and `jelly-island` are also Vite + canvas/WebGL experiments, with
  no shared code.

## Known gaps

- Superseded. New work belongs in `chabulab-tools/apps/mosaic`, not here.
- No tests and no test runner. The grid math, the pixel renderer and the export
  path are unverified.
- The renderer is CPU-bound. Export on a large photo walks every pixel of every
  cell on the main thread, so the page can freeze with no progress or cancel.
- One image at a time; no undo, no before/after comparison, no save or restore of
  settings, and no URL state.
- No clipboard paste, no URL input and no drag of more than the first file.
- The stock Vite README does not describe the app, its controls or the export.
- No `LICENSE`; `package.json` is `private`.
