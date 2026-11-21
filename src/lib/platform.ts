import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { FilePayload, WorkspaceSnapshot } from "../types";

export const isTauriRuntime =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const SESSION_KEY = "simple-editor.workspace.v1";

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

  return save({
    defaultPath: suggestedName,
    filters: [
      { name: "Markdown", extensions: ["md"] },
      { name: "Text", extensions: ["txt"] },
      { name: "All files", extensions: ["*"] },
    ],
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
  if (!isTauriRuntime) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
    return;
  }

  await invoke("save_session", {
    content: JSON.stringify(snapshot),
  });
}

export async function restoreWorkspace(): Promise<WorkspaceSnapshot | null> {
  try {
    const raw = isTauriRuntime
      ? await invoke<string | null>("load_session")
      : localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const snapshot = JSON.parse(raw) as WorkspaceSnapshot;
    return snapshot.version === 1 ? snapshot : null;
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

