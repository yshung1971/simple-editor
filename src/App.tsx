import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy as RestoreIcon,
  EyeOff,
  FilePlus2,
  FileText,
  FolderOpen,
  Menu,
  Minus,
  Moon,
  Save,
  Settings2,
  Square,
  Sun,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import "./App.css";
import { EditorPane } from "./components/EditorPane";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { isMarkdownFile, languageLabel } from "./lib/languages";
import { appText } from "./lib/i18n";
import {
  cacheWorkspace,
  chooseSavePath,
  chooseTextFile,
  closeAppWindow,
  copyText,
  listenForFileDrops,
  listenForWindowCloseRequest,
  listenForWindowMetrics,
  loadStartupFiles,
  minimizeWindow,
  persistWorkspace,
  persistSettings,
  prepareSettingsFile,
  readFile,
  renameFile,
  revealFile,
  restoreWorkspace,
  restoreSettings,
  setWindowTitle,
  setWindowSize,
  setWebviewZoom,
  toggleMaximizeWindow,
  writeFile,
} from "./lib/platform";
import {
  createDefaultUserSettings,
  DEFAULT_BEHAVIOR_SETTINGS,
  DEFAULT_EDITOR_SETTINGS,
  DEFAULT_PREVIEW_SETTINGS,
  DEFAULT_WINDOW_SETTINGS,
  parseUserSettings,
  serializeUserSettings,
} from "./lib/settings";
import type {
  BehaviorSettings,
  EditorSettings,
  EditorTab,
  FilePayload,
  PreviewSettings,
  ThemeMode,
  UiLanguage,
  UserSettings,
  WindowSettings,
} from "./types";

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
    name: number === 1 ? "untitled" : `untitled-${number}`,
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
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("en");
  const [previewVisible, setPreviewVisible] = useState(true);
  const [splitPercent, setSplitPercent] = useState(0.5);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isResizing, setIsResizing] = useState(false);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(
    DEFAULT_EDITOR_SETTINGS,
  );
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>(
    DEFAULT_PREVIEW_SETTINGS,
  );
  const [behaviorSettings, setBehaviorSettings] = useState<BehaviorSettings>(
    DEFAULT_BEHAVIOR_SETTINGS,
  );
  const [windowSettings, setWindowSettings] = useState<WindowSettings>(
    DEFAULT_WINDOW_SETTINGS,
  );
  const [settingsFilePath, setSettingsFilePath] = useState<string | null>(null);
  const [pendingCloseTabIds, setPendingCloseTabIds] = useState<string[]>([]);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [tabDropTarget, setTabDropTarget] = useState<{
    tabId: string;
    edge: "before" | "after";
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tabScrollState, setTabScrollState] = useState({
    hasOverflow: false,
    canScrollLeft: false,
    canScrollRight: false,
  });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [compactLayout, setCompactLayout] = useState(() =>
    window.matchMedia("(max-width: 860px)").matches,
  );
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeTabIdRef = useRef(activeTabId);
  const tabsRef = useRef(tabs);
  const workspaceRef = useRef<HTMLElement>(null);
  const tabStripRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);
  const firstTabContextMenuItemRef = useRef<HTMLButtonElement>(null);
  const cancelCloseButtonRef = useRef<HTMLButtonElement>(null);
  const tabPointerDragRef = useRef<{
    pointerId: number;
    sourceId: string;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const tabDropTargetRef = useRef<{
    tabId: string;
    edge: "before" | "after";
  } | null>(null);
  const suppressTabClickRef = useRef(false);

  activeTabIdRef.current = activeTabId;
  tabsRef.current = tabs;

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [tabs, activeTabId],
  );
  const pendingCloseTab = useMemo(
    () =>
      pendingCloseTabIds.length === 1
        ? tabs.find((tab) => tab.id === pendingCloseTabIds[0]) ?? null
        : null,
    [pendingCloseTabIds, tabs],
  );
  const pendingCloseTabs = useMemo(
    () =>
      pendingCloseTabIds
        .map((id) => tabs.find((tab) => tab.id === id))
        .filter((tab): tab is EditorTab => Boolean(tab)),
    [pendingCloseTabIds, tabs],
  );
  const pendingDirtyTabs = useMemo(
    () => pendingCloseTabs.filter(isDirty),
    [pendingCloseTabs],
  );
  const text = appText(uiLanguage);
  const currentSettings = useMemo<UserSettings>(
    () => ({
      version: 4,
      uiLanguage,
      themeMode,
      previewVisible,
      splitPercent,
      zoomLevel,
      editor: editorSettings,
      preview: previewSettings,
      behavior: behaviorSettings,
      window: windowSettings,
    }),
    [
      behaviorSettings,
      editorSettings,
      previewSettings,
      previewVisible,
      splitPercent,
      themeMode,
      uiLanguage,
      windowSettings,
      zoomLevel,
    ],
  );
  const currentSettingsRef = useRef(currentSettings);
  currentSettingsRef.current = currentSettings;

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    window.setTimeout(() => {
      setErrorMessage((current) => (current === message ? null : current));
    }, 4500);
  }, []);

  const updateTabScrollState = useCallback(() => {
    const strip = tabStripRef.current;
    if (!strip) {
      return;
    }

    const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const hasOverflow = maxScrollLeft > 1;
    setTabScrollState({
      hasOverflow,
      canScrollLeft: hasOverflow && strip.scrollLeft > 1,
      canScrollRight:
        hasOverflow && strip.scrollLeft < maxScrollLeft - 1,
    });
  }, []);

  const scrollTabStrip = useCallback(
    (direction: -1 | 1) => {
      const strip = tabStripRef.current;
      if (!strip) {
        return;
      }
      strip.scrollBy({
        left: direction * Math.max(96, strip.clientWidth * 0.72),
        behavior: "smooth",
      });
    },
    [],
  );

  const revealActiveTab = useCallback(() => {
    const strip = tabStripRef.current;
    if (!strip || !activeTabId) {
      updateTabScrollState();
      return;
    }

    const activeElement = strip.querySelector<HTMLElement>(
      `[data-tab-id="${activeTabId}"]`,
    );
    activeElement?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    updateTabScrollState();
  }, [activeTabId, updateTabScrollState]);

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
      const fallbackTheme = restored?.themeMode ?? initialTheme();
      const effectiveSettings =
        settings ??
        {
          ...createDefaultUserSettings(fallbackTheme),
          previewVisible: restored?.previewVisible ?? true,
          splitPercent: normalizeSplit(restored?.splitPercent),
          zoomLevel: normalizeZoom(restored?.zoomLevel),
        };
      const settingsFile = await prepareSettingsFile(
        serializeUserSettings(effectiveSettings),
      ).catch((error) => {
        if (!cancelled) {
          showError(`Could not prepare settings file: ${String(error)}`);
        }
        return null;
      });

      if (cancelled) {
        return;
      }

      if (restored) {
        const restoredTabs = effectiveSettings.behavior.restoreUnsavedTabs
          ? restored.tabs
          : restored.tabs.filter((tab) => !isDirty(tab));
        if (restoredTabs.length > 0) {
          const nextActive =
            restoredTabs.find((tab) => tab.id === restored.activeTabId) ??
            restoredTabs[0];
          setTabs(restoredTabs);
          setActiveTabId(nextActive.id);
        } else {
          const tab = createUntitledTab();
          setTabs([tab]);
          setActiveTabId(tab.id);
        }
      } else {
        const tab = createUntitledTab();
        setTabs([tab]);
        setActiveTabId(tab.id);
      }

      setThemeMode(effectiveSettings.themeMode);
      setUiLanguage(effectiveSettings.uiLanguage);
      setPreviewVisible(effectiveSettings.previewVisible);
      setSplitPercent(normalizeSplit(effectiveSettings.splitPercent));
      setZoomLevel(normalizeZoom(effectiveSettings.zoomLevel));
      setEditorSettings(effectiveSettings.editor);
      setPreviewSettings(effectiveSettings.preview);
      setBehaviorSettings(effectiveSettings.behavior);
      setWindowSettings(effectiveSettings.window);
      setSettingsFilePath(settingsFile?.path ?? null);
      await setWindowSize(effectiveSettings.window).catch((error) => {
        if (!cancelled) {
          showError(`Could not restore window size: ${String(error)}`);
        }
      });
      if (cancelled) {
        return;
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
  }, [openPaths, showError]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.lang = uiLanguage;
  }, [uiLanguage]);

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
    const strip = tabStripRef.current;
    if (!strip) {
      return;
    }

    const syncScrollState = () => {
      updateTabScrollState();
      revealActiveTab();
    };

    syncScrollState();
    const observer = new ResizeObserver(syncScrollState);
    observer.observe(strip);
    window.addEventListener("resize", syncScrollState);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncScrollState);
    };
  }, [revealActiveTab, updateTabScrollState]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      firstMenuItemRef.current?.focus();
    });
    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape, true);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let dispose: (() => void) | undefined;
    let cancelled = false;

    void listenForWindowMetrics(({ maximized, size }) => {
      if (!cancelled) {
        setWindowMaximized(maximized);
        if (!maximized && size) {
          const nextSize = {
            width: Math.round(size.width),
            height: Math.round(size.height),
          };
          setWindowSettings((current) =>
            current.width === nextSize.width &&
            current.height === nextSize.height
              ? current
              : nextSize,
          );
        }
      }
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        dispose = unlisten;
      }
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let dispose: (() => void) | undefined;
    let cancelled = false;

    void listenForWindowCloseRequest(async (size) => {
      const settings = size
        ? { ...currentSettingsRef.current, window: size }
        : currentSettingsRef.current;
      await persistSettings(settings).catch((error) => {
        showError(`Could not save window settings: ${String(error)}`);
      });
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        dispose = unlisten;
      }
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [ready, showError]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      firstTabContextMenuItemRef.current?.focus();
    });
    const closeContextMenu = () => setContextMenu(null);
    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !contextMenuRef.current?.contains(event.target)
      ) {
        closeContextMenu();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("blur", closeContextMenu);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("blur", closeContextMenu);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  useLayoutEffect(() => {
    revealActiveTab();
  }, [revealActiveTab, tabs.length]);

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

  const settingsTab = useMemo(
    () =>
      settingsFilePath
        ? tabs.find((tab) => samePath(tab.path, settingsFilePath)) ?? null
        : null,
    [settingsFilePath, tabs],
  );
  const settingsTabDirty = settingsTab ? isDirty(settingsTab) : false;

  useEffect(() => {
    if (!ready || settingsTabDirty) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistSettings(currentSettings).catch((error) => {
        showError(`Could not save settings: ${String(error)}`);
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentSettings, ready, settingsTabDirty, showError]);

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

  const moveTab = useCallback(
    (
      sourceId: string,
      targetId: string,
      edge: "before" | "after",
    ) => {
      if (sourceId === targetId) {
        return;
      }

      setTabs((current) => {
        const source = current.find((tab) => tab.id === sourceId);
        if (!source || !current.some((tab) => tab.id === targetId)) {
          return current;
        }

        const next = current.filter((tab) => tab.id !== sourceId);
        const targetIndex = next.findIndex((tab) => tab.id === targetId);
        if (targetIndex === -1) {
          return current;
        }
        next.splice(
          edge === "before" ? targetIndex : targetIndex + 1,
          0,
          source,
        );

        return next.every((tab, index) => tab.id === current[index]?.id)
          ? current
          : next;
      });
    },
    [],
  );

  const updateTabDropTarget = useCallback(
    (
      target: {
        tabId: string;
        edge: "before" | "after";
      } | null,
    ) => {
      tabDropTargetRef.current = target;
      setTabDropTarget(target);
    },
    [],
  );

  const clearTabDrag = useCallback(() => {
    tabPointerDragRef.current = null;
    updateTabDropTarget(null);
    setDraggedTabId(null);
  }, [updateTabDropTarget]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = tabPointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      if (
        !drag.dragging &&
        Math.hypot(
          event.clientX - drag.startX,
          event.clientY - drag.startY,
        ) < 5
      ) {
        return;
      }

      if (!drag.dragging) {
        drag.dragging = true;
        setDraggedTabId(drag.sourceId);
      }

      event.preventDefault();
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>(".tab[data-tab-id]");
      const targetId = target?.dataset.tabId;
      if (!target || !targetId || targetId === drag.sourceId) {
        updateTabDropTarget(null);
        return;
      }

      const bounds = target.getBoundingClientRect();
      const edge =
        event.clientX < bounds.left + bounds.width / 2 ? "before" : "after";
      const current = tabDropTargetRef.current;
      if (current?.tabId !== targetId || current.edge !== edge) {
        updateTabDropTarget({ tabId: targetId, edge });
      }
    };

    const finishPointerDrag = (event: PointerEvent, cancelled = false) => {
      const drag = tabPointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      if (drag.dragging) {
        suppressTabClickRef.current = true;
        window.setTimeout(() => {
          suppressTabClickRef.current = false;
        }, 0);
        const target = tabDropTargetRef.current;
        if (!cancelled && target) {
          moveTab(drag.sourceId, target.tabId, target.edge);
        }
      }
      clearTabDrag();
    };

    const onPointerUp = (event: PointerEvent) => {
      finishPointerDrag(event);
    };
    const onPointerCancel = (event: PointerEvent) => {
      finishPointerDrag(event, true);
    };
    const onWindowBlur = () => {
      clearTabDrag();
    };

    window.addEventListener("pointermove", onPointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [clearTabDrag, moveTab, updateTabDropTarget]);

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

  const applyUserSettings = useCallback((settings: UserSettings) => {
    setUiLanguage(settings.uiLanguage);
    setThemeMode(settings.themeMode);
    setPreviewVisible(settings.previewVisible);
    setSplitPercent(normalizeSplit(settings.splitPercent));
    setZoomLevel(normalizeZoom(settings.zoomLevel));
    setEditorSettings(settings.editor);
    setPreviewSettings(settings.preview);
    setBehaviorSettings(settings.behavior);
    setWindowSettings(settings.window);
    void setWindowSize(settings.window).catch((error) => {
      showError(`Could not apply window size: ${String(error)}`);
    });
  }, [showError]);

  const openSettingsFile = useCallback(async () => {
    try {
      const payload = await prepareSettingsFile(
        serializeUserSettings(currentSettings),
      );
      setSettingsFilePath(payload.path);
      const existing = tabsRef.current.find((tab) =>
        samePath(tab.path, payload.path),
      );
      if (existing) {
        setActiveTabId(existing.id);
        setPreviewVisible(false);
        return;
      }
      const tab = tabFromPayload(payload);
      setTabs((current) => [...current, tab]);
      setActiveTabId(tab.id);
      setPreviewVisible(false);
    } catch (error) {
      showError(`Could not open settings file: ${String(error)}`);
    }
  }, [currentSettings, showError]);

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
        const isSettingsFile =
          settingsFilePath !== null && samePath(path, settingsFilePath);
        const parsedSettings = isSettingsFile
          ? parseUserSettings(tab.content)
          : null;
        const content =
          parsedSettings !== null
            ? serializeUserSettings(parsedSettings)
            : tab.content;
        await writeFile(path, content);
        const normalizedName = fileName(path);
        setTabs((current) =>
          current.map((candidate) =>
            candidate.id === tabId
              ? {
                  ...candidate,
                  path,
                  name: normalizedName,
                  content: isSettingsFile ? content : candidate.content,
                  savedContent: content,
                }
              : candidate,
          ),
        );
        if (parsedSettings) {
          setSettingsFilePath(path);
          applyUserSettings(parsedSettings);
        }
      } catch (error) {
        showError(`Could not save ${tab.name}: ${String(error)}`);
      }
    },
    [applyUserSettings, settingsFilePath, showError],
  );

  const removeTabs = useCallback((tabIds: string[]) => {
    const ids = new Set(tabIds);
    if (ids.size === 0) {
      return;
    }
    const current = tabsRef.current;
    const firstRemovedIndex = current.findIndex((tab) => ids.has(tab.id));
    if (firstRemovedIndex === -1) {
      return;
    }

    const next = current.filter((candidate) => !ids.has(candidate.id));
    setTabs(next);
    if (activeTabIdRef.current && ids.has(activeTabIdRef.current)) {
      const fallback =
        next[Math.min(firstRemovedIndex, next.length - 1)] ?? null;
      setActiveTabId(fallback?.id ?? null);
    }
  }, []);

  const requestCloseTabs = useCallback(
    (tabIds: string[]) => {
      const uniqueIds = [...new Set(tabIds)];
      const closingTabs = tabsRef.current.filter((tab) =>
        uniqueIds.includes(tab.id),
      );
      if (closingTabs.length === 0) {
        return;
      }
      const ids = closingTabs.map((tab) => tab.id);
      if (
        !behaviorSettings.confirmOnClose ||
        closingTabs.every((tab) => !isDirty(tab))
      ) {
        removeTabs(ids);
        return;
      }
      setPendingCloseTabIds(ids);
    },
    [behaviorSettings.confirmOnClose, removeTabs],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      requestCloseTabs([tabId]);
    },
    [requestCloseTabs],
  );

  const cancelPendingClose = useCallback(() => {
    setPendingCloseTabIds([]);
  }, []);

  const confirmPendingClose = useCallback(() => {
    if (pendingCloseTabIds.length === 0) {
      return;
    }
    const tabIds = pendingCloseTabIds;
    setPendingCloseTabIds([]);
    removeTabs(tabIds);
  }, [pendingCloseTabIds, removeTabs]);

  const beginTabRename = useCallback((tabId: string) => {
    const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
    if (!tab) {
      return;
    }
    setContextMenu(null);
    setRenamingTabId(tabId);
    setRenameDraft(tab.name);
  }, []);

  const cancelTabRename = useCallback(() => {
    setRenamingTabId(null);
    setRenameDraft("");
  }, []);

  const commitTabRename = useCallback(
    async (tabId: string) => {
      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
      const nextName = renameDraft.trim();
      if (!tab || !nextName || nextName === tab.name) {
        cancelTabRename();
        return;
      }
      if (nextName === "." || nextName === ".." || /[\\/]/.test(nextName)) {
        showError("File names cannot contain path separators.");
        return;
      }

      try {
        const nextPath = tab.path
          ? await renameFile(tab.path, nextName)
          : null;
        setTabs((current) =>
          current.map((candidate) =>
            candidate.id === tabId
              ? {
                  ...candidate,
                  path: nextPath ?? candidate.path,
                  name: fileName(nextPath ?? nextName),
                }
              : candidate,
          ),
        );
        if (tab.path && settingsFilePath && samePath(tab.path, settingsFilePath)) {
          setSettingsFilePath(nextPath);
        }
        cancelTabRename();
      } catch (error) {
        showError(`Could not rename ${tab.name}: ${String(error)}`);
      }
    },
    [cancelTabRename, renameDraft, settingsFilePath, showError],
  );

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
    if (pendingCloseTabIds.length === 0) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      cancelCloseButtonRef.current?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelPendingClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [cancelPendingClose, pendingCloseTabIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (pendingCloseTabIds.length > 0) {
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) {
        if (event.key === "F2" && activeTabIdRef.current) {
          event.preventDefault();
          event.stopPropagation();
          beginTabRename(activeTabIdRef.current);
          return;
        }
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
      } else if (event.key === ",") {
        event.preventDefault();
        void openSettingsFile();
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
    beginTabRename,
    closeTab,
    compactLayout,
    createNewTab,
    openFilePicker,
    openSettingsFile,
    pendingCloseTabIds,
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

  const openContextMenu = (event: React.MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const tabElement = target.closest<HTMLElement>(".tab[data-tab-id]");
    if (!tabElement) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const tabId = tabElement.dataset.tabId;
    if (!tabId) {
      return;
    }

    const menuWidth = 214;
    const menuHeight = 294;
    setMenuOpen(false);
    setActiveTabId(tabId);
    setPreviewVisible(
      isMarkdownFile(
        tabsRef.current.find((tab) => tab.id === tabId)?.name ?? "",
      ),
    );
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX, innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, innerHeight - menuHeight - 8)),
      tabId,
    });
  };

  const onTabContextAction = useCallback(
    (action: string, tabId: string) => {
      const currentTabs = tabsRef.current;
      const index = currentTabs.findIndex((tab) => tab.id === tabId);
      const tab = index >= 0 ? currentTabs[index] : null;
      setContextMenu(null);
      if (!tab) {
        return;
      }

      if (action === "close") {
        closeTab(tabId);
      } else if (action === "close-others") {
        requestCloseTabs(
          currentTabs.filter((candidate) => candidate.id !== tabId).map((candidate) => candidate.id),
        );
      } else if (action === "close-right") {
        requestCloseTabs(currentTabs.slice(index + 1).map((candidate) => candidate.id));
      } else if (action === "close-saved") {
        requestCloseTabs(
          currentTabs
            .filter((candidate) => !isDirty(candidate))
            .map((candidate) => candidate.id),
        );
      } else if (action === "copy-path") {
        if (!tab.path) {
          return;
        }
        void copyText(tab.path).catch((error) => {
          showError(`Could not copy the file path: ${String(error)}`);
        });
      } else if (action === "open-folder") {
        if (!tab.path) {
          return;
        }
        void revealFile(tab.path).catch((error) => {
          showError(`Could not open the containing folder: ${String(error)}`);
        });
      } else if (action === "rename") {
        beginTabRename(tabId);
      }
    },
    [
      beginTabRename,
      closeTab,
      requestCloseTabs,
      showError,
    ],
  );

  const minimizeAppWindow = () => {
    void minimizeWindow().catch((error) => {
      showError(`Could not minimize window: ${String(error)}`);
    });
  };

  const toggleAppWindowMaximized = () => {
    void toggleMaximizeWindow()
      .then(setWindowMaximized)
      .catch((error) => {
        showError(`Could not resize window: ${String(error)}`);
      });
  };

  const closeApp = () => {
    void closeAppWindow().catch((error) => {
      showError(`Could not close window: ${String(error)}`);
    });
  };

  const previewable = activeTab ? isMarkdownFile(activeTab.name) : false;
  const showPreview = previewable && previewVisible;
  const contextMenuTab = contextMenu
    ? tabs.find((tab) => tab.id === contextMenu.tabId) ?? null
    : null;

  return (
    <div
      className={`app-shell ${draggedTabId ? "is-tab-dragging" : ""}`}
      style={
        {
          "--editor-font-family": editorSettings.fontFamily,
          "--editor-font-size": `${editorSettings.fontSize}px`,
          "--editor-line-height": String(editorSettings.lineHeight),
          "--preview-font-family": previewSettings.fontFamily,
          "--preview-font-size": `${previewSettings.fontSize}px`,
          "--preview-max-width": `${previewSettings.maxWidth}px`,
        } as CSSProperties
      }
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => void onBrowserDrop(event)}
      onContextMenu={openContextMenu}
    >
      <header className="top-bar">
        <div className="menu-anchor" ref={menuRef}>
          <button
            className="topbar-button"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            title={text.menuButton}
            aria-label={text.openApplicationMenu}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls="application-menu"
          >
            <Menu size={17} strokeWidth={1.8} />
          </button>

          {menuOpen ? (
            <div
              className="app-menu"
              id="application-menu"
              role="menu"
              aria-label={text.applicationMenu}
            >
              <button
                className="menu-item"
                type="button"
                role="menuitem"
                ref={firstMenuItemRef}
                onClick={() => {
                  setMenuOpen(false);
                  void openFilePicker();
                }}
              >
                <FolderOpen size={16} strokeWidth={1.8} />
                <span>{text.openFile}</span>
                <kbd>Ctrl+O</kbd>
              </button>
              <button
                className="menu-item"
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  createNewTab();
                }}
              >
                <FilePlus2 size={16} strokeWidth={1.8} />
                <span>{text.newFile}</span>
                <kbd>Ctrl+N</kbd>
              </button>
              <button
                className="menu-item"
                type="button"
                role="menuitem"
                disabled={!activeTab}
                onClick={() => {
                  setMenuOpen(false);
                  if (activeTab) {
                    void saveTab(activeTab.id);
                  }
                }}
              >
                <Save size={16} strokeWidth={1.8} />
                <span>{text.save}</span>
                <kbd>Ctrl+S</kbd>
              </button>
              <div className="menu-separator" role="separator" />
              <button
                className="menu-item"
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void openSettingsFile();
                }}
              >
                <Settings2 size={16} strokeWidth={1.8} />
                <span>{text.settings}</span>
                <kbd>Ctrl+,</kbd>
              </button>
              <button
                className="menu-item"
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setThemeMode((current) =>
                    current === "dark" ? "light" : "dark",
                  );
                }}
              >
                {themeMode === "dark" ? (
                  <Sun size={16} strokeWidth={1.8} />
                ) : (
                  <Moon size={16} strokeWidth={1.8} />
                )}
                <span>
                  {themeMode === "dark"
                    ? text.useLightTheme
                    : text.useDarkTheme}
                </span>
              </button>
            </div>
          ) : null}
        </div>

        <button
          className="tab-scroll-button tab-scroll-left"
          type="button"
          hidden={!tabScrollState.hasOverflow}
          disabled={!tabScrollState.canScrollLeft}
          onClick={() => scrollTabStrip(-1)}
          title={text.scrollTabsLeft}
          aria-label={text.scrollTabsLeft}
        >
          <ChevronLeft size={16} strokeWidth={1.8} />
        </button>

        <nav
          className="tab-strip"
          aria-label={text.openFiles}
          ref={tabStripRef}
          onScroll={updateTabScrollState}
        >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-tab-id={tab.id}
            className={`tab ${tab.id === activeTabId ? "is-active" : ""} ${
              draggedTabId === tab.id ? "is-dragging" : ""
            } ${
              tabDropTarget?.tabId === tab.id &&
              draggedTabId !== tab.id
                ? `drop-${tabDropTarget.edge}`
                : ""
            }`}
            onPointerDown={(event) => {
              if (event.button !== 0 || renamingTabId === tab.id) {
                return;
              }
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest(".tab-close, .tab-rename-input")
              ) {
                return;
              }
              tabPointerDragRef.current = {
                pointerId: event.pointerId,
                sourceId: tab.id,
                startX: event.clientX,
                startY: event.clientY,
                dragging: false,
              };
            }}
            onClick={(event) => {
              if (suppressTabClickRef.current) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
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
            title={`${tab.path ?? tab.name} (${text.dragToReorder}; ${text.middleClickToClose})`}
          >
            <FileText
              className="tab-file-icon"
              size={14}
              strokeWidth={1.7}
            />
            {renamingTabId === tab.id ? (
              <input
                className="tab-rename-input"
                value={renameDraft}
                aria-label={`${text.rename} ${tab.name}`}
                autoFocus
                onChange={(event) => setRenameDraft(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onBlur={() => void commitTabRename(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    void commitTabRename(tab.id);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    cancelTabRename();
                  }
                }}
              />
            ) : (
              <span
                className={`tab-name ${isDirty(tab) ? "is-dirty" : ""}`}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  beginTabRename(tab.id);
                }}
              >
                {tab.name}
              </span>
            )}
            <span
              className="tab-close"
              role="button"
              tabIndex={0}
              aria-label={`${text.closeTab} ${tab.name}`}
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
        </nav>

        <button
          className="tab-scroll-button tab-scroll-right"
          type="button"
          hidden={!tabScrollState.hasOverflow}
          disabled={!tabScrollState.canScrollRight}
          onClick={() => scrollTabStrip(1)}
          title={text.scrollTabsRight}
          aria-label={text.scrollTabsRight}
        >
          <ChevronRight size={16} strokeWidth={1.8} />
        </button>

        <div
          className="window-drag-region"
          data-tauri-drag-region
          aria-hidden="true"
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        />

        <div className="tab-bar-actions">
          <button
            className="new-tab-button"
            onClick={createNewTab}
            title={text.newFile}
            aria-label={text.newFile}
          >
            <FilePlus2 size={15} strokeWidth={1.8} />
          </button>
          <button
            className={`preview-button ${showPreview ? "is-active" : ""}`}
            disabled={!previewable}
            onClick={() => setPreviewVisible((visible) => !visible)}
            title={showPreview ? text.hidePreview : text.showPreview}
            aria-label={
              showPreview
                ? text.hideMarkdownPreview
                : text.showMarkdownPreview
            }
          >
            {showPreview ? (
              <Columns2 size={17} strokeWidth={1.8} />
            ) : (
              <EyeOff size={17} strokeWidth={1.8} />
            )}
          </button>
        </div>

        <div className="window-controls" aria-label="Window controls">
          <button
            className="window-control-button"
            type="button"
            onClick={minimizeAppWindow}
            title={text.minimize}
            aria-label={text.minimizeWindow}
          >
            <Minus size={16} strokeWidth={1.7} />
          </button>
          <button
            className="window-control-button"
            type="button"
            onClick={toggleAppWindowMaximized}
            title={windowMaximized ? text.restore : text.maximize}
            aria-label={
              windowMaximized ? text.restoreWindow : text.maximizeWindow
            }
          >
            {windowMaximized ? (
              <RestoreIcon size={13} strokeWidth={1.7} />
            ) : (
              <Square size={13} strokeWidth={1.7} />
            )}
          </button>
          <button
            className="window-control-button window-close-button"
            type="button"
            onClick={closeApp}
            title={text.close}
            aria-label={text.closeWindow}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

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
            <section className="editor-pane" aria-label={text.editor}>
              <EditorPane
                key={activeTab.id}
                value={activeTab.content}
                name={activeTab.name}
                themeMode={themeMode}
                wordWrap={editorSettings.wordWrap}
                tabSize={editorSettings.tabSize}
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
                  aria-label={text.resizeEditorPreview}
                  aria-orientation={
                    compactLayout ? "horizontal" : "vertical"
                  }
                  aria-valuemin={Math.round(MIN_SPLIT * 100)}
                  aria-valuemax={Math.round(MAX_SPLIT * 100)}
                  aria-valuenow={Math.round(splitPercent * 100)}
                  title={text.resizeEditorPreviewHelp}
                  onPointerDown={startDividerResize}
                  onPointerMove={moveDivider}
                  onPointerUp={stopDividerResize}
                  onPointerCancel={stopDividerResize}
                  onDoubleClick={() => setSplitPercent(0.5)}
                />
                <section
                  className="preview-pane"
                  aria-label={text.preview}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setContextMenu(null);
                  }}
                >
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
            <h1>{text.emptyTitle}</h1>
            <p>{text.emptyDescription}</p>
            <div className="empty-actions">
              <button
                className="primary-button"
                onClick={() => void openFilePicker()}
              >
                <FolderOpen size={16} />
                {text.openFile}
              </button>
              <button className="secondary-button" onClick={createNewTab}>
                <FilePlus2 size={16} />
                {text.newFile}
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="status-bar">
        <div className="status-path" title={activeTab?.path ?? undefined}>
          {activeTab?.path ?? (activeTab ? text.notSavedYet : "")}
        </div>
        <div className="status-meta">
          {activeTab ? (
            <>
              <span>{languageLabel(activeTab.name)}</span>
              <span>
                {text.line} {lineColumn.line}, {text.column}{" "}
                {lineColumn.column}
              </span>
              <span>UTF-8</span>
              <span>{Math.round(zoomLevel * 100)}%</span>
            </>
          ) : null}
        </div>
      </footer>

      {contextMenu ? (
        <div
          className="context-menu tab-context-menu"
          ref={contextMenuRef}
          role="menu"
          aria-label={text.tabActions}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            className="context-menu-item"
            type="button"
            role="menuitem"
            ref={firstTabContextMenuItemRef}
            onClick={() =>
              onTabContextAction("close", contextMenu.tabId)
            }
          >
            <span>{text.closeTab}</span>
            <kbd>Ctrl+W</kbd>
          </button>
          <button
            className="context-menu-item"
            type="button"
            role="menuitem"
            onClick={() =>
              onTabContextAction("close-others", contextMenu.tabId)
            }
          >
            <span>{text.closeOtherTabs}</span>
          </button>
          <button
            className="context-menu-item"
            type="button"
            role="menuitem"
            onClick={() =>
              onTabContextAction("close-right", contextMenu.tabId)
            }
          >
            <span>{text.closeTabsRight}</span>
          </button>
          <button
            className="context-menu-item"
            type="button"
            role="menuitem"
            onClick={() =>
              onTabContextAction("close-saved", contextMenu.tabId)
            }
          >
            <span>{text.closeSavedTabs}</span>
          </button>
          <div className="context-menu-separator" role="separator" />
          <button
            className="context-menu-item"
            type="button"
            role="menuitem"
            disabled={!contextMenuTab?.path}
            onClick={() =>
              onTabContextAction("copy-path", contextMenu.tabId)
            }
          >
            <span>{text.copyFullPath}</span>
          </button>
          <button
            className="context-menu-item"
            type="button"
            role="menuitem"
            disabled={!contextMenuTab?.path}
            onClick={() =>
              onTabContextAction("open-folder", contextMenu.tabId)
            }
          >
            <span>{text.openContainingFolder}</span>
          </button>
          <div className="context-menu-separator" role="separator" />
          <button
            className="context-menu-item"
            type="button"
            role="menuitem"
            onClick={() =>
              onTabContextAction("rename", contextMenu.tabId)
            }
          >
            <span>{text.rename}</span>
            <kbd>F2</kbd>
          </button>
        </div>
      ) : null}

      {pendingCloseTabs.length > 0 ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.button === 0 && event.target === event.currentTarget) {
              cancelPendingClose();
            }
          }}
        >
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-dialog-title"
            aria-describedby="close-dialog-description"
          >
            <div className="confirm-dialog-heading">
              <span className="confirm-dialog-icon">
                <TriangleAlert size={18} strokeWidth={1.8} />
              </span>
              <div className="confirm-dialog-copy">
                <h2 id="close-dialog-title">
                  {pendingCloseTabs.length === 1
                    ? text.closeWithoutSaving
                    : text.closeTabsWithoutSaving}
                </h2>
                <p id="close-dialog-description">
                  {pendingCloseTab ? (
                    <>
                      <strong>{pendingCloseTab.name}</strong>{" "}
                      {text.hasUnsavedChanges}
                    </>
                  ) : (
                    text.unsavedTabCount(pendingDirtyTabs.length)
                  )}
                </p>
              </div>
              <button
                className="dialog-close-button"
                onClick={cancelPendingClose}
                title={text.cancelClose}
                aria-label={text.cancelClose}
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>
            <div className="confirm-dialog-actions">
              <button
                className="secondary-button"
                ref={cancelCloseButtonRef}
                onClick={cancelPendingClose}
              >
                {text.cancel}
              </button>
              <button className="danger-button" onClick={confirmPendingClose}>
                {text.closeWithoutSavingAction}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!ready ? (
        <div className="loading-screen">
          <span>{text.loading}</span>
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

