# Simple Editor Native Rewrite Handoff

Date: 2026-11-22

This document is the implementation and behavior handoff for building a new,
low-memory Windows editor with the same practical scope as Simple Editor.

The new project should not be a direct Tauri/React rewrite. Its primary editor
must run without WebView2. WebView2 may be used only as an optional,
on-demand Mermaid renderer.

## 1. Product Goal

Build a focused, portable Windows editor for plain text and Markdown with:

- A native, responsive main UI
- Low idle memory usage
- UTF-8 file opening and saving
- Multiple tabs and unsaved-content recovery
- Syntax highlighting for common text and programming formats
- GFM Markdown preview
- Mermaid rendering without keeping Chromium resident when Mermaid is unused
- No accounts, AI, Git, terminal, collaboration, project management, remote
  development, or WSL integration

The product should remain useful for ordinary notes and documentation without
becoming a general-purpose IDE.

## 2. Recommended Architecture

### 2.1 Primary Stack

Recommended:

```text
Rust application shell
+ Windows native window and dialogs
+ Scintilla/Lexilla editor control
+ Rust Markdown/GFM parser
+ Native Markdown preview
+ Optional on-demand WebView2 Mermaid window/control
```

Acceptable alternative:

```text
C++20 Win32 shell
+ Scintilla/Lexilla
+ Rust library for Markdown/session logic where useful
```

### 2.2 Why This Stack

- Scintilla is a mature native editor control with UTF-8, selection,
  Undo/Redo, search, folding, line numbers, and syntax highlighting.
- Lexilla provides mature lexers and avoids reimplementing language parsing.
- Rust provides predictable memory management without a garbage collector.
- The main editor does not require Chromium, WebView2, Electron, or a browser
  process tree.
- Mermaid remains isolated as an optional rendering feature instead of being
  part of the idle baseline.

### 2.3 Main Memory Rule

Do not keep WebView2 loaded while Mermaid preview is not in use.

Preferred lifecycle:

1. Start the editor without WebView2.
2. Detect whether the current Markdown document contains a Mermaid block.
3. If Mermaid preview is requested, create a dedicated WebView2 renderer.
4. Render the diagram to SVG.
5. Cache the SVG and display it in the native preview surface if practical.
6. Destroy the renderer and its process tree when Mermaid preview is no longer
   visible or after the cache is populated.

If an embedded persistent WebView2 preview is chosen for better UX, document
that this keeps a browser-runtime memory floor and does not meet the lowest
possible memory target.

## 3. Target Metrics

These are engineering targets, not guarantees. Measure Private Working Set for
the complete process tree.

| State | Target |
| --- | ---: |
| Empty window, no document loaded | 15-30 MB |
| One ordinary text file open | 20-40 MB |
| Markdown preview active, no Mermaid | 25-50 MB |
| Mermaid rendering active | Temporary increase of 60-120 MB acceptable |
| Mermaid renderer hidden and destroyed | Return close to the pre-Mermaid baseline |
| Portable EXE size | Under 20 MB |

Additional targets:

- No page-level or toolbar horizontal overflow at the minimum window size.
- Interactive typing must remain responsive on a 10 MB plain-text file.
- The application must remain usable with a 32 MB UTF-8 text file if the same
  file-size limit is retained.
- Startup should not first paint a default-sized white window and then resize.
  Read the saved window size before the first visible frame.
- Do not use `EmptyWorkingSet`, `SetProcessWorkingSetSize`, or similar trimming
  tricks as a substitute for real memory reduction.

## 4. Explicit Non-Goals

Do not add:

- Account or sign-in
- AI or model providers
- Git integration
- Integrated terminal
- Collaboration
- Shared workspaces
- Project explorer or language-server panels
- Remote development
- WSL project sessions
- Telemetry or background network services

## 5. Current Simple Editor Feature Inventory

### 5.1 Application Shell

- Windows-first, single-window editor
- Frameless/custom title bar
- Custom application menu
- Custom tab bar
- Custom minimize, maximize/restore, and close controls
- Window is hidden during startup until settings and saved size are applied
- Minimum window size: 640 x 480 logical pixels
- Default window size: 1200 x 800 logical pixels
- Last normal window size is restored after restart
- Maximized windows retain the previous normal size when restored
- Empty tab-bar space acts as a window-drag region
- Right-click menu is disabled on the window-drag region
- Narrow layout activates at 860 px:
  - Editor and preview stack vertically
  - Splitter becomes horizontal
  - Some top-bar controls are reduced
