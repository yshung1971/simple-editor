# Simple Editor Settings Reference

Simple Editor stores user settings as a UTF-8 JSON document.

```text
%APPDATA%\com.yshung.simpleeditor\settings.json
```

For the current user, this normally resolves to:

```text
C:\Users\<user>\AppData\Roaming\com.yshung.simpleeditor\settings.json
```

Open **Menu > Settings** in the app to edit the active settings file directly.
Saving that tab applies most settings immediately. Some settings, such as
`behavior.instanceMode`, are read only when a new process starts.

## Version 5 Example

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

## Validation

- The file must contain one valid JSON object.
- JSON comments and trailing commas are not supported.
- Invalid boolean, number, or string field types use their default value.
- Numeric values outside the documented range are clamped to the nearest limit.
- `tabSize` and `window.width`/`window.height` are rounded to integers.
- Font-family values are trimmed and limited to 240 characters.
- Empty or invalid font-family values use the built-in default.
- Unknown fields are ignored when the settings are normalized and saved.
- `version` is always normalized to `5`.

## Root Parameters

| Parameter | Available values | Default | Description |
| --- | --- | --- | --- |
| `version` | `5` | `5` | Settings schema version. Older or unknown input is normalized to `5`. |
| `uiLanguage` | `"en"`, `"zh-TW"` | `"en"` | UI language. Invalid values fall back to English. |
| `themeMode` | `"light"`, `"dark"` | System theme on first run; `"dark"` for invalid input | Light or dark appearance. |
| `previewVisible` | `true`, `false` | `true` | Preview-panel preference. The current file type can still determine whether the preview is available. |
| `splitPercent` | `0.25` to `0.75` | `0.5` | Editor share of the workspace. The layout is horizontal on wide windows and vertical in the compact layout. |
| `zoomLevel` | `0.5` to `2.0` | `1.0` | Whole-UI zoom. `1.0` is 100% and `2.0` is 200%. Keyboard zoom changes by 0.1 per step. |

## Editor Parameters

| Parameter | Available values | Default | Description |
| --- | --- | --- | --- |
| `editor.fontFamily` | CSS font-family string | `"Cascadia Code"` | Editor font or font stack. |
| `editor.fontSize` | `10` to `32` | `14.5` | Editor font size in CSS pixels. |
| `editor.lineHeight` | `1.1` to `2.4` | `1.65` | Unitless line-height multiplier. |
| `editor.tabSize` | Integer `1` to `8` | `2` | Rendered tab width. Decimal input is rounded. |
| `editor.wordWrap` | `true`, `false` | `false` | Enables or disables word wrapping. |

## Preview Parameters

| Parameter | Available values | Default | Description |
| --- | --- | --- | --- |
| `preview.fontFamily` | CSS font-family string | `"Charter, Georgia, serif"` | Markdown preview font or font stack. |
| `preview.fontSize` | `10` to `32` | `16` | Markdown preview font size in CSS pixels. |
| `preview.maxWidth` | `420` to `1600` | `780` | Maximum Markdown content width in CSS pixels. |

## Behavior Parameters

| Parameter | Available values | Default | Description |
| --- | --- | --- | --- |
| `behavior.restoreUnsavedTabs` | `true`, `false` | `true` | Restores open tabs, unsaved content, cursor positions, and scroll positions after restart. |
| `behavior.confirmOnClose` | `true`, `false` | `true` | Shows the unsaved-content confirmation before closing dirty tabs. |
| `behavior.instanceMode` | `"single"`, `"multi"` | `"multi"` | `single` focuses the existing window and opens requested files as tabs. `multi` allows independent processes and windows. |

`instanceMode` is read before the Tauri application starts. Completely close all
Simple Editor processes before changing between `single` and `multi`.

## Window Parameters

| Parameter | Available values | Default | Description |
| --- | --- | --- | --- |
| `window.width` | Integer `640` to `10000` | `1200` | Last normal window width in logical pixels. The operating system and monitor layout can further constrain it. |
| `window.height` | Integer `480` to `10000` | `800` | Last normal window height in logical pixels. A maximized window retains the last normal size. |

## Applying Changes

- Most settings loaded from this file are applied when the app starts.
- Saving the file from Simple Editor's Settings tab applies most UI settings immediately.
- `behavior.instanceMode` requires a complete process restart.
- Window dimensions are also persisted automatically when the window is closed.
