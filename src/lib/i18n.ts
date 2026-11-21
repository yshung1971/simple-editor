import type { UiLanguage } from "../types";

export type AppText = {
  menuButton: string;
  openApplicationMenu: string;
  applicationMenu: string;
  openFile: string;
  newFile: string;
  save: string;
  settings: string;
  exit: string;
  useLightTheme: string;
  useDarkTheme: string;
  scrollTabsLeft: string;
  scrollTabsRight: string;
  openFiles: string;
  dragToReorder: string;
  middleClickToClose: string;
  showPreview: string;
  hidePreview: string;
  showMarkdownPreview: string;
  hideMarkdownPreview: string;
  minimize: string;
  minimizeWindow: string;
  maximize: string;
  restore: string;
  maximizeWindow: string;
  restoreWindow: string;
  close: string;
  closeWindow: string;
  editor: string;
  preview: string;
  resizeEditorPreview: string;
  resizeEditorPreviewHelp: string;
  emptyTitle: string;
  emptyDescription: string;
  notSavedYet: string;
  line: string;
  column: string;
  tabActions: string;
  closeTab: string;
  closeOtherTabs: string;
  closeTabsRight: string;
  closeSavedTabs: string;
  copyFullPath: string;
  openContainingFolder: string;
  rename: string;
  closeWithoutSaving: string;
  closeWithoutSavingAction: string;
  closeTabsWithoutSaving: string;
  hasUnsavedChanges: string;
  unsavedTabCount: (count: number) => string;
  cancelClose: string;
  cancel: string;
  loading: string;
};

const EN_TEXT: AppText = {
  menuButton: "Menu",
  openApplicationMenu: "Open application menu",
  applicationMenu: "Application menu",
  openFile: "Open file",
  newFile: "New file",
  save: "Save",
  settings: "Settings",
  exit: "Exit",
  useLightTheme: "Use light theme",
  useDarkTheme: "Use dark theme",
  scrollTabsLeft: "Scroll tabs left",
  scrollTabsRight: "Scroll tabs right",
  openFiles: "Open files",
  dragToReorder: "drag to reorder",
  middleClickToClose: "middle-click to close",
  showPreview: "Show preview",
  hidePreview: "Hide preview",
  showMarkdownPreview: "Show markdown preview",
  hideMarkdownPreview: "Hide markdown preview",
  minimize: "Minimize",
  minimizeWindow: "Minimize window",
  maximize: "Maximize",
  restore: "Restore",
  maximizeWindow: "Maximize window",
  restoreWindow: "Restore window",
  close: "Close",
  closeWindow: "Close window",
  editor: "Editor",
  preview: "Preview",
  resizeEditorPreview: "Resize editor and preview",
  resizeEditorPreviewHelp: "Drag to resize. Double-click to reset.",
  emptyTitle: "Open a text file",
  emptyDescription: "Start with an existing document or create a blank one.",
  notSavedYet: "Not saved yet",
  line: "Ln",
  column: "Col",
  tabActions: "Tab actions",
  closeTab: "Close",
  closeOtherTabs: "Close Other Tabs",
  closeTabsRight: "Close Tabs to the Right",
  closeSavedTabs: "Close Saved Tabs",
  copyFullPath: "Copy Full Path",
  openContainingFolder: "Open Containing Folder",
  rename: "Rename",
  closeWithoutSaving: "Close without saving?",
  closeWithoutSavingAction: "Close without saving",
  closeTabsWithoutSaving: "Close tabs without saving?",
  hasUnsavedChanges: "has unsaved changes.",
  unsavedTabCount: (count) =>
    count === 1
      ? "1 tab has unsaved changes."
      : `${count} tabs have unsaved changes.`,
  cancelClose: "Cancel close",
  cancel: "Cancel",
  loading: "Opening editor...",
};

const ZH_TW_TEXT: AppText = {
  menuButton: "選單",
  openApplicationMenu: "開啟應用程式選單",
  applicationMenu: "應用程式選單",
  openFile: "開啟檔案",
  newFile: "新增檔案",
  save: "儲存",
  settings: "設定",
  exit: "結束",
  useLightTheme: "使用淺色主題",
  useDarkTheme: "使用深色主題",
  scrollTabsLeft: "向左捲動分頁",
  scrollTabsRight: "向右捲動分頁",
  openFiles: "已開啟檔案",
  dragToReorder: "拖曳可重新排序",
  middleClickToClose: "滑鼠中鍵可關閉",
  showPreview: "顯示預覽",
  hidePreview: "隱藏預覽",
  showMarkdownPreview: "顯示 Markdown 預覽",
  hideMarkdownPreview: "隱藏 Markdown 預覽",
  minimize: "最小化",
  minimizeWindow: "最小化視窗",
  maximize: "最大化",
  restore: "還原",
  maximizeWindow: "最大化視窗",
  restoreWindow: "還原視窗",
  close: "關閉",
  closeWindow: "關閉視窗",
  editor: "編輯器",
  preview: "預覽",
  resizeEditorPreview: "調整編輯器與預覽大小",
  resizeEditorPreviewHelp: "拖曳調整大小，按兩下重設。",
  emptyTitle: "開啟文字檔",
  emptyDescription: "開啟既有文件，或建立空白檔案。",
  notSavedYet: "尚未儲存",
  line: "行",
  column: "欄",
  tabActions: "分頁操作",
  closeTab: "關閉",
  closeOtherTabs: "關閉其它索引標籤",
  closeTabsRight: "關閉右邊的項目",
  closeSavedTabs: "關閉已儲存的項目",
  copyFullPath: "複製完整路徑",
  openContainingFolder: "開啟檔案所在之資料夾",
  rename: "重新命名",
  closeWithoutSaving: "要在未儲存的情況下關閉嗎？",
  closeWithoutSavingAction: "不儲存並關閉",
  closeTabsWithoutSaving: "要在未儲存的情況下關閉分頁嗎？",
  hasUnsavedChanges: "有未儲存的變更。",
  unsavedTabCount: (count) =>
    `${count} 個分頁有未儲存的變更。`,
  cancelClose: "取消關閉",
  cancel: "取消",
  loading: "正在開啟編輯器...",
};

export function appText(uiLanguage: UiLanguage): AppText {
  return uiLanguage === "zh-TW" ? ZH_TW_TEXT : EN_TEXT;
}