- Light and dark themes
- English and Traditional Chinese UI
- Loading screen while the workspace is restored
- Toast-style error messages

### 5.2 File Handling

- Native Windows Open dialog
- Native Windows Save and Save As dialogs
- Open With integration in the installed Windows build
- Drag-and-drop file opening
- Command-line file opening
- Duplicate absolute-path opens focus the existing tab
- Maximum text-file size: 32 MB
- Files must be readable as UTF-8
- Saving writes UTF-8 text
- Save As chooses filters based on the suggested file name
- Saving creates the destination parent directory when needed
- Existing files are overwritten by Save
- Save does not add a BOM
- File names are displayed without the full path in tabs
- Full path is available in the status bar, tooltip, and context menu
- Windows extended path prefixes are hidden in UI display paths

Supported file-picker extensions:

```text
txt, md, markdown, log, json, js, jsx, ts, tsx, css, html,
py, rs, cpp, c, h, hpp, yaml, yml, sql, sh, bash, ps1
```

An All Files option is also available.

### 5.3 Startup Files and Single Instance

- Two behavior modes:
  - `single`: one process and one window; later file-open requests become tabs
  - `multi`: independent processes and windows
- Single-instance mode is read from settings before the Tauri runtime starts.
- A second instance focuses the existing window.
- Relative command-line paths are resolved from the process working directory.
- Only existing regular files are accepted.
- Command-line arguments beginning with `-` are ignored.
- Paths are canonicalized before being passed to the UI.

The native rewrite should use a named mutex and local IPC, or an equivalent
single-instance mechanism, if `single` mode is implemented.

### 5.4 Tabs

- Open multiple files and untitled documents
- Active-tab highlighting
- Dirty indicator dot
- Close button per tab
- Middle-click closes a tab
- Dirty tabs show a confirmation before tab close
- Confirmation offers:
  - Cancel
  - Close without saving
- App/window close does not use the tab-close confirmation; unsaved work is
  restored from the workspace session instead
- Last closed tab falls back to the next available nearby tab
- Closing the final tab shows the empty-state screen
- Empty state offers Open File and New File
- New untitled files have no extension
- Initial untitled names:
  - `untitled`
  - `untitled-2`
  - `untitled-3`
- Tab names can be renamed by:
  - F2
  - Double-clicking the tab name
  - The Rename item in the tab context menu
- Rename rejects empty names, `.`, `..`, slash, and backslash
- Renaming an existing file updates the path and tab name
- Rename refuses to overwrite an existing file
- Tabs can be reordered with drag and drop
- Drop position is shown before or after the target tab
- Overflowing tabs scroll horizontally
- Left and right overflow buttons scroll the tab strip
- When tabs overflow, an Open Tabs list button appears
- The Open Tabs list supports text filtering by name and full path
- Enter selects the first matching tab
- Tabs occupy only their content width; remaining tab-bar width remains
  available for moving the window

### 5.5 Tab Context Menu

The tab right-click menu contains:

- Close
- Close Other Tabs
- Close Tabs to the Right
- Close Saved Tabs
- Copy Full Path
- Open Containing Folder
- Rename

Path actions are disabled for unsaved untitled tabs.

### 5.6 Editor

- CodeMirror 6 behavior currently; replace with a native editing surface
- UTF-8 content
- Line numbers
- Active-line highlighting
- Active-line gutter highlighting
- Selection rendering
- Multiple selections
- Rectangular selection
- Bracket matching
- Auto-indent on input
- Tab indentation
- Code folding and fold gutter
- Search and replace panel
- Search-match highlighting
- Selection-match highlighting
- Undo/Redo history
- Word wrap toggle
- Configurable tab width
- Configurable editor font family
- Configurable editor font size
- Configurable line height
- Go to source line from Markdown preview
- Cursor position and scroll position are preserved per tab
- New tabs receive focus
- Status bar reports line, column, language, UTF-8, and zoom

Native replacement must preserve at minimum:

- Insert, delete, selection, clipboard, and drag text
- Undo/Redo
- Find and replace
- Go to line
- UTF-8 surrogate-pair-safe cursor movement
- Windows IME and Traditional Chinese input
- High-DPI rendering
- Stable cursor and scroll behavior

### 5.7 Syntax Highlighting

Required language mappings:

