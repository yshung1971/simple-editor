# Simple Editor

[English](#english) | [繁體中文](#繁體中文)

A focused Windows text and Markdown editor built with Tauri 2, React,
TypeScript, and CodeMirror 6.

Simple Editor is not a fork of Zed, VS Code, or another editor. It is a small,
standalone application for people who need a fast text and Markdown workflow
without a full IDE.

## English

### Why This Project Exists

I liked the speed and Markdown presentation of Zed, but I use VS Code for
software development and did not need another full IDE for ordinary text and
Markdown files.

For notes and documentation, the useful scope is much smaller: open a local
file quickly, edit text, highlight syntax, preview GFM Markdown and Mermaid
diagrams, and keep unsaved work recoverable. Accounts, AI, Git, terminals,
collaboration, project management, remote development, and WSL sessions are
unrelated to that workflow.

Trying to repeatedly reduce a full IDE to this narrow role made configuration
and behavior harder to predict. Simple Editor makes the narrow use case an
explicit product instead.

### What It Is

- A local Windows-first editor for plain text and Markdown
- Fast to launch and focused on one window with multiple tabs
- A Markdown viewer with GFM tables, aligned columns, wide-table scrolling,
  syntax-highlighted code blocks, task lists, and Mermaid diagrams
- A single portable EXE with no installer and no bundled Chromium
- A small codebase using the Windows WebView2 runtime

### What It Deliberately Excludes

- Accounts or sign-in
- AI features or model providers
- Git integration
- Integrated terminal
- Collaboration and shared workspaces
- Project management or language-server panels
- Remote development and WSL project sessions

### Features

- UTF-8 text-file opening and saving
- Native Windows open, Save As, and Open With integration
- Multiple tabs with dirty-state indicators and middle-click closing
- Searchable open-tabs picker for switching directly between files
- Configurable tab drag-and-drop ordering and overflow navigation
- Syntax highlighting for Markdown, JavaScript, TypeScript, JSON, HTML, CSS,
  Python, Rust, C, C++, YAML, SQL, Shell, and PowerShell
- Markdown preview with GFM tables, alignment, sticky headers, zebra rows, and
  horizontal scrolling for wide tables
- Mermaid diagrams with automatic accent colors and zoom controls
- Click-to-sync navigation between the Markdown source and preview
- Resizable editor/preview split
- Recover unsaved tabs, content, cursor positions, and scroll positions
- Light and dark themes
- Browser-style zoom with `Ctrl++`, `Ctrl+-`, and `Ctrl+0`
- Configurable single-instance or multi-instance behavior
- Drag-and-drop file opening and command-line file opening

### Requirements

- Windows 10 or Windows 11
- Microsoft Edge WebView2 Runtime

Windows 11 includes the WebView2 Evergreen Runtime. Most updated Windows 10
devices also have it, but installation is not guaranteed. The runtime is a
separate Windows component; the user does not need to use the Microsoft Edge
browser itself.

If WebView2 is missing or damaged, install it from Microsoft before running
Simple Editor:

[Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)

### Download And Run

End-user Windows builds are distributed through the
[Releases page](https://github.com/yshung1971/simple-editor/releases).

1. Download the Windows x64 ZIP.
2. Extract it.
3. Run `simple-editor.exe`.

No installer is required. The executable is currently unsigned, so Windows
SmartScreen or a file-origin warning may appear.

GitHub Actions artifacts are build outputs for CI verification; they are not
the recommended end-user download source.

### Portable Behavior

The application ships as a single EXE, but it is not a zero-footprint
application. Settings and unsaved workspace recovery data are stored in:

```text
%APPDATA%\com.yshung.simpleeditor\
```

See the [Settings reference](docs/SETTINGS.md) for every supported setting,
its default value, valid range, and restart requirements.

### Development

Requirements:

- Node.js 24 and npm
- Rust stable
- Microsoft C++ Build Tools and Windows SDK
- WebView2 Runtime

```powershell
npm ci
npm run dev
npm run tauri build -- --no-bundle
```

Windows release builds run in GitHub Actions and enforce a 20 MB portable
executable limit.

### Validation

```powershell
npm run check
npm run build
```

### License

MIT

## 繁體中文

### 為什麼要另外做這個 Editor

我喜歡 Zed 的速度感與 Markdown 呈現，但我平常寫程式的主力是 VS Code，並不需要
為了處理一般文字與 Markdown 再開一套完整 IDE。

筆記與文件真正需要的功能很少：快速開啟本機檔案、編輯文字、語法高亮、預覽 GFM
Markdown 與 Mermaid，並且在關閉後仍能恢復未儲存內容。登入、AI、Git、terminal、
協作、專案管理、遠端開發與 WSL session，和這個使用情境沒有直接關係。

把一套完整 IDE 反覆裁剪成這種單純用途，會讓設定與行為變得難以預測。Simple
Editor 的做法，是直接把這個窄而明確的需求做成獨立程式。

### 這是什麼

- 以 Windows 本機文字與 Markdown 為主的編輯器
- 啟動快速，以單一視窗和多分頁為中心
- 支援 GFM 表格、欄位對齊、寬表格水平捲動、程式碼高亮、工作清單與 Mermaid
- 單一 portable EXE，不需要安裝器，也不另外打包 Chromium
- 使用 Windows 內建 WebView2 Runtime 的小型獨立程式

### 刻意不包含的範圍

- 帳號或登入
- AI 功能或模型供應商
- Git 整合
- 內建 terminal
- 協作與共享 workspace
- 專案管理或 language-server 面板
- Remote development 與 WSL project session

### 功能

- UTF-8 純文字開檔與存檔
- Windows 原生開檔、另存新檔與 Open With 整合
- 多分頁、未存檔標記與滑鼠中鍵關閉
- 可搜尋的 Open Tabs 清單，可直接切換到指定檔案
- 可拖曳調整分頁順序與分頁溢出導覽
- 支援 Markdown、JavaScript、TypeScript、JSON、HTML、CSS、Python、Rust、
  C、C++、YAML、SQL、Shell 與 PowerShell 語法高亮
- GFM Markdown 預覽，支援表格對齊、sticky header、zebra rows 與寬表格水平捲動
- Mermaid 圖表、自動配色與縮放控制
- Markdown 原文與 Preview 的點擊雙向同步
- 可調整 Editor／Preview 分割比例
- 恢復未存分頁、內容、游標位置與捲動位置
- Light／dark theme
- 使用 `Ctrl++`、`Ctrl+-`、`Ctrl+0` 的瀏覽器式縮放
- 可設定 single-instance 或 multi-instance 行為
- 支援拖放開檔與命令列開檔

### 系統需求

- Windows 10 或 Windows 11
- Microsoft Edge WebView2 Runtime

Windows 11 已內含 WebView2 Evergreen Runtime。大多數有持續更新的 Windows 10
裝置也有，但不保證一定存在。WebView2 是獨立的 Windows 元件，使用者不需要實際
使用 Microsoft Edge 瀏覽器。

如果 WebView2 缺少或損壞，請先從 Microsoft 官方頁面安裝：

[Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)

### 下載與執行

提供給一般使用者的 Windows 版本會放在
[Releases 頁面](https://github.com/yshung1971/simple-editor/releases)。

1. 下載 Windows x64 ZIP。
2. 解壓縮。
3. 執行 `simple-editor.exe`。

不需要安裝器。目前執行檔尚未做程式碼簽章，因此 Windows SmartScreen 或檔案來源
警告可能出現。

GitHub Actions 的 artifact 是 CI 驗證產物，不建議當成一般使用者的正式下載來源。

### Portable 的實際含義

應用程式以單一 EXE 發佈，但不是完全不留下資料的軟體。設定與未存 workspace
恢復資料會存放在：

```text
%APPDATA%\com.yshung.simpleeditor\
```

完整參數、預設值、可接受範圍與重新啟動需求請見
[Settings reference](docs/SETTINGS.md)。

### 開發

需求：

- Node.js 24 與 npm
- Rust stable
- Microsoft C++ Build Tools 與 Windows SDK
- WebView2 Runtime

```powershell
npm ci
npm run dev
npm run tauri build -- --no-bundle
```

Windows release build 會在 GitHub Actions 執行，並限制 portable EXE 必須小於
20 MB。

### 驗證

```powershell
npm run check
npm run build
```

### 授權

MIT
