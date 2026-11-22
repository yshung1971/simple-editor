export type ThemeMode = "light" | "dark";
export type UiLanguage = "en" | "zh-TW";
export type InstanceMode = "single" | "multi";

export type EditorTab = {
  id: string;
  path: string | null;
  name: string;
  content: string;
  savedContent: string;
  cursor: number;
  scrollTop: number;
};

export type WorkspaceSnapshot = {
  version: 1;
  updatedAt: number;
  tabs: EditorTab[];
  activeTabId: string | null;
  themeMode: ThemeMode;
  previewVisible: boolean;
  splitPercent?: number;
  zoomLevel?: number;
};

export type EditorSettings = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  tabSize: number;
  wordWrap: boolean;
};

export type PreviewSettings = {
  fontFamily: string;
  fontSize: number;
  maxWidth: number;
};

export type BehaviorSettings = {
  restoreUnsavedTabs: boolean;
  confirmOnClose: boolean;
  instanceMode: InstanceMode;
};

export type WindowSettings = {
  width: number;
  height: number;
};

export type UserSettings = {
  version: 5;
  uiLanguage: UiLanguage;
  themeMode: ThemeMode;
  previewVisible: boolean;
  splitPercent: number;
  zoomLevel: number;
  editor: EditorSettings;
  preview: PreviewSettings;
  behavior: BehaviorSettings;
  window: WindowSettings;
};

export type FilePayload = {
  path: string;
  name: string;
  content: string;
};

