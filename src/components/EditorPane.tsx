import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ForwardedRef,
} from "react";
import { languageExtension } from "../lib/languages";
import type { ThemeMode } from "../types";

export type EditorPaneHandle = {
  scrollToLine: (line: number) => void;
};

type EditorPaneProps = {
  value: string;
  name: string;
  themeMode: ThemeMode;
  wordWrap: boolean;
  tabSize: number;
  initialCursor: number;
  initialScrollTop: number;
  onChange: (value: string) => void;
  onCursorChange: (cursor: number) => void;
  onContentClick: (cursor: number) => void;
  onScrollChange: (scrollTop: number) => void;
  onSave: () => void;
};

function themeExtensions(themeMode: ThemeMode) {
  if (themeMode === "dark") {
    return [oneDark];
  }
  return [syntaxHighlighting(defaultHighlightStyle, { fallback: true })];
}

function editorTheme(themeMode: ThemeMode) {
  return EditorView.theme(
    {
      "&": {
        height: "100%",
        color: "var(--text-primary)",
        backgroundColor: "var(--editor-bg)",
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: "var(--editor-font-family, var(--font-mono))",
        lineHeight: "var(--editor-line-height, 1.65)",
      },
      ".cm-content": {
        padding: "18px 0 80px",
        caretColor: "var(--accent)",
      },
      ".cm-line": {
        padding: "0 24px 0 14px",
      },
      ".cm-gutters": {
        backgroundColor: "var(--editor-bg)",
        color: "var(--text-faint)",
        border: "none",
        paddingLeft: "10px",
      },
      ".cm-activeLine": {
        backgroundColor: "var(--active-line)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "var(--active-line)",
        color: "var(--text-secondary)",
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: "var(--selection)",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--accent)",
      },
      ".cm-foldPlaceholder": {
        color: "var(--text-muted)",
        backgroundColor: "var(--surface-soft)",
        border: "none",
      },
      ".cm-panels": {
        backgroundColor: "var(--surface)",
        color: "var(--text-primary)",
        borderColor: "var(--border)",
      },
      ".cm-searchMatch": {
        backgroundColor: "var(--search-match)",
        outline: "1px solid var(--search-match-border)",
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "var(--search-match-selected)",
      },
    },
    { dark: themeMode === "dark" },
  );
}

function EditorPaneComponent(
  {
    value,
    name,
    themeMode,
    wordWrap,
    tabSize,
    initialCursor,
    initialScrollTop,
    onChange,
    onCursorChange,
    onContentClick,
    onScrollChange,
    onSave,
  }: EditorPaneProps,
  ref: ForwardedRef<EditorPaneHandle>,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());
  const formattingCompartment = useRef(new Compartment());
  const callbacksRef = useRef({
    onChange,
    onCursorChange,
    onContentClick,
    onScrollChange,
    onSave,
  });

  callbacksRef.current = {
    onChange,
    onCursorChange,
    onContentClick,
    onScrollChange,
    onSave,
  };

  useImperativeHandle(
    ref,
    () => ({
      scrollToLine(line) {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        const targetLine = Math.min(
          view.state.doc.lines,
          Math.max(1, Math.trunc(line)),
        );
        view.dispatch({
          effects: EditorView.scrollIntoView(
            view.state.doc.line(targetLine).from,
            { y: "center" },
          ),
        });
      },
    }),
    [],
  );

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: value,
      selection: { anchor: Math.min(initialCursor, value.length) },
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter({ openText: "⌄", closedText: "›" }),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          {
            key: "Mod-s",
            run: () => {
              callbacksRef.current.onSave();
              return true;
            },
          },
          indentWithTab,
          ...closeSearchKeys(),
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap,
        ]),
        formattingCompartment.current.of([
          EditorState.tabSize.of(tabSize),
          wordWrap ? EditorView.lineWrapping : [],
        ]),
        languageCompartment.current.of(languageExtension(name)),
        themeCompartment.current.of(themeExtensions(themeMode)),
        editorTheme(themeMode),
        EditorView.domEventHandlers({
          mousedown(event, view) {
            if (event.button !== 0) {
              return false;
            }
            const cursor = view.posAtCoords({
              x: event.clientX,
              y: event.clientY,
            });
            if (cursor !== null) {
              callbacksRef.current.onContentClick(cursor);
            }
            return false;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            callbacksRef.current.onChange(update.state.doc.toString());
          }
          if (update.selectionSet) {
            callbacksRef.current.onCursorChange(
              update.state.selection.main.head,
            );
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: hostRef.current,
    });
    viewRef.current = view;

    requestAnimationFrame(() => {
      view.scrollDOM.scrollTop = initialScrollTop;
      view.focus();
    });

    const handleScroll = () => {
      callbacksRef.current.onScrollChange(view.scrollDOM.scrollTop);
    };
    view.scrollDOM.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      view.scrollDOM.removeEventListener("scroll", handleScroll);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    if (view.state.doc.toString() !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: languageCompartment.current.reconfigure(
        languageExtension(name),
      ),
    });
  }, [name]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: themeCompartment.current.reconfigure(
        themeExtensions(themeMode),
      ),
    });
  }, [themeMode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: formattingCompartment.current.reconfigure([
        EditorState.tabSize.of(tabSize),
        wordWrap ? EditorView.lineWrapping : [],
      ]),
    });
  }, [tabSize, wordWrap]);

  return <div className="editor-host" ref={hostRef} />;
}

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(
  EditorPaneComponent,
);

function closeSearchKeys() {
  return [
    {
      key: "Escape",
      run: (view: EditorView) => {
        const searchPanel = view.dom.querySelector(".cm-search");
        if (!searchPanel) {
          return false;
        }
        const closeButton = searchPanel.querySelector(
          "button[name=close]",
        ) as HTMLButtonElement | null;
        closeButton?.click();
        return true;
      },
    },
  ];
}

