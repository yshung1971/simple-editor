import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  FilePayload,
  UserSettings,
  WorkspaceSnapshot,
} from "../types";
import {
  parseUserSettings,
  serializeUserSettings,
} from "./settings";

export const isTauriRuntime =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const SESSION_KEY = "simple-editor.workspace.v1";
const SETTINGS_KEY = "simple-editor.settings.v1";

function fileName(path: string) {
  const normalized = path.replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1) || "untitled";
}

function browserFilePayload(file: File, content: string): FilePayload {
  return {
    path: file.name,
    name: fileName(file.name),
    content,
  };
}

function pickBrowserFile(): Promise<FilePayload | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.markdown,.log,.json,.js,.jsx,.ts,.tsx,.css,.html,.py,.rs,.cpp,.c,.h,.hpp,.yaml,.yml,.sql,.sh,.bash,.ps1";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve(browserFilePayload(file, await file.text()));
    };
    input.click();
  });
}

export async function chooseTextFile(): Promise<FilePayload | null> {
  if (!isTauriRuntime) {
    return pickBrowserFile();
  }

  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Text files",
        extensions: [
          "txt",
          "md",
          "markdown",
          "log",
          "json",
          "js",
          "jsx",
          "ts",
          "tsx",
          "css",
          "html",
          "py",
          "rs",
          "cpp",
          "c",
          "h",
          "hpp",
          "yaml",
          "yml",
          "sql",
          "sh",
          "bash",
          "ps1",
        ],
      },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }
  return invoke<FilePayload>("read_text_file", { path: selected });
}

export async function readFile(path: string): Promise<FilePayload> {
  if (!isTauriRuntime) {
    return {
      path,
      name: fileName(path),
      content: "",
    };
  }
  return invoke<FilePayload>("read_text_file", { path });
}

export async function chooseSavePath(
  suggestedName: string,
): Promise<string | null> {
  if (!isTauriRuntime) {
    return suggestedName;
  }

  const lowerName = suggestedName.toLowerCase();
  const allFiles = { name: "All files", extensions: ["*"] };
  const textFiles = { name: "Text", extensions: ["txt", "log"] };
  const markdownFiles = { name: "Markdown", extensions: ["md", "markdown"] };
  const filters =
    lowerName.endsWith(".md") || lowerName.endsWith(".markdown")
      ? [markdownFiles, textFiles, allFiles]
      : lowerName.endsWith(".txt") || lowerName.endsWith(".log")
        ? [textFiles, markdownFiles, allFiles]
        : [allFiles, textFiles, markdownFiles];

  return save({
    defaultPath: suggestedName,
    filters,
  });
}

export async function writeFile(path: string, content: string) {
  if (!isTauriRuntime) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName(path);
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  await invoke("write_text_file", { path, content });
}

export async function loadStartupFiles(): Promise<string[]> {
  if (!isTauriRuntime) {
    return [];
  }
  return invoke<string[]>("startup_files");
}

export async function persistWorkspace(snapshot: WorkspaceSnapshot) {
  cacheWorkspace(snapshot);

  if (!isTauriRuntime) {
    return;
  }
  await invoke("save_session", {
    content: JSON.stringify(snapshot),
  });
}

export async function persistSettings(settings: UserSettings) {
  const content = serializeUserSettings(settings);
  localStorage.setItem(SETTINGS_KEY, content);

  if (!isTauriRuntime) {
    return;
  }
  await invoke("save_settings", {
    content,
  });
}

export async function restoreSettings(): Promise<UserSettings | null> {
  const localRaw = localStorage.getItem(SETTINGS_KEY);
  const nativeRaw = isTauriRuntime
    ? await invoke<string | null>("load_settings").catch(() => null)
    : null;

  for (const content of [nativeRaw, localRaw]) {
    if (!content) {
      continue;
    }
    try {
      return parseUserSettings(content);
    } catch {
      // Try the next settings source when one file is temporarily invalid.
    }
  }
  return null;
}

export async function prepareSettingsFile(
  defaultContent: string,
): Promise<FilePayload> {
  if (!isTauriRuntime) {
    return {
      path: "settings.json",
      name: "settings.json",
      content: defaultContent,
    };
  }
  return invoke<FilePayload>("prepare_settings_file", {
    content: defaultContent,
  });
}

export async function renameFile(
  path: string,
  newName: string,
): Promise<string> {
  if (!isTauriRuntime) {
    return newName;
  }
  return invoke<string>("rename_text_file", { path, newName });
}

export async function revealFile(path: string) {
  if (!isTauriRuntime) {
    throw new Error("Opening the containing folder is only available in the desktop app");
  }
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}

export async function copyText(content: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function cacheWorkspace(snapshot: WorkspaceSnapshot) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
}

export async function restoreWorkspace(): Promise<WorkspaceSnapshot | null> {
  try {
    const localRaw = localStorage.getItem(SESSION_KEY);
    const nativeRaw = isTauriRuntime
      ? await invoke<string | null>("load_session")
      : null;
    const candidates = [localRaw, nativeRaw]
      .filter((value): value is string => Boolean(value))
      .map((value) => JSON.parse(value) as WorkspaceSnapshot)
      .filter((value) => value.version === 1);

    if (candidates.length === 0) {
      return null;
    }
    return candidates.sort(
      (left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0),
    )[0];
  } catch {
    return null;
  }
}

export async function setWindowTitle(title: string) {
  if (!isTauriRuntime) {
    document.title = title;
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title);
}

export async function minimizeWindow() {
  if (!isTauriRuntime) {
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}

export async function toggleMaximizeWindow() {
  if (!isTauriRuntime) {
    return false;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const windowHandle = getCurrentWindow();
  await windowHandle.toggleMaximize();
  return windowHandle.isMaximized();
}

export async function closeAppWindow() {
  if (!isTauriRuntime) {
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

export async function listenForWindowMaximized(
  callback: (maximized: boolean) => void,
): Promise<() => void> {
  if (!isTauriRuntime) {
    return () => undefined;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const windowHandle = getCurrentWindow();
  const emitState = async () => {
    callback(await windowHandle.isMaximized());
  };
  const unlisten = await windowHandle.onResized(() => {
    void emitState();
  });
  await emitState();
  return unlisten;
}

export async function setWebviewZoom(scaleFactor: number) {
  if (!isTauriRuntime) {
    document.documentElement.style.setProperty(
      "--app-zoom",
      String(scaleFactor),
    );
    document.documentElement.style.setProperty(
      "--app-zoom-size",
      `${100 / scaleFactor}%`,
    );
    return;
  }

  document.documentElement.style.setProperty("--app-zoom", "1");
  document.documentElement.style.setProperty("--app-zoom-size", "100%");
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  await getCurrentWebview().setZoom(scaleFactor);
}

export async function listenForFileDrops(
  callback: (paths: string[]) => void,
): Promise<() => void> {
  if (!isTauriRuntime) {
    return () => undefined;
  }

  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      callback(event.payload.paths);
    }
  });
}

export async function openExternalUrl(url: string) {
  if (!isTauriRuntime) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}

