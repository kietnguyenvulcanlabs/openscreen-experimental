import { v4 as uuidv4 } from 'uuid';
import type { CursorEvent, ZoomRegion, ZoomFocus, ZoomDepth, ZoomKeyframe } from '@/components/video-editor/types';

export interface AutoZoomConfig {
  enabled: boolean;
  zoomDepth: ZoomDepth;
  zoomDuration: number;
  minIntervalBetweenZooms: number;
}

export const DEFAULT_AUTO_ZOOM_CONFIG: AutoZoomConfig = {
  enabled: false,
  zoomDepth: 3,
  zoomDuration: 2000,
  minIntervalBetweenZooms: 1000,
};

/**
 * Catmull-Rom spline interpolation for smooth cursor following
 */
function catmullRomSpline(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;

  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Ken Perlin's smootherStep easing function for natural motion
 */
function smootherStep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Generate smooth keyframes from cursor events using Catmull-Rom interpolation
 */
function generateKeyframesFromCursor(
  cursorEvents: CursorEvent[],
  startMs: number,
  endMs: number
): ZoomKeyframe[] {
  const SAMPLING_INTERVAL = 50; // Sample every 50ms
  const MOVEMENT_THRESHOLD = 0.01; // 1% movement threshold

  const relevantEvents = cursorEvents.filter(
    (e) => e.type === 'move' && e.timestamp >= startMs && e.timestamp <= endMs
  );

  if (relevantEvents.length === 0) {
    return [];
  }

  const keyframes: ZoomKeyframe[] = [];
  let lastRecordedFocus: ZoomFocus | null = null;

  for (let timestamp = startMs; timestamp <= endMs; timestamp += SAMPLING_INTERVAL) {
    // Find surrounding events for Catmull-Rom interpolation
    const eventsBefore = relevantEvents.filter((e) => e.timestamp <= timestamp);
    const eventsAfter = relevantEvents.filter((e) => e.timestamp > timestamp);

    if (eventsBefore.length === 0 && eventsAfter.length === 0) continue;

    let focus: ZoomFocus;

    if (eventsBefore.length === 0) {
      // Use first event
      focus = { cx: eventsAfter[0].normalizedX, cy: eventsAfter[0].normalizedY };
    } else if (eventsAfter.length === 0) {
      // Use last event
      const last = eventsBefore[eventsBefore.length - 1];
      focus = { cx: last.normalizedX, cy: last.normalizedY };
    } else {
      // Interpolate using Catmull-Rom
      const p1 = eventsBefore[eventsBefore.length - 1];
      const p2 = eventsAfter[0];
      const p0 = eventsBefore.length > 1 ? eventsBefore[eventsBefore.length - 2] : p1;
      const p3 = eventsAfter.length > 1 ? eventsAfter[1] : p2;

      const t = (timestamp - p1.timestamp) / (p2.timestamp - p1.timestamp);
      const smoothT = smootherStep(t);

      focus = {
        cx: catmullRomSpline(p0.normalizedX, p1.normalizedX, p2.normalizedX, p3.normalizedX, smoothT),
        cy: catmullRomSpline(p0.normalizedY, p1.normalizedY, p2.normalizedY, p3.normalizedY, smoothT),
      };
    }

    // Only record if movement exceeds threshold
    if (lastRecordedFocus) {
      const dx = Math.abs(focus.cx - lastRecordedFocus.cx);
      const dy = Math.abs(focus.cy - lastRecordedFocus.cy);
      if (dx < MOVEMENT_THRESHOLD && dy < MOVEMENT_THRESHOLD) {
        continue;
      }
    }

    keyframes.push({
      timestamp: timestamp - startMs,
      focus,
    });
    lastRecordedFocus = focus;
  }

  return keyframes;
}

/**
 * Generate auto-zoom regions from cursor click events
 */
export function generateAutoZoomRegions(
  cursorEvents: CursorEvent[],
  config: AutoZoomConfig,
  videoDuration: number
): ZoomRegion[] {
  if (!config.enabled) {
    return [];
  }

  const clickEvents = cursorEvents.filter((e) => e.type === 'click');
  const zoomRegions: ZoomRegion[] = [];
  let lastZoomEndTime = -config.minIntervalBetweenZooms;

  for (const clickEvent of clickEvents) {
    // Skip if too close to previous zoom
    if (clickEvent.timestamp < lastZoomEndTime + config.minIntervalBetweenZooms) {
      continue;
    }

    const startMs = Math.max(0, clickEvent.timestamp);
    const endMs = Math.min(videoDuration, clickEvent.timestamp + config.zoomDuration);

    // Generate keyframes for smooth cursor following during zoom
    const keyframes = generateKeyframesFromCursor(cursorEvents, startMs, endMs);

    zoomRegions.push({
      id: uuidv4(),
      startMs,
      endMs,
      depth: config.zoomDepth,
      focus: {
        cx: clickEvent.normalizedX,
        cy: clickEvent.normalizedY,
      },
      keyframes,
    });

    lastZoomEndTime = endMs;
  }

  return zoomRegions;
}

/**
 * Get cursor position at a specific timestamp with interpolation
 */
export function getCursorPositionAtTime(
  cursorEvents: CursorEvent[],
  timestamp: number
): ZoomFocus | null {
  if (cursorEvents.length === 0) {
    return null;
  }

  const moveEvents = cursorEvents.filter((e) => e.type === 'move');

  if (moveEvents.length === 0) {
    return null;
  }

  // Find closest events before and after timestamp
  const eventsBefore = moveEvents.filter((e) => e.timestamp <= timestamp);
  const eventsAfter = moveEvents.filter((e) => e.timestamp > timestamp);

  if (eventsBefore.length === 0) {
    const first = eventsAfter[0];
    return { cx: first.normalizedX, cy: first.normalizedY };
  }

  if (eventsAfter.length === 0) {
    const last = eventsBefore[eventsBefore.length - 1];
    return { cx: last.normalizedX, cy: last.normalizedY };
  }

  // Linear interpolation
  const p1 = eventsBefore[eventsBefore.length - 1];
  const p2 = eventsAfter[0];
  const t = (timestamp - p1.timestamp) / (p2.timestamp - p1.timestamp);

  return {
    cx: p1.normalizedX + (p2.normalizedX - p1.normalizedX) * t,
    cy: p1.normalizedY + (p2.normalizedY - p1.normalizedY) * t,
  };
}

/**
 * Get interpolated focus point for a zoom region with keyframes
 */
export function getInterpolatedFocus(
  region: ZoomRegion,
  currentTimeMs: number
): ZoomFocus {
  if (!region.keyframes || region.keyframes.length === 0) {
    return region.focus;
  }

  const relativeTime = currentTimeMs - region.startMs;

  // Find surrounding keyframes
  const keyframesBefore = region.keyframes.filter((k) => k.timestamp <= relativeTime);
  const keyframesAfter = region.keyframes.filter((k) => k.timestamp > relativeTime);

  if (keyframesBefore.length === 0) {
    return region.keyframes[0].focus;
  }

  if (keyframesAfter.length === 0) {
    return region.keyframes[region.keyframes.length - 1].focus;
  }

  const k1 = keyframesBefore[keyframesBefore.length - 1];
  const k2 = keyframesAfter[0];
  const t = (relativeTime - k1.timestamp) / (k2.timestamp - k1.timestamp);
  const smoothT = smootherStep(t);

  return {
    cx: k1.focus.cx + (k2.focus.cx - k1.focus.cx) * smoothT,
    cy: k1.focus.cy + (k2.focus.cy - k1.focus.cy) * smoothT,
  };
}
