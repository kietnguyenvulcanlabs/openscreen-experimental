var U = Object.defineProperty;
var A = (n, r, t) => r in n ? U(n, r, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[r] = t;
var m = (n, r, t) => A(n, typeof r != "symbol" ? r + "" : r, t);
import { ipcMain as a, screen as I, BrowserWindow as P, desktopCapturer as H, shell as N, app as h, dialog as O, nativeImage as $, Tray as q, Menu as B } from "electron";
import { fileURLToPath as z } from "node:url";
import c from "node:path";
import f from "node:fs/promises";
import { uIOhook as T } from "uiohook-napi";
const _ = c.dirname(z(import.meta.url)), G = c.join(_, ".."), v = process.env.VITE_DEV_SERVER_URL, D = c.join(G, "dist");
let w = null;
a.on("hud-overlay-hide", () => {
  w && !w.isDestroyed() && w.minimize();
});
function X() {
  const n = I.getPrimaryDisplay(), { workArea: r } = n, t = 500, u = 100, l = Math.floor(r.x + (r.width - t) / 2), p = Math.floor(r.y + r.height - u - 5), e = new P({
    width: t,
    height: u,
    minWidth: 500,
    maxWidth: 500,
    minHeight: 100,
    maxHeight: 100,
    x: l,
    y: p,
    frame: !1,
    transparent: !0,
    resizable: !1,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    hasShadow: !1,
    webPreferences: {
      preload: c.join(_, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      backgroundThrottling: !1
    }
  });
  return e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), w = e, e.on("closed", () => {
    w === e && (w = null);
  }), v ? e.loadURL(v + "?windowType=hud-overlay") : e.loadFile(c.join(D, "index.html"), {
    query: { windowType: "hud-overlay" }
  }), e;
}
function Y() {
  const n = process.platform === "darwin", r = new P({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...n && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 12, y: 12 }
    },
    transparent: !1,
    resizable: !0,
    alwaysOnTop: !1,
    skipTaskbar: !1,
    title: "OpenScreen",
    backgroundColor: "#000000",
    webPreferences: {
      preload: c.join(_, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      webSecurity: !1,
      backgroundThrottling: !1
    }
  });
  return r.maximize(), r.webContents.on("did-finish-load", () => {
    r == null || r.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), v ? r.loadURL(v + "?windowType=editor") : r.loadFile(c.join(D, "index.html"), {
    query: { windowType: "editor" }
  }), r;
}
function J() {
  const { width: n, height: r } = I.getPrimaryDisplay().workAreaSize, t = new P({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((n - 620) / 2),
    y: Math.round((r - 420) / 2),
    frame: !1,
    resizable: !1,
    alwaysOnTop: !0,
    transparent: !0,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: c.join(_, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  return v ? t.loadURL(v + "?windowType=source-selector") : t.loadFile(c.join(D, "index.html"), {
    query: { windowType: "source-selector" }
  }), t;
}
class Q {
  constructor() {
    m(this, "events", []);
    m(this, "isTracking", !1);
    m(this, "config", null);
    m(this, "lastMoveTimestamp", 0);
    m(this, "THROTTLE_MS", 8);
  }
  start(r) {
    if (this.isTracking) {
      console.warn("MouseTracker is already tracking");
      return;
    }
    this.config = r, this.events = [], this.isTracking = !0, this.lastMoveTimestamp = 0, console.log("Starting mouse tracking for source:", r.sourceId), T.on("mousemove", (t) => {
      if (!this.isTracking) return;
      const u = Date.now();
      if (u - this.lastMoveTimestamp < this.THROTTLE_MS)
        return;
      this.lastMoveTimestamp = u;
      const l = this.normalizeCoordinates(t.x, t.y);
      this.events.push({
        type: "move",
        timestamp: u - this.config.recordingStartTime,
        x: t.x,
        y: t.y,
        normalizedX: l.x,
        normalizedY: l.y
      });
    }), T.on("click", (t) => {
      if (!this.isTracking) return;
      const u = Date.now(), l = this.normalizeCoordinates(t.x, t.y);
      this.events.push({
        type: "click",
        timestamp: u - this.config.recordingStartTime,
        x: t.x,
        y: t.y,
        normalizedX: l.x,
        normalizedY: l.y,
        button: typeof t.button == "number" ? t.button : void 0
      });
    }), T.on("wheel", (t) => {
      if (!this.isTracking) return;
      const u = Date.now(), l = this.normalizeCoordinates(t.x, t.y);
      this.events.push({
        type: "scroll",
        timestamp: u - this.config.recordingStartTime,
        x: t.x,
        y: t.y,
        normalizedX: l.x,
        normalizedY: l.y,
        scrollDelta: typeof t.rotation == "number" ? t.rotation : 0
      });
    }), T.start();
  }
  stop() {
    if (!this.isTracking)
      return console.warn("MouseTracker is not tracking"), [];
    console.log(`Stopping mouse tracking. Captured ${this.events.length} events`), this.isTracking = !1;
    try {
      T.stop();
    } catch (t) {
      console.error("Error stopping uIOhook:", t);
    }
    const r = [...this.events];
    return this.events = [], this.config = null, r;
  }
  getEvents() {
    return [...this.events];
  }
  normalizeCoordinates(r, t) {
    const u = I.getPrimaryDisplay(), { bounds: l } = u, p = Math.max(0, Math.min(1, (r - l.x) / l.width)), e = Math.max(0, Math.min(1, (t - l.y) / l.height));
    return { x: p, y: e };
  }
}
let b = null;
function R() {
  return b || (b = new Q()), b;
}
let E = null;
function K(n, r, t, u, l) {
  a.handle("get-sources", async (e, i) => (await H.getSources(i)).map((s) => ({
    id: s.id,
    name: s.name,
    display_id: s.display_id,
    thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : null,
    appIcon: s.appIcon ? s.appIcon.toDataURL() : null
  }))), a.handle("select-source", (e, i) => {
    E = i;
    const o = u();
    return o && o.close(), E;
  }), a.handle("get-selected-source", () => E), a.handle("open-source-selector", () => {
    const e = u();
    if (e) {
      e.focus();
      return;
    }
    r();
  }), a.handle("switch-to-editor", () => {
    const e = t();
    e && e.close(), n();
  }), a.handle("store-recorded-video", async (e, i, o) => {
    try {
      const s = c.join(g, o);
      return await f.writeFile(s, Buffer.from(i)), p = s, {
        success: !0,
        path: s,
        message: "Video stored successfully"
      };
    } catch (s) {
      return console.error("Failed to store video:", s), {
        success: !1,
        message: "Failed to store video",
        error: String(s)
      };
    }
  }), a.handle("get-recorded-video-path", async () => {
    try {
      const i = (await f.readdir(g)).filter((S) => S.endsWith(".webm"));
      if (i.length === 0)
        return { success: !1, message: "No recorded video found" };
      const o = i.sort().reverse()[0];
      return { success: !0, path: c.join(g, o) };
    } catch (e) {
      return console.error("Failed to get video path:", e), { success: !1, message: "Failed to get video path", error: String(e) };
    }
  }), a.handle("set-recording-state", (e, i) => {
    l && l(i, (E || { name: "Screen" }).name);
  }), a.handle("open-external-url", async (e, i) => {
    try {
      return await N.openExternal(i), { success: !0 };
    } catch (o) {
      return console.error("Failed to open URL:", o), { success: !1, error: String(o) };
    }
  }), a.handle("get-asset-base-path", () => {
    try {
      return h.isPackaged ? c.join(process.resourcesPath, "assets") : c.join(h.getAppPath(), "public", "assets");
    } catch (e) {
      return console.error("Failed to resolve asset base path:", e), null;
    }
  }), a.handle("save-exported-video", async (e, i, o) => {
    try {
      const s = o.toLowerCase().endsWith(".gif"), S = s ? [{ name: "GIF Image", extensions: ["gif"] }] : [{ name: "MP4 Video", extensions: ["mp4"] }], x = await O.showSaveDialog({
        title: s ? "Save Exported GIF" : "Save Exported Video",
        defaultPath: c.join(h.getPath("downloads"), o),
        filters: S,
        properties: ["createDirectory", "showOverwriteConfirmation"]
      });
      return x.canceled || !x.filePath ? {
        success: !1,
        cancelled: !0,
        message: "Export cancelled"
      } : (await f.writeFile(x.filePath, Buffer.from(i)), {
        success: !0,
        path: x.filePath,
        message: "Video exported successfully"
      });
    } catch (s) {
      return console.error("Failed to save exported video:", s), {
        success: !1,
        message: "Failed to save exported video",
        error: String(s)
      };
    }
  }), a.handle("open-video-file-picker", async () => {
    try {
      const e = await O.showOpenDialog({
        title: "Select Video File",
        defaultPath: g,
        filters: [
          { name: "Video Files", extensions: ["webm", "mp4", "mov", "avi", "mkv"] },
          { name: "All Files", extensions: ["*"] }
        ],
        properties: ["openFile"]
      });
      return e.canceled || e.filePaths.length === 0 ? { success: !1, cancelled: !0 } : {
        success: !0,
        path: e.filePaths[0]
      };
    } catch (e) {
      return console.error("Failed to open file picker:", e), {
        success: !1,
        message: "Failed to open file picker",
        error: String(e)
      };
    }
  });
  let p = null;
  a.handle("set-current-video-path", (e, i) => (p = i, { success: !0 })), a.handle("get-current-video-path", () => p ? { success: !0, path: p } : { success: !1 }), a.handle("clear-current-video-path", () => (p = null, { success: !0 })), a.handle("get-platform", () => process.platform), a.handle("start-mouse-tracking", (e, i) => {
    try {
      return R().start(i), { success: !0 };
    } catch (o) {
      return console.error("Failed to start mouse tracking:", o), { success: !1, error: String(o) };
    }
  }), a.handle("stop-mouse-tracking", () => {
    try {
      return { success: !0, events: R().stop() };
    } catch (e) {
      return console.error("Failed to stop mouse tracking:", e), { success: !1, error: String(e), events: [] };
    }
  }), a.handle("get-cursor-events", () => {
    try {
      return { success: !0, events: R().getEvents() };
    } catch (e) {
      return console.error("Failed to get cursor events:", e), { success: !1, error: String(e), events: [] };
    }
  }), a.handle("store-cursor-events", async (e, i, o) => {
    try {
      const s = o.replace(/\.(webm|mp4)$/i, "-cursor-events.json");
      return await f.writeFile(s, JSON.stringify(i, null, 2)), { success: !0, path: s };
    } catch (s) {
      return console.error("Failed to store cursor events:", s), { success: !1, error: String(s) };
    }
  }), a.handle("load-cursor-events", async (e, i) => {
    try {
      const o = i.replace(/\.(webm|mp4)$/i, "-cursor-events.json"), s = await f.readFile(o, "utf-8");
      return { success: !0, events: JSON.parse(s) };
    } catch (o) {
      return o.code === "ENOENT" ? { success: !0, events: [] } : (console.error("Failed to load cursor events:", o), { success: !1, error: String(o), events: [] });
    }
  });
}
const Z = c.dirname(z(import.meta.url)), g = c.join(h.getPath("userData"), "recordings");
async function ee() {
  try {
    await f.mkdir(g, { recursive: !0 }), console.log("RECORDINGS_DIR:", g), console.log("User Data Path:", h.getPath("userData"));
  } catch (n) {
    console.error("Failed to create recordings directory:", n);
  }
}
process.env.APP_ROOT = c.join(Z, "..");
const te = process.env.VITE_DEV_SERVER_URL, de = c.join(process.env.APP_ROOT, "dist-electron"), V = c.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = te ? c.join(process.env.APP_ROOT, "public") : V;
let d = null, k = null, y = null, W = "";
const C = L("openscreen.png"), re = L("rec-button.png");
function F() {
  d = X();
}
function M() {
  y = new q(C);
}
function L(n) {
  return $.createFromPath(c.join(process.env.VITE_PUBLIC || V, n)).resize({
    width: 24,
    height: 24,
    quality: "best"
  });
}
function j(n = !1) {
  if (!y) return;
  const r = n ? re : C, t = n ? `Recording: ${W}` : "OpenScreen", u = n ? [
    {
      label: "Stop Recording",
      click: () => {
        d && !d.isDestroyed() && d.webContents.send("stop-recording-from-tray");
      }
    }
  ] : [
    {
      label: "Open",
      click: () => {
        d && !d.isDestroyed() ? d.isMinimized() && d.restore() : F();
      }
    },
    {
      label: "Quit",
      click: () => {
        h.quit();
      }
    }
  ];
  y.setImage(r), y.setToolTip(t), y.setContextMenu(B.buildFromTemplate(u));
}
function se() {
  d && (d.close(), d = null), d = Y();
}
function oe() {
  return k = J(), k.on("closed", () => {
    k = null;
  }), k;
}
h.on("window-all-closed", () => {
});
h.on("activate", () => {
  P.getAllWindows().length === 0 && F();
});
h.whenReady().then(async () => {
  const { ipcMain: n } = await import("electron");
  n.on("hud-overlay-close", () => {
    h.quit();
  }), M(), j(), await ee(), K(
    se,
    oe,
    () => d,
    () => k,
    (r, t) => {
      W = t, y || M(), j(r), r || d && d.restore();
    }
  ), F();
});
export {
  de as MAIN_DIST,
  g as RECORDINGS_DIR,
  V as RENDERER_DIST,
  te as VITE_DEV_SERVER_URL
};
