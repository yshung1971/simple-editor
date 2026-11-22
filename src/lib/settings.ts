import type {
  BehaviorSettings,
  EditorSettings,
  InstanceMode,
  PreviewSettings,
  ThemeMode,
  UiLanguage,
  UserSettings,
  WindowSettings,
} from "../types";

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontFamily: "Cascadia Code",
  fontSize: 14.5,
  lineHeight: 1.65,
  tabSize: 2,
  wordWrap: false,
};

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  fontFamily: "Charter, Georgia, serif",
  fontSize: 16,
  maxWidth: 780,
};

export const DEFAULT_BEHAVIOR_SETTINGS: BehaviorSettings = {
  restoreUnsavedTabs: true,
  confirmOnClose: true,
  instanceMode: "multi",
};

export const DEFAULT_WINDOW_SETTINGS: WindowSettings = {
  width: 1200,
  height: 800,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function fontFamily(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim().slice(0, 240);
  return trimmed || fallback;
}

function record(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function createDefaultUserSettings(
  themeMode: ThemeMode,
): UserSettings {
  return {
    version: 5,
    uiLanguage: "en",
    themeMode,
    previewVisible: true,
    splitPercent: 0.5,
    zoomLevel: 1,
    editor: { ...DEFAULT_EDITOR_SETTINGS },
    preview: { ...DEFAULT_PREVIEW_SETTINGS },
    behavior: { ...DEFAULT_BEHAVIOR_SETTINGS },
    window: { ...DEFAULT_WINDOW_SETTINGS },
  };
}

export function normalizeUserSettings(value: unknown): UserSettings {
  const root = record(value);
  const editor = record(root.editor);
  const preview = record(root.preview);
  const behavior = record(root.behavior);
  const windowSettings = record(root.window);
  const themeMode: ThemeMode =
    root.themeMode === "light" || root.themeMode === "dark"
      ? root.themeMode
      : "dark";
  const uiLanguage: UiLanguage =
    root.uiLanguage === "zh-TW" ? "zh-TW" : "en";
  const instanceMode: InstanceMode =
    behavior.instanceMode === "single" ? "single" : "multi";

  return {
    version: 5,
    uiLanguage,
    themeMode,
    previewVisible: booleanValue(root.previewVisible, true),
    splitPercent: clamp(finiteNumber(root.splitPercent, 0.5), 0.25, 0.75),
    zoomLevel: clamp(finiteNumber(root.zoomLevel, 1), 0.5, 2),
    editor: {
      fontFamily: fontFamily(
        editor.fontFamily,
        DEFAULT_EDITOR_SETTINGS.fontFamily,
      ),
      fontSize: clamp(
        finiteNumber(editor.fontSize, DEFAULT_EDITOR_SETTINGS.fontSize),
        10,
        32,
      ),
      lineHeight: clamp(
        finiteNumber(editor.lineHeight, DEFAULT_EDITOR_SETTINGS.lineHeight),
        1.1,
        2.4,
      ),
      tabSize: Math.round(
        clamp(
          finiteNumber(editor.tabSize, DEFAULT_EDITOR_SETTINGS.tabSize),
          1,
          8,
        ),
      ),
      wordWrap: booleanValue(
        editor.wordWrap,
        DEFAULT_EDITOR_SETTINGS.wordWrap,
      ),
    },
    preview: {
      fontFamily: fontFamily(
        preview.fontFamily,
        DEFAULT_PREVIEW_SETTINGS.fontFamily,
      ),
      fontSize: clamp(
        finiteNumber(preview.fontSize, DEFAULT_PREVIEW_SETTINGS.fontSize),
        10,
        32,
      ),
      maxWidth: clamp(
        finiteNumber(preview.maxWidth, DEFAULT_PREVIEW_SETTINGS.maxWidth),
        420,
        1600,
      ),
    },
    behavior: {
      restoreUnsavedTabs: booleanValue(
        behavior.restoreUnsavedTabs,
        DEFAULT_BEHAVIOR_SETTINGS.restoreUnsavedTabs,
      ),
      confirmOnClose: booleanValue(
        behavior.confirmOnClose,
        DEFAULT_BEHAVIOR_SETTINGS.confirmOnClose,
      ),
      instanceMode,
    },
    window: {
      width: Math.round(
        clamp(
          finiteNumber(
            windowSettings.width,
            DEFAULT_WINDOW_SETTINGS.width,
          ),
          640,
          10000,
        ),
      ),
      height: Math.round(
        clamp(
          finiteNumber(
            windowSettings.height,
            DEFAULT_WINDOW_SETTINGS.height,
          ),
          480,
          10000,
        ),
      ),
    },
  };
}

export function parseUserSettings(content: string): UserSettings {
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("settings.json must contain a JSON object");
  }
  return normalizeUserSettings(parsed);
}

export function serializeUserSettings(settings: UserSettings) {
  const normalized = normalizeUserSettings(settings);
  return `${JSON.stringify(normalized, null, 2)}\n`;
}
