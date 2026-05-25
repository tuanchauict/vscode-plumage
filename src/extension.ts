import * as vscode from "vscode";

const COLOR_CUSTOMIZATIONS = "workbench.colorCustomizations";
const MANAGED_KEYS = [
  "titleBar.activeBackground",
  "titleBar.activeForeground",
  "titleBar.inactiveBackground",
  "titleBar.inactiveForeground",
  "titleBar.border",
  "activityBar.background",
  "activityBar.foreground",
  "activityBar.inactiveForeground",
  "activityBar.activeBorder",
  "activityBar.activeBackground",
  "activityBarBadge.background",
  "activityBarBadge.foreground",
  "sideBar.background",
  "sideBar.foreground",
  "sideBar.border",
  "sideBarTitle.foreground",
  "sideBarSectionHeader.background",
  "sideBarSectionHeader.foreground",
  "statusBar.background",
  "statusBar.foreground",
  "statusBar.border",
  "statusBar.noFolderBackground",
  "statusBarItem.hoverBackground",
  "statusBarItem.remoteBackground",
  "statusBarItem.remoteForeground",
];

export function activate(context: vscode.ExtensionContext) {
  const apply = () => applyColors().catch((e) => console.error("[Plumage]", e));

  apply();

  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(apply),
    vscode.workspace.onDidChangeWorkspaceFolders(apply),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("plumage.enabled") ||
        e.affectsConfiguration("plumage.hueOffset")
      ) {
        apply();
      }
    }),
    vscode.commands.registerCommand("plumage.refresh", apply),
    vscode.commands.registerCommand("plumage.clear", clearColors),
    vscode.commands.registerCommand("plumage.shuffle", shuffleColor),
    vscode.commands.registerCommand("plumage.pick", pickColor),
  );
}

export function deactivate() {}

async function applyColors() {
  const cfg = vscode.workspace.getConfiguration("plumage");
  if (!cfg.get<boolean>("enabled", true)) {
    await clearColors();
    return;
  }

  const seed = getWorkspaceSeed();
  if (!seed) return;

  const offset = cfg.get<number>("hueOffset") ?? 0;
  const accent = pickAccent(seed, offset);
  const isDark = isDarkTheme();
  const palette = buildPalette(accent.hue, isDark);

  const colorCfg = vscode.workspace.getConfiguration();
  const existing = colorCfg.get<Record<string, string>>(COLOR_CUSTOMIZATIONS) ?? {};
  const next: Record<string, string> = { ...existing, ...palette };

  if (shallowEqual(existing, next)) return;
  await colorCfg.update(COLOR_CUSTOMIZATIONS, next, vscode.ConfigurationTarget.Workspace);
}

async function clearColors() {
  const colorCfg = vscode.workspace.getConfiguration();
  const existing = colorCfg.get<Record<string, string>>(COLOR_CUSTOMIZATIONS);
  if (!existing) return;
  const next: Record<string, string> = { ...existing };
  for (const key of MANAGED_KEYS) delete next[key];
  const value = Object.keys(next).length === 0 ? undefined : next;
  await colorCfg.update(COLOR_CUSTOMIZATIONS, value, vscode.ConfigurationTarget.Workspace);
}

function getWorkspaceSeed(): string | undefined {
  const wsFile = vscode.workspace.workspaceFile;
  if (wsFile && wsFile.scheme === "file") return wsFile.fsPath;
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) return folders[0].uri.fsPath;
  return undefined;
}

function isDarkTheme(): boolean {
  const kind = vscode.window.activeColorTheme.kind;
  return (
    kind === vscode.ColorThemeKind.Dark ||
    kind === vscode.ColorThemeKind.HighContrast
  );
}

// Hand-picked hues that look good as backgrounds in both dark and light themes.
// Yellow/amber/olive bands are omitted because they become muddy brown when dark.
interface Accent {
  name: string;
  hue: number;
}
const ACCENTS: readonly Accent[] = [
  { name: "red", hue: 355 },
  { name: "orange", hue: 18 },
  { name: "lime", hue: 80 },
  { name: "green", hue: 140 },
  { name: "emerald", hue: 165 },
  { name: "teal", hue: 178 },
  { name: "cyan", hue: 192 },
  { name: "sky", hue: 205 },
  { name: "blue", hue: 220 },
  { name: "indigo", hue: 240 },
  { name: "violet", hue: 262 },
  { name: "purple", hue: 282 },
  { name: "magenta", hue: 305 },
  { name: "pink", hue: 332 },
];

function pickAccent(input: string, offset: number): Accent {
  const n = ACCENTS.length;
  const idx = ((fnv1a(input) + Math.trunc(offset)) % n + n) % n;
  return ACCENTS[idx];
}

async function shuffleColor() {
  const cfg = vscode.workspace.getConfiguration("plumage");
  const seed = getWorkspaceSeed();
  if (!seed) {
    vscode.window.showWarningMessage("Plumage: no folder open.");
    return;
  }
  const current = cfg.get<number>("hueOffset") ?? 0;
  const next = current + 1;
  await cfg.update("hueOffset", next, vscode.ConfigurationTarget.Workspace);
  const accent = pickAccent(seed, next);
  vscode.window.setStatusBarMessage(`Plumage: ${accent.name}`, 2500);
}