| Extensions | Language |
| --- | --- |
| `md`, `markdown` | Markdown |
| `js`, `jsx` | JavaScript / JSX |
| `ts`, `tsx` | TypeScript / TSX |
| `json` | JSON |
| `html`, `htm`, `xml` | HTML / XML |
| `css` | CSS |
| `py` | Python |
| `rs` | Rust |
| `c`, `h` | C / C header |
| `cpp`, `cxx`, `cc`, `hpp` | C++ / C++ header |
| `yaml`, `yml` | YAML |
| `sql` | SQL |
| `sh`, `bash`, `zsh` | Shell |
| `ps1` | PowerShell |
| other | Plain Text |

The status bar uses the same mapping for its language label.

### 5.8 Markdown Preview

- Preview is available only for `.md` and `.markdown`
- Preview visibility can be toggled
- Switching between Markdown and non-Markdown tabs changes preview
  availability
- GFM support
- Headings, paragraphs, lists, ordered lists, blockquotes, links, images,
  inline code, fenced code blocks, horizontal rules, details, definition
  lists, and task lists
- Task-list checkboxes are read-only
- Syntax-highlighted fenced code blocks
- External links open in the system browser
- Maximum content width is configurable
- Preview font family and font size are configurable
- Light and dark rendering
- Right-click menu is disabled inside the preview

### 5.9 GFM Tables

- Left, center, and right column alignment
- Header remains sticky while the table scrolls vertically where supported
- Zebra-striped body rows
- Row hover state
- Wide tables scroll horizontally inside their own wrapper
- No page-level horizontal overflow from a wide table
- Header and final-column borders are visually handled
- Inline code styling inside table cells
- Narrow layout reduces table font size and cell padding

### 5.10 Editor Preview Source Synchronization

This is click-based, not continuous scroll tracking:

- Clicking in the editor moves the preview to the nearest rendered source line.
- Clicking in the preview moves the editor to the nearest source line.
- Preview source elements carry a Markdown source-line number.
- If no exact preview element is found, the nearest visible source block is
  used.

Do not implement costly continuous bidirectional scroll synchronization unless
explicitly requested.

### 5.11 Editor/Preview Split

- Shared split ratio for the current layout
- Default ratio: 50/50
- Clamp range: 25% to 75%
- Wide layout uses a vertical divider and horizontal split
- Compact layout uses a horizontal divider and vertical split
- Pointer drag resizes
- Double-click resets to 50/50
- Focused divider supports keyboard arrows in 2% increments
- Home resets the split to 50/50
- Both panes are independently scrollable

### 5.12 Mermaid

- Fenced code blocks with `language-mermaid` render as diagrams
- Mermaid is loaded only when a diagram must be rendered
- Mermaid strict security level
- Light and dark Mermaid themes
- Initial zoom fits the diagram width
- Minimum diagram zoom: 35%
- Maximum diagram zoom: 250%
- Zoom step: 15%
- Zoom controls:
  - Zoom out
  - Zoom in
  - Fit to width
  - Reset to 100%
- Ctrl+mouse wheel zooms a diagram
- Loading and error states are visible
- Diagram rendering errors do not crash the preview
- Diagrams use an eight-color accent palette when nodes do not provide custom
  styling
- Custom Mermaid node styling is preserved
- Diagram click can synchronize the editor to its source line

The native rewrite should not reproduce Mermaid’s layout engine from scratch.
Use WebView2 as an optional renderer unless a proven native renderer becomes
available.

### 5.13 Theme and Zoom

- First run without saved settings follows the Windows light/dark preference.
- Invalid saved theme values normalize to dark.
- Theme can be toggled from the application menu.
- Whole-UI zoom range: 50% to 200%
- Zoom step: 10%
- Shortcuts:
  - `Ctrl++` or `Ctrl+=`: zoom in
  - `Ctrl+-`: zoom out
  - `Ctrl+0`: reset to 100%
- Status bar shows the current zoom percentage.

For a native UI, prefer scaling fonts and layout metrics rather than scaling a
WebView.

### 5.14 Settings File

Location:

```text
%APPDATA%\com.yshung.simpleeditor\settings.json
```

Settings are UTF-8 JSON.

Current schema example:

