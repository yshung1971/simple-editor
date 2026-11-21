export type ThemeMode = "light" | "dark";

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

export type UserSettings = {
  version: 1;
  updatedAt: number;
  themeMode: ThemeMode;
  previewVisible: boolean;
  splitPercent: number;
  zoomLevel: number;
};

export type FilePayload = {
  path: string;
  name: string;
  content: string;
};