async function pickColor() {
  const seed = getWorkspaceSeed();
  if (!seed) {
    vscode.window.showWarningMessage("Plumage: no folder open.");
    return;
  }
  const baseIdx = ((fnv1a(seed) % ACCENTS.length) + ACCENTS.length) % ACCENTS.length;
  const items = ACCENTS.map((a, i) => ({
    label: a.name,
    description: i === baseIdx ? "(default for this folder)" : undefined,
    offset: (i - baseIdx + ACCENTS.length) % ACCENTS.length,
  }));
  const choice = await vscode.window.showQuickPick(items, {
    placeHolder: "Pick a color for this workspace",
  });
  if (!choice) return;
  const cfg = vscode.workspace.getConfiguration("plumage");
  await cfg.update("hueOffset", choice.offset, vscode.ConfigurationTarget.Workspace);
}

function buildPalette(hue: number, isDark: boolean): Record<string, string> {
  if (isDark) {
    // Bars: saturated enough to read as a hue, dark enough to feel like a chrome strip.
    const barBg = hsl(hue, 0.42, 0.30);
    const barBgInactive = hsl(hue, 0.34, 0.24);
    const barBgHover = hsl(hue, 0.45, 0.36);
    // Sidebar: barely-there tint of the editor background (~#1e1e1e).
    const sideBg = hsl(hue, 0.18, 0.15);
    const sideSection = hsl(hue, 0.22, 0.19);
    const sideBorder = hsl(hue, 0.30, 0.24);
    const fg = "#ffffff";
    const fgDim = "#c8c8c8";
    const accent = hsl(hue, 0.70, 0.62);
    return {
      "titleBar.activeBackground": barBg,
      "titleBar.activeForeground": fg,
      "titleBar.inactiveBackground": barBgInactive,
      "titleBar.inactiveForeground": fgDim,
      "titleBar.border": barBgHover,
      "activityBar.background": barBg,
      "activityBar.foreground": fg,
      "activityBar.inactiveForeground": fgDim,
      "activityBar.activeBorder": accent,
      "activityBar.activeBackground": barBgHover,
      "activityBarBadge.background": accent,
      "activityBarBadge.foreground": "#1e1e1e",
      "sideBar.background": sideBg,
      "sideBar.foreground": "#cccccc",
      "sideBar.border": sideBorder,
      "sideBarTitle.foreground": fg,
      "sideBarSectionHeader.background": sideSection,
      "sideBarSectionHeader.foreground": fg,
      "statusBar.background": barBg,
      "statusBar.foreground": fg,
      "statusBar.border": barBgHover,
      "statusBar.noFolderBackground": barBgInactive,
      "statusBarItem.hoverBackground": barBgHover,
      "statusBarItem.remoteBackground": barBgHover,
      "statusBarItem.remoteForeground": fg,
    };
  }

  const barBg = hsl(hue, 0.55, 0.74);
  const barBgInactive = hsl(hue, 0.45, 0.82);
  const barBgHover = hsl(hue, 0.60, 0.66);
  const sideBg = hsl(hue, 0.40, 0.96);
  const sideSection = hsl(hue, 0.45, 0.90);
  const sideBorder = hsl(hue, 0.40, 0.82);
  const fg = "#1e1e1e";
  const fgDim = "#4a4a4a";
  const accent = hsl(hue, 0.70, 0.40);
  return {
    "titleBar.activeBackground": barBg,
    "titleBar.activeForeground": fg,
    "titleBar.inactiveBackground": barBgInactive,
    "titleBar.inactiveForeground": fgDim,
    "titleBar.border": barBgHover,
    "activityBar.background": barBg,
    "activityBar.foreground": fg,
    "activityBar.inactiveForeground": fgDim,
    "activityBar.activeBorder": accent,
    "activityBar.activeBackground": barBgHover,
    "activityBarBadge.background": accent,
    "activityBarBadge.foreground": "#ffffff",
    "sideBar.background": sideBg,
    "sideBar.foreground": fg,
    "sideBar.border": sideBorder,
    "sideBarTitle.foreground": fg,
    "sideBarSectionHeader.background": sideSection,
    "sideBarSectionHeader.foreground": fg,
    "statusBar.background": barBg,
    "statusBar.foreground": fg,
    "statusBar.border": barBgHover,
    "statusBar.noFolderBackground": barBgInactive,
    "statusBarItem.hoverBackground": barBgHover,
    "statusBarItem.remoteBackground": barBgHover,
    "statusBarItem.remoteForeground": fg,
  };
}

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hsl(hueDeg: number, sat: number, light: number): string {
  const h = ((hueDeg % 360) + 360) % 360 / 360;
  const s = clamp(sat, 0, 1);
  const l = clamp(light, 0, 1);
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function toHex(v: number): string {
  return Math.round(clamp(v, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0");
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function shallowEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}
