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
  tabs: EditorTab[];
  activeTabId: string | null;
  themeMode: ThemeMode;
  previewVisible: boolean;
};

export type FilePayload = {
  path: string;
  name: string;
  content: string;
};

