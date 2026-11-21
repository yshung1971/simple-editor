# Simple Editor

A Windows-first text and Markdown editor built with Tauri 2, React, and
CodeMirror 6.

## Features

- Open, edit, and save UTF-8 text files
- Tabs with dirty-state indicators
- Automatic unsaved workspace recovery
- Syntax highlighting for common text and programming formats
- GFM Markdown preview with aligned pipe tables, sticky headers, and
  horizontal scrolling for wide tables
- Light and dark themes
- Open With and command-line file opening
- No account, AI, Git, terminal, project system, or language-server panels

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

