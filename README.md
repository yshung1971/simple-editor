# Simple Editor

A Windows-first text and Markdown editor built with Tauri 2, React, and
CodeMirror 6.

## Features

- Open, edit, and save UTF-8 text files
- Compact top tab bar with a drag region and overflow navigation
- Frameless Windows layout with in-app minimize, maximize, and close controls
- Tabs with dirty-state indicators
- Application menu for opening, creating, saving, and switching themes
- Custom tab and Markdown preview context menu with native Save As
- Automatic unsaved workspace recovery
- Versioned user settings stored separately from unsaved documents
- Syntax highlighting for common text and programming formats
- GFM Markdown preview with aligned pipe tables, sticky headers, and
  horizontal scrolling for wide tables
- Mermaid diagrams with automatic accent colors, toolbar, and Ctrl+wheel zoom
- Resizable editor/preview split
- Browser-style zoom with Ctrl+plus, Ctrl+minus, and Ctrl+0
- Light and dark themes
- Open With, command-line file opening, and middle-click tab closing
- No account, AI, Git, terminal, project system, or language-server panels

## Configuration

Simple Editor stores versioned user settings outside the workspace. See the
[Settings reference](docs/SETTINGS.md) for the settings-file location,
supported parameters, defaults, ranges, and a complete JSON example.

## Requirements

- Windows 10 or 11
- Microsoft Edge WebView2 Runtime

WebView2 is included with current Windows installations.

## Development

```powershell
npm install
npm run dev
```

The browser development mode uses local file inputs and local storage. The
packaged Tauri app uses native file dialogs and an app-data workspace session.

## Validation

```powershell
npm run check
npm run build
```

Windows release builds run in GitHub Actions and enforce a 20 MB portable
executable limit.

## License

MIT

