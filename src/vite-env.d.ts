/// <reference types="vite/client" />
/// <reference types="../electron/electron-env" />

interface ProcessedDesktopSource {
  id: string;
  name: string;
  display_id: string;
  thumbnail: string | null;
  appIcon: string | null;
}

interface CursorEvent {
  type: 'move' | 'click' | 'scroll';
  timestamp: number;
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  button?: number;
  scrollDelta?: number;
}

interface Window {
  electronAPI: {
    getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>
    switchToEditor: () => Promise<void>
    openSourceSelector: () => Promise<void>
    selectSource: (source: any) => Promise<any>
    getSelectedSource: () => Promise<any>
    storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{
      success: boolean
      path?: string
      message: string
      error?: string
    }>
    getRecordedVideoPath: () => Promise<{
      success: boolean
      path?: string
      message?: string
      error?: string
    }>
    getAssetBasePath: () => Promise<string | null>
    setRecordingState: (recording: boolean) => Promise<void>
    onStopRecordingFromTray: (callback: () => void) => () => void
    openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
    saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{
      success: boolean
      path?: string
      message?: string
      cancelled?: boolean
    }>
    openVideoFilePicker: () => Promise<{ success: boolean; path?: string; cancelled?: boolean }>
    setCurrentVideoPath: (path: string) => Promise<{ success: boolean }>
    getCurrentVideoPath: () => Promise<{ success: boolean; path?: string }>
    clearCurrentVideoPath: () => Promise<{ success: boolean }>
    getPlatform: () => Promise<string>
    startMouseTracking: (config: { sourceId: string; recordingStartTime: number }) => Promise<{ success: boolean; error?: string }>
    stopMouseTracking: () => Promise<{ success: boolean; events: CursorEvent[]; error?: string }>
    getCursorEvents: () => Promise<{ success: boolean; events: CursorEvent[]; error?: string }>
    storeCursorEvents: (events: CursorEvent[], videoPath: string) => Promise<{ success: boolean; path?: string; error?: string }>
    loadCursorEvents: (videoPath: string) => Promise<{ success: boolean; events: CursorEvent[]; error?: string }>
    checkAccessibilityPermissions: () => Promise<{ success: boolean; granted: boolean; error?: string }>
    hudOverlayHide: () => void
    hudOverlayClose: () => void
  }
}