```json
{
  "version": 5,
  "uiLanguage": "zh-TW",
  "themeMode": "dark",
  "previewVisible": true,
  "splitPercent": 0.5,
  "zoomLevel": 1,
  "editor": {
    "fontFamily": "Cascadia Code, Consolas, monospace",
    "fontSize": 14.5,
    "lineHeight": 1.65,
    "tabSize": 2,
    "wordWrap": false
  },
  "preview": {
    "fontFamily": "Charter, Georgia, serif",
    "fontSize": 16,
    "maxWidth": 780
  },
  "behavior": {
    "restoreUnsavedTabs": true,
    "confirmOnClose": true,
    "instanceMode": "multi"
  },
  "window": {
    "width": 1200,
    "height": 800
  }
}
```

Validation and normalization:

- File must contain one valid JSON object
- Comments and trailing commas are not supported
- Invalid field types use defaults
- Numeric values are clamped
- `tabSize` and window dimensions are rounded to integers
- Font families are trimmed and limited to 240 characters
- Empty or invalid font families use defaults
- Unknown fields are removed when settings are saved
- `version` is normalized to `5`

Parameter reference:

| Parameter | Values | Default |
| --- | --- | --- |
| `version` | `5` | `5` |
| `uiLanguage` | `en`, `zh-TW` | `en` |
| `themeMode` | `light`, `dark` | System theme on first run |
| `previewVisible` | boolean | `true` |
| `splitPercent` | `0.25` to `0.75` | `0.5` |
| `zoomLevel` | `0.5` to `2.0` | `1.0` |
| `editor.fontFamily` | string | `Cascadia Code` |
| `editor.fontSize` | `10` to `32` | `14.5` |
| `editor.lineHeight` | `1.1` to `2.4` | `1.65` |
| `editor.tabSize` | integer `1` to `8` | `2` |
| `editor.wordWrap` | boolean | `false` |
| `preview.fontFamily` | string | `Charter, Georgia, serif` |
| `preview.fontSize` | `10` to `32` | `16` |
| `preview.maxWidth` | `420` to `1600` | `780` |
| `behavior.restoreUnsavedTabs` | boolean | `true` |
| `behavior.confirmOnClose` | boolean | `true` |
| `behavior.instanceMode` | `single`, `multi` | `multi` |
| `window.width` | integer `640` to `10000` | `1200` |
| `window.height` | integer `480` to `10000` | `800` |

Settings behavior:

- Menu > Settings opens the real settings file in an editor tab.
- Saving that tab parses, normalizes, writes, and applies the settings.
- Most settings apply immediately.
- `behavior.instanceMode` is read only when a process starts.
- Window dimensions are persisted on close.
- Do not autosave the settings file while its editor tab is dirty.

### 5.15 Unsaved Workspace Recovery

Native file:

```text
%APPDATA%\com.yshung.simpleeditor\workspace-session.json
```

The current app also caches a workspace snapshot in WebView local storage and
chooses the newest valid snapshot. A native rewrite only needs one durable
native session file, but an import path for the current file is useful.

Current workspace schema:

```json
{
  "version": 1,
  "updatedAt": 1760000000000,
  "tabs": [
    {
      "id": "uuid",
      "path": "C:\\notes\\example.md",
      "name": "example.md",
      "content": "current text",
      "savedContent": "last saved text",
      "cursor": 12,
      "scrollTop": 340
    }
  ],
  "activeTabId": "uuid",
  "themeMode": "dark",
  "previewVisible": true,
  "splitPercent": 0.5,
  "zoomLevel": 1
}
```

Recovery requirements:

- Persist all open tabs
- Persist current and last-saved content
- Persist active tab
- Persist cursor and scroll position per tab
- Persist theme, preview visibility, split ratio, and zoom
- Persist after edits with a short debounce
- Save immediately on normal app exit where possible
- Use atomic file replacement to avoid corrupting settings/session files
- If `restoreUnsavedTabs` is false, restore only clean tabs
- If no tabs are restored, create one empty untitled tab
- Ignore invalid snapshots and fall back safely

Current implementation saves the workspace after a 350 ms debounce and saves
settings after a 250 ms debounce when the settings tab is not dirty.

### 5.16 Menus

Application menu:

- Open File
- New File
- Save
- Settings
- Toggle Light/Dark Theme
- Exit

The application menu uses compact text, consistent padding, visible shortcuts,
and separators between action groups. It should use the same visual language as
the tab context menu.

### 5.17 Keyboard Shortcuts

Application shortcuts:

