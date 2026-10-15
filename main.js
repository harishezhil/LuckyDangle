const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain } = require("electron");
const path = require("path");

const WINDOW_WIDTH = 600;
const WINDOW_HEIGHT = 900;
const MARGIN_RIGHT = 0;

// Must be in the same order as the list in src/charms.js
const CHARM_NAMES = ["Evil eye", "Hamsa", "Chili and lemon", "Oni mask", "Lucky cat", "Bell", "Spider-Man (cartoon)", "Spidey (chibi)"];

let win = null;
let tray = null;
let currentCharm = 0;

function createWindow() {
  const screenBounds = screen.getPrimaryDisplay().bounds;

  win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: screenBounds.x + screenBounds.width - WINDOW_WIDTH - MARGIN_RIGHT,
    y: screenBounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Show on every desktop, including over full-screen apps and full-screen browser tabs.
  // The order matters: "all workspaces" first, then the window level.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "screen-saver");

  // Start click-through; the page turns clicks on only while the mouse is over the charm
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "src", "index.html"));
}

function chooseCharm(index) {
  currentCharm = index;
  if (win) win.webContents.send("set-charm", index);
  buildMenu();
}

function toggleCharm() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else win.showInactive();
  buildMenu();
}

function buildMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: win && win.isVisible() ? "Hide charm" : "Show charm",
      click: toggleCharm,
    },
    { type: "separator" },
    ...CHARM_NAMES.map((name, i) => ({
      label: name,
      type: "radio",
      checked: i === currentCharm,
      click: () => chooseCharm(i),
    })),
    { type: "separator" },
    { label: "Quit Lucky Dangle", role: "quit" },
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "build", "tray.png"));
  tray = new Tray(icon);
  if (icon.isEmpty()) tray.setTitle("🍀"); // fallback if the icon file is missing
  tray.setToolTip("Lucky Dangle");
  buildMenu();
}

ipcMain.on("set-clickable", (_event, clickable) => {
  if (!win) return;
  if (clickable) win.setIgnoreMouseEvents(false);
  else win.setIgnoreMouseEvents(true, { forward: true });
});

app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock.hide(); // no Dock icon; the app lives in the menu bar
  createWindow();
  createTray();
});

// Keep running in the menu bar even if the window is closed
app.on("window-all-closed", (event) => event.preventDefault());