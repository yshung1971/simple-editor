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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  persistSettings,
  readFile,
  restoreWorkspace,
  restoreSettings,
  setWindowTitle,
  setWebviewZoom,
  writeFile,
} from "./lib/platform";
import type { EditorTab, FilePayload, ThemeMode } from "./types";

let untitledCounter = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const MIN_SPLIT = 0.25;
const MAX_SPLIT = 0.75;
const DIVIDER_SIZE = 7;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeZoom(value: number | undefined) {
  return clamp(value ?? 1, MIN_ZOOM, MAX_ZOOM);
}

function normalizeSplit(value: number | undefined) {
  return clamp(value ?? 0.5, MIN_SPLIT, MAX_SPLIT);
}

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
  const [splitPercent, setSplitPercent] = useState(0.5);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isResizing, setIsResizing] = useState(false);
  const [compactLayout, setCompactLayout] = useState(() =>
    window.matchMedia("(max-width: 860px)").matches,
  );
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeTabIdRef = useRef(activeTabId);
  const tabsRef = useRef(tabs);
  const workspaceRef = useRef<HTMLElement>(null);

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
      const [restored, settings] = await Promise.all([
        restoreWorkspace(),
        restoreSettings(),
      ]);
      const startupPaths = await loadStartupFiles();

      if (cancelled) {
        return;
      }

      if (restored) {
        setTabs(restored.tabs);
        setActiveTabId(restored.activeTabId);
      } else {
        const tab = createUntitledTab();
        setTabs([tab]);
        setActiveTabId(tab.id);
      }

      setThemeMode(settings?.themeMode ?? restored?.themeMode ?? initialTheme());
      setPreviewVisible(
        settings?.previewVisible ?? restored?.previewVisible ?? true,
      );
      setSplitPercent(
        normalizeSplit(settings?.splitPercent ?? restored?.splitPercent),
      );
      setZoomLevel(
        normalizeZoom(settings?.zoomLevel ?? restored?.zoomLevel),
      );
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
    void setWebviewZoom(zoomLevel).catch((error) => {
      showError(`Could not change zoom: ${String(error)}`);
    });
  }, [showError, zoomLevel]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 860px)");
    const updateLayout = () => setCompactLayout(media.matches);
    updateLayout();
    media.addEventListener("change", updateLayout);
    return () => media.removeEventListener("change", updateLayout);
  }, []);

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
      splitPercent,
      zoomLevel,
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
  }, [activeTabId, ready, showError, tabs, themeMode, previewVisible]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistSettings({
        version: 1,
        updatedAt: Date.now(),
        themeMode,
        previewVisible,
        splitPercent,
        zoomLevel,
      }).catch((error) => {
        showError(`Could not save settings: ${String(error)}`);
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    previewVisible,
    ready,
    showError,
    splitPercent,
    themeMode,
    zoomLevel,
  ]);

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

  const changeZoom = useCallback((delta: number) => {
    setZoomLevel((current) =>
      Math.round(clamp(current + delta, MIN_ZOOM, MAX_ZOOM) * 10) / 10,
    );
  }, []);

  const updateSplitFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const workspace = workspaceRef.current;
      if (!workspace) {
        return;
      }

      const bounds = workspace.getBoundingClientRect();
      const total = compactLayout
        ? Math.max(1, bounds.height - DIVIDER_SIZE)
        : Math.max(1, bounds.width - DIVIDER_SIZE);
      const mainSize = compactLayout
        ? clientY - bounds.top
        : clientX - bounds.left;
      const mainMinimum = compactLayout ? 140 : 240;
      const previewMinimum = compactLayout ? 140 : 300;
      const minimum = Math.min(0.45, mainMinimum / total);
      const maximum = Math.max(0.55, 1 - previewMinimum / total);

      setSplitPercent(clamp(mainSize / total, minimum, maximum));
    },
    [compactLayout],
  );

  const startDividerResize = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
  };

  const moveDivider = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing) {
      return;
    }
    updateSplitFromPointer(event.clientX, event.clientY);
  };

  const stopDividerResize = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsResizing(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          target.classList.contains("pane-divider")
        ) {
          const decrease = compactLayout
            ? event.key === "ArrowUp"
            : event.key === "ArrowLeft";
          const increase = compactLayout
            ? event.key === "ArrowDown"
            : event.key === "ArrowRight";
          const delta = decrease
            ? -0.02
            : increase
              ? 0.02
              : 0;

          if (delta !== 0) {
            event.preventDefault();
            event.stopPropagation();
            setSplitPercent((current) =>
              clamp(current + delta, MIN_SPLIT, MAX_SPLIT),
            );
          } else if (event.key === "Home") {
            event.preventDefault();
            event.stopPropagation();
            setSplitPercent(0.5);
          }
        }
        return;
      }

      const zoomIn =
        event.key === "+" ||
        event.key === "=" ||
        event.code === "NumpadAdd";
      const zoomOut =
        event.key === "-" ||
        event.key === "_" ||
        event.code === "NumpadSubtract";
      const resetZoom =
        event.key === "0" || event.code === "Numpad0";

      if (zoomIn) {
        event.preventDefault();
        event.stopPropagation();
        changeZoom(ZOOM_STEP);
      } else if (zoomOut) {
        event.preventDefault();
        event.stopPropagation();
        changeZoom(-ZOOM_STEP);
      } else if (resetZoom) {
        event.preventDefault();
        event.stopPropagation();
        setZoomLevel(1);
      } else if (event.key.toLowerCase() === "s") {
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

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    changeZoom,
    closeTab,
    compactLayout,
    createNewTab,
    openFilePicker,
    saveTab,
  ]);

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
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                event.stopPropagation();
                closeTab(tab.id);
              }
            }}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault();
              }
            }}
            title={`${tab.path ?? tab.name} (middle-click to close)`}
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

      <main
        className={`workspace ${showPreview ? "has-preview" : ""} ${isResizing ? "is-resizing" : ""}`}
        ref={workspaceRef}
        style={
          {
            "--editor-share": `${splitPercent * 100}%`,
          } as CSSProperties
        }
      >
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
              <>
                <div
                  className="pane-divider"
                  role="separator"
                  tabIndex={0}
                  aria-label="Resize editor and preview"
                  aria-orientation={
                    compactLayout ? "horizontal" : "vertical"
                  }
                  aria-valuemin={Math.round(MIN_SPLIT * 100)}
                  aria-valuemax={Math.round(MAX_SPLIT * 100)}
                  aria-valuenow={Math.round(splitPercent * 100)}
                  title="Drag to resize. Double-click to reset."
                  onPointerDown={startDividerResize}
                  onPointerMove={moveDivider}
                  onPointerUp={stopDividerResize}
                  onPointerCancel={stopDividerResize}
                  onDoubleClick={() => setSplitPercent(0.5)}
                />
                <section className="preview-pane" aria-label="Preview">
                  <MarkdownPreview
                    content={activeTab.content}
                    themeMode={themeMode}
                  />
                </section>
              </>
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
              <span>{Math.round(zoomLevel * 100)}%</span>
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

