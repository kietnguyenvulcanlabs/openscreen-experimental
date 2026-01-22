var H = Object.defineProperty;
var N = (o, r, t) => r in o ? H(o, r, { enumerable: !0, configurable: !0, writable: !0, value: t }) : o[r] = t;
var m = (o, r, t) => N(o, typeof r != "symbol" ? r + "" : r, t);
import { ipcMain as a, screen as D, BrowserWindow as x, desktopCapturer as q, shell as z, app as p, dialog as M, systemPreferences as I, nativeImage as B, Tray as $, Menu as G } from "electron";
import { fileURLToPath as A } from "node:url";
import c from "node:path";
import f from "node:fs/promises";
import { uIOhook as T } from "uiohook-napi";
const E = c.dirname(A(import.meta.url)), Y = c.join(E, ".."), v = process.env.VITE_DEV_SERVER_URL, F = c.join(Y, "dist");
let w = null;
a.on("hud-overlay-hide", () => {
  w && !w.isDestroyed() && w.minimize();
});
function X() {
  const o = D.getPrimaryDisplay(), { workArea: r } = o, t = 500, l = 100, u = Math.floor(r.x + (r.width - t) / 2), h = Math.floor(r.y + r.height - l - 5), e = new x({
    width: t,
    height: l,
    minWidth: 500,
    maxWidth: 500,
    minHeight: 100,
    maxHeight: 100,
    x: u,
    y: h,
    frame: !1,
    transparent: !0,
    resizable: !1,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    hasShadow: !1,
    webPreferences: {
      preload: c.join(E, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      backgroundThrottling: !1
    }
  });
  return e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), w = e, e.on("closed", () => {
    w === e && (w = null);
  }), v ? e.loadURL(v + "?windowType=hud-overlay") : e.loadFile(c.join(F, "index.html"), {
    query: { windowType: "hud-overlay" }
  }), e;
}
function Z() {
  const o = process.platform === "darwin", r = new x({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...o && {
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
      preload: c.join(E, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      webSecurity: !1,
      backgroundThrottling: !1
    }
  });
  return r.maximize(), r.webContents.on("did-finish-load", () => {
    r == null || r.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), v ? r.loadURL(v + "?windowType=editor") : r.loadFile(c.join(F, "index.html"), {
    query: { windowType: "editor" }
  }), r;
}
function J() {
  const { width: o, height: r } = D.getPrimaryDisplay().workAreaSize, t = new x({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((o - 620) / 2),
    y: Math.round((r - 420) / 2),
    frame: !1,
    resizable: !1,
    alwaysOnTop: !0,
    transparent: !0,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: c.join(E, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  return v ? t.loadURL(v + "?windowType=source-selector") : t.loadFile(c.join(F, "index.html"), {
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
      const l = Date.now();
      if (l - this.lastMoveTimestamp < this.THROTTLE_MS)
        return;
      this.lastMoveTimestamp = l;
      const u = this.normalizeCoordinates(t.x, t.y);
      this.events.push({
        type: "move",
        timestamp: l - this.config.recordingStartTime,
        x: t.x,
        y: t.y,
        normalizedX: u.x,
        normalizedY: u.y
      });
    }), T.on("click", (t) => {
      if (!this.isTracking) return;
      const l = Date.now(), u = this.normalizeCoordinates(t.x, t.y);
      this.events.push({
        type: "click",
        timestamp: l - this.config.recordingStartTime,
        x: t.x,
        y: t.y,
        normalizedX: u.x,
        normalizedY: u.y,
        button: typeof t.button == "number" ? t.button : void 0
      });
    }), T.on("wheel", (t) => {
      if (!this.isTracking) return;
      const l = Date.now(), u = this.normalizeCoordinates(t.x, t.y);
      this.events.push({
        type: "scroll",
        timestamp: l - this.config.recordingStartTime,
        x: t.x,
        y: t.y,
        normalizedX: u.x,
        normalizedY: u.y,
        scrollDelta: typeof t.rotation == "number" ? t.rotation : 0
      });
    });
    try {
      T.start();
    } catch (t) {
      throw console.error("Failed to start uIOhook (accessibility permissions may not be granted):", t), this.isTracking = !1, new Error("Failed to start mouse tracking. Please grant accessibility permissions in System Preferences.");
    }
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
    const l = D.getPrimaryDisplay(), { bounds: u } = l, h = Math.max(0, Math.min(1, (r - u.x) / u.width)), e = Math.max(0, Math.min(1, (t - u.y) / u.height));
    return { x: h, y: e };
  }
}
let R = null;
function _() {
  return R || (R = new Q()), R;
}
let P = null;
function K(o, r, t, l, u) {
  a.handle("get-sources", async (e, i) => (await q.getSources(i)).map((s) => ({
    id: s.id,
    name: s.name,
    display_id: s.display_id,
    thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : null,
    appIcon: s.appIcon ? s.appIcon.toDataURL() : null
  }))), a.handle("select-source", (e, i) => {
    P = i;
    const n = l();
    return n && n.close(), P;
  }), a.handle("get-selected-source", () => P), a.handle("open-source-selector", () => {
    const e = l();
    if (e) {
      e.focus();
      return;
    }
    r();
  }), a.handle("switch-to-editor", () => {
    const e = t();
    e && e.close(), o();
  }), a.handle("store-recorded-video", async (e, i, n) => {
    try {
      const s = c.join(g, n);
      return await f.writeFile(s, Buffer.from(i)), h = s, {
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
      const i = (await f.readdir(g)).filter((k) => k.endsWith(".webm"));
      if (i.length === 0)
        return { success: !1, message: "No recorded video found" };
      const n = i.sort().reverse()[0];
      return { success: !0, path: c.join(g, n) };
    } catch (e) {
      return console.error("Failed to get video path:", e), { success: !1, message: "Failed to get video path", error: String(e) };
    }
  }), a.handle("set-recording-state", (e, i) => {
    u && u(i, (P || { name: "Screen" }).name);
  }), a.handle("open-external-url", async (e, i) => {
    try {
      return await z.openExternal(i), { success: !0 };
    } catch (n) {
      return console.error("Failed to open URL:", n), { success: !1, error: String(n) };
    }
  }), a.handle("get-asset-base-path", () => {
    try {
      return p.isPackaged ? c.join(process.resourcesPath, "assets") : c.join(p.getAppPath(), "public", "assets");
    } catch (e) {
      return console.error("Failed to resolve asset base path:", e), null;
    }
  }), a.handle("save-exported-video", async (e, i, n) => {
    try {
      const s = n.toLowerCase().endsWith(".gif"), k = s ? [{ name: "GIF Image", extensions: ["gif"] }] : [{ name: "MP4 Video", extensions: ["mp4"] }], S = await M.showSaveDialog({
        title: s ? "Save Exported GIF" : "Save Exported Video",
        defaultPath: c.join(p.getPath("downloads"), n),
        filters: k,
        properties: ["createDirectory", "showOverwriteConfirmation"]
      });
      return S.canceled || !S.filePath ? {
        success: !1,
        cancelled: !0,
        message: "Export cancelled"
      } : (await f.writeFile(S.filePath, Buffer.from(i)), {
        success: !0,
        path: S.filePath,
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
      const e = await M.showOpenDialog({
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
  let h = null;
  a.handle("set-current-video-path", (e, i) => (h = i, { success: !0 })), a.handle("get-current-video-path", () => h ? { success: !0, path: h } : { success: !1 }), a.handle("clear-current-video-path", () => (h = null, { success: !0 })), a.handle("get-platform", () => process.platform), a.handle("start-mouse-tracking", (e, i) => {
    try {
      return _().start(i), { success: !0 };
    } catch (n) {
      return console.error("Failed to start mouse tracking:", n), { success: !1, error: String(n) };
    }
  }), a.handle("stop-mouse-tracking", () => {
    try {
      return { success: !0, events: _().stop() };
    } catch (e) {
      return console.error("Failed to stop mouse tracking:", e), { success: !1, error: String(e), events: [] };
    }
  }), a.handle("get-cursor-events", () => {
    try {
      return { success: !0, events: _().getEvents() };
    } catch (e) {
      return console.error("Failed to get cursor events:", e), { success: !1, error: String(e), events: [] };
    }
  }), a.handle("store-cursor-events", async (e, i, n) => {
    try {
      const s = n.replace(/\.(webm|mp4)$/i, "-cursor-events.json");
      return await f.writeFile(s, JSON.stringify(i, null, 2)), { success: !0, path: s };
    } catch (s) {
      return console.error("Failed to store cursor events:", s), { success: !1, error: String(s) };
    }
  }), a.handle("load-cursor-events", async (e, i) => {
    try {
      const n = i.replace(/\.(webm|mp4)$/i, "-cursor-events.json"), s = await f.readFile(n, "utf-8");
      return { success: !0, events: JSON.parse(s) };
    } catch (n) {
      return n.code === "ENOENT" ? { success: !0, events: [] } : (console.error("Failed to load cursor events:", n), { success: !1, error: String(n), events: [] });
    }
  }), a.handle("check-accessibility-permissions", () => {
    if (process.platform !== "darwin")
      return { success: !0, granted: !0 };
    try {
      return { success: !0, granted: I.isTrustedAccessibilityClient(!1) };
    } catch (e) {
      return console.error("Failed to check accessibility permissions:", e), { success: !1, granted: !1, error: String(e) };
    }
  });
}
const ee = c.dirname(A(import.meta.url)), g = c.join(p.getPath("userData"), "recordings");
async function te() {
  try {
    await f.mkdir(g, { recursive: !0 }), console.log("RECORDINGS_DIR:", g), console.log("User Data Path:", p.getPath("userData"));
  } catch (o) {
    console.error("Failed to create recordings directory:", o);
  }
}
async function re() {
  if (process.platform !== "darwin")
    return !0;
  try {
    if (!I.isTrustedAccessibilityClient(!1)) {
      console.log("Accessibility permissions not granted. Prompting user...");
      const r = I.isTrustedAccessibilityClient(!0);
      if (!r) {
        console.log("User needs to grant accessibility permissions in System Preferences");
        const { dialog: t } = await import("electron");
        return (await t.showMessageBox({
          type: "info",
          title: "Accessibility Permission Required",
          message: "OpenScreen needs accessibility permissions to enable Auto-Zoom features.",
          detail: `To use Auto-Zoom cursor tracking:

1. Click "Open System Preferences"
2. Grant accessibility permission to OpenScreen
3. Restart the app

You can still use OpenScreen without this permission, but Auto-Zoom will be unavailable.`,
          buttons: ["Open System Preferences", "Continue Without Auto-Zoom"],
          defaultId: 0,
          cancelId: 1
        })).response === 0 && await z.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"), !1;
      }
      return r;
    }
    return console.log("Accessibility permissions already granted"), !0;
  } catch (o) {
    return console.error("Error checking accessibility permissions:", o), !1;
  }
}
process.env.APP_ROOT = c.join(ee, "..");
const se = process.env.VITE_DEV_SERVER_URL, he = c.join(process.env.APP_ROOT, "dist-electron"), V = c.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = se ? c.join(process.env.APP_ROOT, "public") : V;
let d = null, b = null, y = null, W = "";
const L = U("openscreen.png"), oe = U("rec-button.png");
function O() {
  d = X();
}
function j() {
  y = new $(L);
}
function U(o) {
  return B.createFromPath(c.join(process.env.VITE_PUBLIC || V, o)).resize({
    width: 24,
    height: 24,
    quality: "best"
  });
}
function C(o = !1) {
  if (!y) return;
  const r = o ? oe : L, t = o ? `Recording: ${W}` : "OpenScreen", l = o ? [
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
        d && !d.isDestroyed() ? d.isMinimized() && d.restore() : O();
      }
    },
    {
      label: "Quit",
      click: () => {
        p.quit();
      }
    }
  ];
  y.setImage(r), y.setToolTip(t), y.setContextMenu(G.buildFromTemplate(l));
}
function ne() {
  d && (d.close(), d = null), d = Z();
}
function ie() {
  return b = J(), b.on("closed", () => {
    b = null;
  }), b;
}
p.on("window-all-closed", () => {
});
p.on("activate", () => {
  x.getAllWindows().length === 0 && O();
});
p.whenReady().then(async () => {
  const { ipcMain: o } = await import("electron");
  o.on("hud-overlay-close", () => {
    p.quit();
  }), j(), C(), await te(), await re(), K(
    ne,
    ie,
    () => d,
    () => b,
    (r, t) => {
      W = t, y || j(), C(r), r || d && d.restore();
    }
  ), O();
});
export {
  he as MAIN_DIST,
  g as RECORDINGS_DIR,
  V as RENDERER_DIST,
  se as VITE_DEV_SERVER_URL
};
