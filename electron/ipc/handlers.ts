import { ipcMain, desktopCapturer, BrowserWindow, shell, app, dialog, systemPreferences } from 'electron'

import fs from 'node:fs/promises'
import path from 'node:path'
import { RECORDINGS_DIR } from '../main'
import { getMouseTracker, CursorEvent } from '../mouse-tracker'

let selectedSource: any = null

export function registerIpcHandlers(
  createEditorWindow: () => void,
  createSourceSelectorWindow: () => BrowserWindow,
  getMainWindow: () => BrowserWindow | null,
  getSourceSelectorWindow: () => BrowserWindow | null,
  onRecordingStateChange?: (recording: boolean, sourceName: string) => void
) {
  ipcMain.handle('get-sources', async (_, opts) => {
    const sources = await desktopCapturer.getSources(opts)
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }))
  })

  ipcMain.handle('select-source', (_, source) => {
    selectedSource = source
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.close()
    }
    return selectedSource
  })

  ipcMain.handle('get-selected-source', () => {
    return selectedSource
  })

  ipcMain.handle('open-source-selector', () => {
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.focus()
      return
    }
    createSourceSelectorWindow()
  })

  ipcMain.handle('switch-to-editor', () => {
    const mainWin = getMainWindow()
    if (mainWin) {
      mainWin.close()
    }
    createEditorWindow()
  })



  ipcMain.handle('store-recorded-video', async (_, videoData: ArrayBuffer, fileName: string) => {
    try {
      const videoPath = path.join(RECORDINGS_DIR, fileName)
      await fs.writeFile(videoPath, Buffer.from(videoData))
      currentVideoPath = videoPath;
      return {
        success: true,
        path: videoPath,
        message: 'Video stored successfully'
      }
    } catch (error) {
      console.error('Failed to store video:', error)
      return {
        success: false,
        message: 'Failed to store video',
        error: String(error)
      }
    }
  })



  ipcMain.handle('get-recorded-video-path', async () => {
    try {
      const files = await fs.readdir(RECORDINGS_DIR)
      const videoFiles = files.filter(file => file.endsWith('.webm'))
      
      if (videoFiles.length === 0) {
        return { success: false, message: 'No recorded video found' }
      }
      
      const latestVideo = videoFiles.sort().reverse()[0]
      const videoPath = path.join(RECORDINGS_DIR, latestVideo)
      
      return { success: true, path: videoPath }
    } catch (error) {
      console.error('Failed to get video path:', error)
      return { success: false, message: 'Failed to get video path', error: String(error) }
    }
  })

  ipcMain.handle('set-recording-state', (_, recording: boolean) => {
    const source = selectedSource || { name: 'Screen' }
    if (onRecordingStateChange) {
      onRecordingStateChange(recording, source.name)
    }
  })


  ipcMain.handle('open-external-url', async (_, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('Failed to open URL:', error)
      return { success: false, error: String(error) }
    }
  })

  // Return base path for assets so renderer can resolve file:// paths in production
  ipcMain.handle('get-asset-base-path', () => {
    try {
      if (app.isPackaged) {
        return path.join(process.resourcesPath, 'assets')
      }
      return path.join(app.getAppPath(), 'public', 'assets')
    } catch (err) {
      console.error('Failed to resolve asset base path:', err)
      return null
    }
  })

  ipcMain.handle('save-exported-video', async (_, videoData: ArrayBuffer, fileName: string) => {
    try {
      // Determine file type from extension
      const isGif = fileName.toLowerCase().endsWith('.gif');
      const filters = isGif 
        ? [{ name: 'GIF Image', extensions: ['gif'] }]
        : [{ name: 'MP4 Video', extensions: ['mp4'] }];

      const result = await dialog.showSaveDialog({
        title: isGif ? 'Save Exported GIF' : 'Save Exported Video',
        defaultPath: path.join(app.getPath('downloads'), fileName),
        filters,
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });

      if (result.canceled || !result.filePath) {
        return {
          success: false,
          cancelled: true,
          message: 'Export cancelled'
        };
      }

      await fs.writeFile(result.filePath, Buffer.from(videoData));

      return {
        success: true,
        path: result.filePath,
        message: 'Video exported successfully'
      };
    } catch (error) {
      console.error('Failed to save exported video:', error)
      return {
        success: false,
        message: 'Failed to save exported video',
        error: String(error)
      }
    }
  })

  ipcMain.handle('open-video-file-picker', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Video File',
        defaultPath: RECORDINGS_DIR,
        filters: [
          { name: 'Video Files', extensions: ['webm', 'mp4', 'mov', 'avi', 'mkv'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }

      return {
        success: true,
        path: result.filePaths[0]
      };
    } catch (error) {
      console.error('Failed to open file picker:', error);
      return {
        success: false,
        message: 'Failed to open file picker',
        error: String(error)
      };
    }
  });

  let currentVideoPath: string | null = null;

  ipcMain.handle('set-current-video-path', (_, path: string) => {
    currentVideoPath = path;
    return { success: true };
  });

  ipcMain.handle('get-current-video-path', () => {
    return currentVideoPath ? { success: true, path: currentVideoPath } : { success: false };
  });

  ipcMain.handle('clear-current-video-path', () => {
    currentVideoPath = null;
    return { success: true };
  });

  ipcMain.handle('get-platform', () => {
    return process.platform;
  });

  // Mouse tracking handlers
  ipcMain.handle('start-mouse-tracking', (_, config: { sourceId: string; recordingStartTime: number }) => {
    try {
      const tracker = getMouseTracker();
      tracker.start(config);
      return { success: true };
    } catch (error) {
      console.error('Failed to start mouse tracking:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('stop-mouse-tracking', () => {
    try {
      const tracker = getMouseTracker();
      const events = tracker.stop();
      return { success: true, events };
    } catch (error) {
      console.error('Failed to stop mouse tracking:', error);
      return { success: false, error: String(error), events: [] };
    }
  });

  ipcMain.handle('get-cursor-events', () => {
    try {
      const tracker = getMouseTracker();
      const events = tracker.getEvents();
      return { success: true, events };
    } catch (error) {
      console.error('Failed to get cursor events:', error);
      return { success: false, error: String(error), events: [] };
    }
  });

  ipcMain.handle('store-cursor-events', async (_, events: CursorEvent[], videoPath: string) => {
    try {
      const cursorEventsPath = videoPath.replace(/\.(webm|mp4)$/i, '-cursor-events.json');
      await fs.writeFile(cursorEventsPath, JSON.stringify(events, null, 2));
      return { success: true, path: cursorEventsPath };
    } catch (error) {
      console.error('Failed to store cursor events:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('load-cursor-events', async (_, videoPath: string) => {
    try {
      const cursorEventsPath = videoPath.replace(/\.(webm|mp4)$/i, '-cursor-events.json');
      const data = await fs.readFile(cursorEventsPath, 'utf-8');
      const events = JSON.parse(data) as CursorEvent[];
      return { success: true, events };
    } catch (error) {
      // File might not exist, which is ok
      if ((error as any).code === 'ENOENT') {
        return { success: true, events: [] };
      }
      console.error('Failed to load cursor events:', error);
      return { success: false, error: String(error), events: [] };
    }
  });

  // Check accessibility permissions (macOS only)
  ipcMain.handle('check-accessibility-permissions', () => {
    if (process.platform !== 'darwin') {
      return { success: true, granted: true };
    }

    try {
      const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
      return { success: true, granted: isTrusted };
    } catch (error) {
      console.error('Failed to check accessibility permissions:', error);
      return { success: false, granted: false, error: String(error) };
    }
  });
}
