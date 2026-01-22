import { screen } from 'electron';
import { uIOhook } from 'uiohook-napi';

export interface CursorEvent {
  type: 'move' | 'click' | 'scroll';
  timestamp: number;
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  button?: number;
  scrollDelta?: number;
}

interface MouseTrackerConfig {
  sourceId: string;
  recordingStartTime: number;
}

export class MouseTracker {
  private events: CursorEvent[] = [];
  private isTracking = false;
  private config: MouseTrackerConfig | null = null;
  private lastMoveTimestamp = 0;
  private readonly THROTTLE_MS = 8;

  start(config: MouseTrackerConfig): void {
    if (this.isTracking) {
      console.warn('MouseTracker is already tracking');
      return;
    }

    this.config = config;
    this.events = [];
    this.isTracking = true;
    this.lastMoveTimestamp = 0;

    console.log('Starting mouse tracking for source:', config.sourceId);

    // Register mouse move handler with throttling
    uIOhook.on('mousemove', (event) => {
      if (!this.isTracking) return;

      const now = Date.now();
      if (now - this.lastMoveTimestamp < this.THROTTLE_MS) {
        return;
      }
      this.lastMoveTimestamp = now;

      const normalized = this.normalizeCoordinates(event.x, event.y);
      this.events.push({
        type: 'move',
        timestamp: now - this.config!.recordingStartTime,
        x: event.x,
        y: event.y,
        normalizedX: normalized.x,
        normalizedY: normalized.y,
      });
    });

    // Register click handler
    uIOhook.on('click', (event) => {
      if (!this.isTracking) return;

      const now = Date.now();
      const normalized = this.normalizeCoordinates(event.x, event.y);
      this.events.push({
        type: 'click',
        timestamp: now - this.config!.recordingStartTime,
        x: event.x,
        y: event.y,
        normalizedX: normalized.x,
        normalizedY: normalized.y,
        button: typeof event.button === 'number' ? event.button : undefined,
      });
    });

    // Register wheel/scroll handler
    uIOhook.on('wheel', (event) => {
      if (!this.isTracking) return;

      const now = Date.now();
      const normalized = this.normalizeCoordinates(event.x, event.y);
      this.events.push({
        type: 'scroll',
        timestamp: now - this.config!.recordingStartTime,
        x: event.x,
        y: event.y,
        normalizedX: normalized.x,
        normalizedY: normalized.y,
        scrollDelta: typeof event.rotation === 'number' ? event.rotation : 0,
      });
    });

    // Start the uIOhook event loop
    uIOhook.start();
  }

  stop(): CursorEvent[] {
    if (!this.isTracking) {
      console.warn('MouseTracker is not tracking');
      return [];
    }

    console.log(`Stopping mouse tracking. Captured ${this.events.length} events`);

    this.isTracking = false;

    // Stop the uIOhook event loop
    try {
      uIOhook.stop();
    } catch (error) {
      console.error('Error stopping uIOhook:', error);
    }

    const capturedEvents = [...this.events];
    this.events = [];
    this.config = null;

    return capturedEvents;
  }

  getEvents(): CursorEvent[] {
    return [...this.events];
  }

  private normalizeCoordinates(x: number, y: number): { x: number; y: number } {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { bounds } = primaryDisplay;

    // Normalize to 0-1 range based on primary display bounds
    const normalizedX = Math.max(0, Math.min(1, (x - bounds.x) / bounds.width));
    const normalizedY = Math.max(0, Math.min(1, (y - bounds.y) / bounds.height));

    return { x: normalizedX, y: normalizedY };
  }
}

// Singleton instance
let mouseTracker: MouseTracker | null = null;

export function getMouseTracker(): MouseTracker {
  if (!mouseTracker) {
    mouseTracker = new MouseTracker();
  }
  return mouseTracker;
}
