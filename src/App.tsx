import {
  Columns2,
  EyeOff,
  FilePlus2,
  FileText,
  FolderOpen,
  Moon,
  Save,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { EditorPane } from "./components/EditorPane";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { isMarkdownFile, languageLabel } from "./lib/languages";
import {
  cacheWorkspace,
  chooseSavePath,
  chooseTextFile,
  listenForFileDrops,
  loadStartupFiles,
  persistWorkspace,
  readFile,
  restoreWorkspace,
  setWindowTitle,
  writeFile,
} from "./lib/platform";
import type { EditorTab, FilePayload, ThemeMode } from "./types";

let untitledCounter = 1;

function createUntitledTab(): EditorTab {
  const number = untitledCounter++;
  return {
    id: crypto.randomUUID(),
    path: null,
    name: number === 1 ? "untitled.md" : `untitled-${number}.md`,
    content: "",
    savedContent: "",
    cursor: 0,
    scrollTop: 0,
  };
}

function fileName(path: string) {
  const normalized = path.replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1) || "untitled";
}

function tabFromPayload(payload: FilePayload): EditorTab {
  return {
    id: crypto.randomUUID(),
    path: payload.path,
    name: payload.name || fileName(payload.path),
    content: payload.content,
    savedContent: payload.content,
    cursor: 0,
    scrollTop: 0,
  };
}

function samePath(left: string | null, right: string | null) {
  if (!left || !right) {
    return false;
  }
  return (
    left.replaceAll("\\", "/").toLowerCase() ===
    right.replaceAll("\\", "/").toLowerCase()
  );
}

function isDirty(tab: EditorTab) {
  return tab.content !== tab.savedContent;
}

function initialTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function App() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialTheme);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeTabIdRef = useRef(activeTabId);
  const tabsRef = useRef(tabs);

  activeTabIdRef.current = activeTabId;
  tabsRef.current = tabs;

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [tabs, activeTabId],
  );

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    window.setTimeout(() => {
      setErrorMessage((current) => (current === message ? null : current));
    }, 4500);
  }, []);

  const focusPath = useCallback((path: string) => {
    const existing = tabsRef.current.find((tab) => samePath(tab.path, path));
    if (existing) {
      setActiveTabId(existing.id);
      return true;
    }
    return false;
  }, []);

  const openPaths = useCallback(
    async (paths: string[]) => {
      for (const path of paths) {
        if (focusPath(path)) {
          continue;
        }
        try {
          const payload = await readFile(path);
          const tab = tabFromPayload(payload);
          setTabs((current) => [...current, tab]);
          setActiveTabId(tab.id);
        } catch (error) {
          showError(`Could not open ${fileName(path)}: ${String(error)}`);
        }
      }
    },
    [focusPath, showError],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const restored = await restoreWorkspace();
      const startupPaths = await loadStartupFiles();

      if (cancelled) {
        return;
      }

      if (restored) {
        setTabs(restored.tabs);
        setActiveTabId(restored.activeTabId);
        setThemeMode(restored.themeMode);
        setPreviewVisible(restored.previewVisible);
      } else {
        const tab = createUntitledTab();
        setTabs([tab]);
        setActiveTabId(tab.id);
      }

      setReady(true);

      if (startupPaths.length > 0) {
        window.setTimeout(() => {
          void openPaths(startupPaths);
        }, 0);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [openPaths]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const snapshot = {
      version: 1 as const,
      updatedAt: Date.now(),
      tabs,
      activeTabId,
      themeMode,
      previewVisible,
    };
    cacheWorkspace(snapshot);

    const timer = window.setTimeout(() => {
      void persistWorkspace(snapshot).catch((error) => {
        showError(`Could not save workspace: ${String(error)}`);
      });
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeTabId, previewVisible, ready, showError, tabs, themeMode]);

  useEffect(() => {
    const title = activeTab
      ? `${isDirty(activeTab) ? "• " : ""}${activeTab.name} — Simple Editor`
      : "Simple Editor";
    void setWindowTitle(title);
  }, [activeTab]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    void listenForFileDrops((paths) => {
      void openPaths(paths);
    }).then((unlisten) => {
      dispose = unlisten;
    });
    return () => {
      dispose?.();
    };
  }, [openPaths]);

  const updateActiveTab = useCallback(
    (updater: (tab: EditorTab) => EditorTab) => {
      const id = activeTabIdRef.current;
      if (!id) {
        return;
      }
      setTabs((current) =>
        current.map((tab) => (tab.id === id ? updater(tab) : tab)),
      );
    },
    [],
  );

  const createNewTab = useCallback(() => {
    const tab = createUntitledTab();
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setPreviewVisible(isMarkdownFile(tab.name));
  }, []);

  const openFilePicker = useCallback(async () => {
    try {
      const payload = await chooseTextFile();
      if (!payload) {
        return;
      }
      if (focusPath(payload.path)) {
        return;
      }
      const tab = tabFromPayload(payload);
      setTabs((current) => [...current, tab]);
      setActiveTabId(tab.id);
      setPreviewVisible(isMarkdownFile(tab.name));
    } catch (error) {
      showError(`Could not open file: ${String(error)}`);
    }
  }, [focusPath, showError]);

  const saveTab = useCallback(
    async (tabId: string, saveAs = false) => {
      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
      if (!tab) {
        return;
      }

      let path = saveAs ? null : tab.path;
      if (!path) {
        path = await chooseSavePath(tab.name);
      }
      if (!path) {
        return;
      }

      try {
        await writeFile(path, tab.content);
        const normalizedName = fileName(path);
        setTabs((current) =>
          current.map((candidate) =>
            candidate.id === tabId
              ? {
                  ...candidate,
                  path,
                  name: normalizedName,
                  savedContent: candidate.content,
                }
              : candidate,
          ),
        );
      } catch (error) {
        showError(`Could not save ${tab.name}: ${String(error)}`);
      }
    },
    [showError],
  );

  const closeTab = useCallback((tabId: string) => {
    const current = tabsRef.current;
    const index = current.findIndex((tab) => tab.id === tabId);
    const tab = current[index];
    if (!tab) {
      return;
    }
    if (isDirty(tab) && !window.confirm(`Close ${tab.name} without saving?`)) {
      return;
    }

    const next = current.filter((candidate) => candidate.id !== tabId);
    setTabs(next);
    if (activeTabIdRef.current === tabId) {
      const fallback = next[Math.min(index, next.length - 1)] ?? null;
      setActiveTabId(fallback?.id ?? null);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) {
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        const id = activeTabIdRef.current;
        if (id) {
          void saveTab(id, event.shiftKey);
        }
      } else if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openFilePicker();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        createNewTab();
      } else if (event.key.toLowerCase() === "w") {
        event.preventDefault();
        if (activeTabIdRef.current) {
          closeTab(activeTabIdRef.current);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeTab, createNewTab, openFilePicker, saveTab]);

  const onBrowserDrop = async (event: React.DragEvent) => {
    if (!event.dataTransfer.files.length) {
      return;
    }
    event.preventDefault();
    const dropped: EditorTab[] = [];
    for (const file of Array.from(event.dataTransfer.files)) {
      const content = await file.text();
      dropped.push(
        tabFromPayload({
          path: file.name,
          name: file.name,
          content,
        }),
      );
    }
    if (dropped.length) {
      setTabs((current) => [...current, ...dropped]);
      setActiveTabId(dropped[dropped.length - 1].id);
    }
  };

  const lineColumn = useMemo(() => {
    if (!activeTab) {
      return { line: 1, column: 1 };
    }
    const beforeCursor = activeTab.content.slice(0, activeTab.cursor);
    const line = beforeCursor.split("\n").length;
    const lastBreak = beforeCursor.lastIndexOf("\n");
    return {
      line,
      column: beforeCursor.length - lastBreak,
    };
  }, [activeTab]);

  const previewable = activeTab ? isMarkdownFile(activeTab.name) : false;
  const showPreview = previewable && previewVisible;

  return (
    <div
      className="app-shell"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => void onBrowserDrop(event)}
    >
      <header className="command-bar">
        <div className="brand" aria-label="Simple Editor">
          <span className="brand-mark">S</span>
          <span className="brand-name">Simple</span>
        </div>

        <div className="command-group">
          <button
            className="icon-button"
            onClick={() => void openFilePicker()}
            title="Open file (Ctrl+O)"
            aria-label="Open file"
          >
            <FolderOpen size={17} strokeWidth={1.8} />
          </button>
          <button
            className="icon-button"
            onClick={createNewTab}
            title="New file (Ctrl+N)"
            aria-label="New file"
          >
            <FilePlus2 size={17} strokeWidth={1.8} />
          </button>
          <button
            className="icon-button"
            disabled={!activeTab}
            onClick={() => {
              if (activeTab) {
                void saveTab(activeTab.id);
              }
            }}
            title="Save (Ctrl+S)"
            aria-label="Save file"
          >
            <Save size={17} strokeWidth={1.8} />
          </button>
        </div>

        <div className="command-spacer" />

        <div className="command-group">
          <button
            className={`icon-button ${showPreview ? "is-active" : ""}`}
            disabled={!previewable}
            onClick={() => setPreviewVisible((visible) => !visible)}
            title={showPreview ? "Hide preview" : "Show preview"}
            aria-label={
              showPreview
                ? "Hide markdown preview"
                : "Show markdown preview"
            }
          >
            {showPreview ? (
              <Columns2 size={17} strokeWidth={1.8} />
            ) : (
              <EyeOff size={17} strokeWidth={1.8} />
            )}
          </button>
          <button
            className="icon-button"
            onClick={() =>
              setThemeMode((current) =>
                current === "dark" ? "light" : "dark",
              )
            }
            title="Toggle theme"
            aria-label="Toggle light and dark theme"
          >
            {themeMode === "dark" ? (
              <Sun size={17} strokeWidth={1.8} />
            ) : (
              <Moon size={17} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </header>

      <nav className="tab-strip" aria-label="Open files">
        {tabs.map((tab) => (
          <button
            className={`tab ${tab.id === activeTabId ? "is-active" : ""}`}
            key={tab.id}
            onClick={() => {
              setActiveTabId(tab.id);
              setPreviewVisible(isMarkdownFile(tab.name));
            }}
            title={tab.path ?? tab.name}
          >
            <FileText
              className="tab-file-icon"
              size={14}
              strokeWidth={1.7}
            />
            <span className={`tab-name ${isDirty(tab) ? "is-dirty" : ""}`}>
              {tab.name}
            </span>
            <span
              className="tab-close"
              role="button"
              tabIndex={0}
              aria-label={`Close ${tab.name}`}
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  closeTab(tab.id);
                }
              }}
            >
              <X size={13} strokeWidth={2} />
            </span>
          </button>
        ))}
        <button
          className="new-tab-button"
          onClick={createNewTab}
          title="New file"
          aria-label="New file"
        >
          <FilePlus2 size={15} strokeWidth={1.8} />
        </button>
      </nav>

      <main className={`workspace ${showPreview ? "has-preview" : ""}`}>
        {activeTab ? (
          <>
            <section className="editor-pane" aria-label="Editor">
              <EditorPane
                key={activeTab.id}
                value={activeTab.content}
                name={activeTab.name}
                themeMode={themeMode}
                initialCursor={activeTab.cursor}
                initialScrollTop={activeTab.scrollTop}
                onChange={(content) =>
                  updateActiveTab((tab) => ({ ...tab, content }))
                }
                onCursorChange={(cursor) =>
                  updateActiveTab((tab) => ({ ...tab, cursor }))
                }
                onScrollChange={(scrollTop) =>
                  updateActiveTab((tab) => ({ ...tab, scrollTop }))
                }
                onSave={() => void saveTab(activeTab.id)}
              />
            </section>
            {showPreview ? (
              <section className="preview-pane" aria-label="Preview">
                <MarkdownPreview content={activeTab.content} />
              </section>
            ) : null}
          </>
        ) : (
          <section className="empty-state">
            <div className="empty-icon">
              <FileText size={30} strokeWidth={1.35} />
            </div>
            <h1>Open a text file</h1>
            <p>Start with an existing document or create a blank one.</p>
            <div className="empty-actions">
              <button
                className="primary-button"
                onClick={() => void openFilePicker()}
              >
                <FolderOpen size={16} />
                Open file
              </button>
              <button className="secondary-button" onClick={createNewTab}>
                <FilePlus2 size={16} />
                New file
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="status-bar">
        <div className="status-path" title={activeTab?.path ?? undefined}>
          {activeTab?.path ?? (activeTab ? "Not saved yet" : "")}
        </div>
        <div className="status-meta">
          {activeTab ? (
            <>
              <span>{languageLabel(activeTab.name)}</span>
              <span>
                Ln {lineColumn.line}, Col {lineColumn.column}
              </span>
              <span>UTF-8</span>
            </>
          ) : null}
        </div>
      </footer>

      {!ready ? (
        <div className="loading-screen">
          <span>Opening editor…</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="toast" role="alert">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}

export default App;