| Shortcut | Action |
| --- | --- |
| `Ctrl+O` | Open file |
| `Ctrl+N` | New file |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+,` | Open settings |
| `Ctrl+W` | Close active tab |
| `Ctrl++`, `Ctrl+=` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |
| `F2` | Rename active tab |
| `Alt+F4` | Close window |

Menu and dialog behavior:

- Escape closes a menu, tab list, context menu, or close-confirmation dialog.

Required editor shortcuts from the existing ecosystem:

- Undo/Redo
- Cut/Copy/Paste
- Select All
- Find and replace
- Go to line
- Fold/unfold
- Indent/outdent
- Tab indentation

The native editor should document its final keymap so Windows behavior remains
consistent with the old application.

### 5.18 Status Bar

Displays:

- Full display path, or `Not saved yet`
- Language label
- Current line and column
- `UTF-8`
- Current zoom percentage

### 5.19 Portable Distribution and Windows Integration

- Portable Windows x64 executable
- No installer required to run
- WebView2 is optional in the new architecture and required only for Mermaid
- Optional install script can copy the EXE to `C:\PortableApps\SimpleEditor`
- Optional Open With registration for:
  - `.txt`
  - `.md`
  - `.markdown`
  - `.log`
- Optional desktop and Start menu shortcuts
- Uninstall script removes the optional registration and shortcuts
- CI release build enforces a 20 MB executable limit

For the new project, keep the application self-contained. Do not install a
background service, scheduled task, or startup task.

## 6. Recommended Native Component Boundaries

### 6.1 App Shell

Responsibilities:

- Window creation and first-paint sizing
- Custom title bar and window controls
- Menus and keyboard commands
- Tab model
- Splitter and layout
- Theme and zoom
- Error presentation

### 6.2 Document Model

Responsibilities:

- Stable tab/document ID
- Display name and path
- Current content
- Saved content or durable dirty-state tracking
- Cursor and anchor positions
- Scroll position
- Encoding and line-ending metadata
- File timestamps and optional external-change detection

Prefer one model shared by tabs and the native editor control. Avoid cloning
large 32 MB strings between UI and persistence layers.

### 6.3 Editor Adapter

Wrap Scintilla behind an internal interface so UI and tests do not call raw
messages everywhere. Required operations:

- Load/save document text
- Set language lexer
- Set theme
- Set font, tab width, word wrap
- Read cursor, selection, and scroll
- Restore cursor and scroll
- Scroll to line
- Find/replace
- Undo/Redo
- Determine dirty state

### 6.4 Markdown Pipeline

Recommended components:

- Rust parser with GFM extensions
- Explicit source-line mapping on rendered blocks
- Native layout and painting for text, lists, tables, code, tasks, and links
- Lazy image decoding
- Cache parsed preview, invalidate only when the document changes

The preview should be virtualized or block-based for large Markdown files.
Do not rebuild the full preview on unrelated cursor movement.

### 6.5 Mermaid Adapter

Interface:

- Detect Mermaid fences
- Request render by source hash and theme
- Return SVG, loading state, or error
- Expose zoom and fit-to-width
- Destroy renderer processes when no longer needed

Cache keys should include source text hash and light/dark theme.

### 6.6 Settings and Session Store

Use a dedicated storage module:

- Read, validate, normalize, and migrate settings
- Read and validate session snapshots
- Atomic temporary-file + replace writes
- Back up a corrupt file before replacing it
- Keep schema versions

Do not spread raw JSON parsing across UI modules.

## 7. Phased Delivery Plan

### Phase 0: PoC and Measurements

Implement only:

- Native window
- Scintilla editor
- Open/save a UTF-8 file
- One tab
- Basic syntax highlighting
- A measured idle process tree

Gate:

- Private Working Set below 35 MB with one small text file
- EXE below 15 MB for the PoC
- Chinese IME input works
- Typing and scrolling are smooth

Stop and reassess if this gate fails.

### Phase 1: Editor Core

- Multi-tab model
- New/open/save/save as
- Dirty indicators
- Close confirmation
- Rename
- Tab drag reorder and middle-click close
- Syntax highlighting for all required languages
- Search/replace, folding, word wrap
- Session/settings persistence

### Phase 2: Native Markdown Preview

- Markdown parser and block layout
- GFM tables and alignment
- Wide-table scrolling
- Task lists, links, code blocks
- Click-to-source synchronization
- Resizable split
- Theme/font settings

Measure idle memory and preview memory before adding Mermaid.

### Phase 3: Mermaid Integration

- Mermaid-fence detection
- On-demand WebView2 renderer
- Strict security mode
- Theme and accent palette
- Zoom/fit/reset controls
- Renderer destruction and cache behavior
- Measure renderer creation, steady state, and shutdown

### Phase 4: Windows Integration and Release

- Single/multi instance
- Command-line and Open With
- Drag and drop
- Window-size restoration before first paint
- Optional install/uninstall scripts
- Portable packaging and size check
- CI build and release workflow

## 8. Acceptance Test Matrix

### Files

- Open UTF-8 text with LF, CRLF, and mixed line endings
- Reject or report invalid UTF-8 clearly
- Open a file at the 32 MB limit
- Save an existing file
- Save As with `.txt`, `.md`, and an extensionless name
- Drag multiple files into the window
- Open the same path twice and verify one tab
- Open a file from Explorer/Open With

### Tabs and Recovery

- Open at least 12 tabs
- Verify overflow arrows and tab picker
- Filter tabs by partial path and name
- Reorder tabs
- Middle-click clean and dirty tabs
- Close other, right, and saved tabs
- Rename existing and untitled files
- Edit multiple tabs, force-close the process, restart, and restore all content,
  cursor, and scroll
- Restart with `restoreUnsavedTabs=false`
- Restart with a corrupted session file

### Settings

- Start with no settings file
- Start with invalid JSON
- Start with invalid types and out-of-range numbers
- Change each font, size, wrap, language, theme, and split setting
- Verify live application after saving the settings tab
- Verify `instanceMode` changes after a full restart
- Verify window size restoration before the window becomes visible

### Markdown and Tables

- Heading, paragraph, lists, task list, blockquote, links, images, code blocks,
  and horizontal rule
- Left, center, and right table alignment
- Sticky table header
- Zebra rows
- Very wide table at narrow and wide window sizes
- Horizontal scroll remains inside the table
- External links open in the default browser
- Preview right-click does nothing
- Click editor then preview and preview then editor

### Mermaid

- Flowchart and at least one other Mermaid diagram family
- Invalid Mermaid syntax
- Multiple diagrams in one document
- Dark and light theme
- Zoom, fit, reset, and Ctrl+wheel
- Switch tabs while rendering
- Hide preview and verify WebView2 child processes exit
- Return to normal memory baseline after close

### Window and Layout

- Minimum 640 x 480 window
- 390 px-equivalent narrow layout
- No clipped menu text or controls
- No page-level horizontal overflow
- Maximize, restore, minimize, and close
- Drag the window using empty tab-bar space
- Right-click on drag area does not open a menu

## 9. Migration from the Existing Project

Reusable concepts:

- Settings schema v5 and normalization rules
- Workspace schema v1
- Language-to-extension mapping
- Markdown feature list and table behavior
- Mermaid palettes and zoom ranges
- Keyboard shortcuts and menu labels
- Windows install/uninstall registration behavior

Not directly reusable:

- React components
- CodeMirror extensions
- WebView-specific zoom
- `react-markdown`, `remark-gfm`, and `rehype-highlight`
- Current Tauri command bridge

The `rust-anything` project may be used to record and verify behavior of pure
logic such as settings normalization, path handling, line mapping, Markdown
feature decisions, and session migration. It does not replace native UI work
and does not automatically translate React or CodeMirror.

## 10. Key Engineering Risks

1. Mermaid is the largest risk. A persistent Chromium runtime defeats the
   low-memory goal.
2. Implementing a rich Markdown preview natively is substantial work,
   especially tables, images, selection, accessibility, and scrolling.
3. Scintilla integration must be verified for Unicode, IME, high DPI, and
   non-BMP characters.
4. Window sizing must be applied before the first visible frame to avoid a
   default-size flash.
5. Settings and session writes must be atomic to avoid data loss.
6. Single-instance file forwarding must work for Explorer/Open With as well as
   launching the executable directly.
7. Memory measurements must use the complete process tree and distinguish
   Working Set from Private Working Set and Private Bytes.

## 11. Definition of Done

The rewrite is complete when:

- All Phase 1-4 features pass their acceptance tests.
- The application does not create WebView2 processes at idle.
- Private Working Set targets are met with documented measurements.
- Settings and unsaved workspace recovery survive normal restarts and forced
  termination.
- Traditional Chinese IME input, selection, clipboard, and undo are reliable.
- Mermaid renderer processes terminate when previews are hidden or closed.
- The portable executable stays below 20 MB.
- No unintended background process, service, scheduled task, or startup entry
  is created.
