# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start Vite dev server with Electron hot reload
npm run build        # Full production build (tsc + vite + electron-builder)
npm run build:mac    # Build for macOS
npm run build:win    # Build for Windows
npm run build:linux  # Build for Linux
npm run lint         # ESLint with zero warnings tolerance
npm run test         # Run Vitest tests once
npm run test:watch   # Run Vitest in watch mode
```

## Architecture Overview

OpenScreen is an Electron + React + TypeScript video editing application for creating product demos with zoom effects, annotations, and exports.

### Multi-Window Architecture

The app manages 3 distinct Electron windows, routed via `?windowType=` query parameter in `App.tsx`:

1. **HUD Overlay** (`hud-overlay`) - Floating recording toolbar, always-on-top
2. **Source Selector** (`source-selector`) - Modal for choosing screen/app to record
3. **Editor** (`editor`) - Main editing interface with video preview, timeline, and settings

**Flow:** HUD → Record → Store WebM via IPC → Open Editor → Edit → Export

### Key Directory Structure

```
electron/
  main.ts           # App lifecycle, window management, tray
  windows.ts        # Window creation functions
  preload.ts        # IPC bridge (electronAPI)
  ipc/handlers.ts   # IPC request/response handlers

src/
  components/
    launch/         # Recording HUD and source selection
    video-editor/   # Main editing interface
      VideoEditor.tsx      # Central state container (40+ useState hooks)
      VideoPlayback.tsx    # PixiJS real-time preview rendering
      timeline/            # dnd-timeline based editor
      videoPlayback/       # Zoom/pan calculation utilities
    ui/             # Radix UI component wrappers

  lib/exporter/     # Export pipeline
    videoExporter.ts      # Orchestrator
    frameRenderer.ts      # Offscreen PixiJS rendering
    gifExporter.ts        # GIF export via gif.js
    muxer.ts              # MP4 muxing via mp4box
    annotationRenderer.ts # Text/arrow/image rendering
```

### State Management

No Redux/Zustand - state is centralized in `VideoEditor.tsx` with useState hooks. Key data types in `types.ts`:

- **ZoomRegion**: `{ id, startMs, endMs, depth: 1-6, focus: {cx, cy} }`
- **TrimRegion**: `{ id, startMs, endMs }`
- **AnnotationRegion**: `{ id, startMs, endMs, type, content, position, size, style, zIndex }`
- **CropRegion**: `{ x, y, width, height }` (normalized 0-1)

### PixiJS Rendering

**Container hierarchy in VideoPlayback.tsx:**
```
stage
  └─ cameraContainer (zoom transform)
       ├─ videoContainer
       │    └─ videoSprite (HTML video → texture)
       └─ maskGraphics (rounded corners + padding)
```

Effects are composited: wallpaper background → video with crop → zoom/pan transform → blur filter → shadow overlay → annotation HTML layer.

### Export Pipeline

```
VideoExporter.export()
  ├─ VideoFileDecoder (metadata extraction)
  ├─ FrameRenderer (offscreen PixiJS + annotations)
  ├─ VideoEncoder (Web Codecs API → h.264)
  ├─ VideoMuxer (mp4box → MP4 container)
  └─ Blob → IPC save to Downloads
```

GIF export uses the same frame renderer but outputs via gif.js workers.

### IPC Bridge

The `electronAPI` in preload.ts exposes:
- Recording: `storeRecordedVideo()`, `getRecordedVideoPath()`
- Navigation: `switchToEditor()`, `openSourceSelector()`
- File I/O: `saveExportedVideo()`, `openVideoFilePicker()`
- Sources: `getSources()`, `selectSource()`, `getSelectedSource()`

### Important Patterns

- **Zoom animation**: Uses refs (not state) to track animation progress without re-renders. Smooth transitions over 320ms with easing. Math utilities in `videoPlayback/zoomTransform.ts`.
- **Timeline**: Built on `dnd-timeline` library with three parallel rows (zoom, trim, annotations).
- **Backpressure handling**: Export encoder uses max queue size of 120 for parallel encoding.
- **Platform abstraction**: Platform-specific code handled via `preload.ts` and `platformUtils.ts`.

### Build Configuration

- Vite with manual chunks: pixi, react-vendor, video-processing
- TypeScript strict mode, ES2020 target
- Path alias `@` → `src/`
