import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";

export function languageExtension(name: string): Extension {
  const extension = name.toLowerCase().split(".").pop() ?? "";

  switch (extension) {
    case "md":
    case "markdown":
      return markdown();
    case "js":
    case "jsx":
      return javascript({ jsx: true });
    case "ts":
    case "tsx":
      return javascript({ jsx: extension === "tsx", typescript: true });
    case "json":
      return json();
    case "html":
    case "htm":
    case "xml":
      return html();
    case "css":
      return css();
    case "py":
      return python();
    case "rs":
      return rust();
    case "c":
    case "h":
    case "cpp":
    case "cxx":
    case "cc":
    case "hpp":
      return cpp();
    case "yaml":
    case "yml":
      return yaml();
    case "sql":
      return sql();
    case "sh":
    case "bash":
    case "zsh":
      return StreamLanguage.define(shell);
    case "ps1":
      return StreamLanguage.define(powerShell);
    default:
      return [];
  }
}

export function isMarkdownFile(name: string) {
  return /\.(md|markdown)$/i.test(name);
}

export function languageLabel(name: string) {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  const labels: Record<string, string> = {
    md: "Markdown",
    markdown: "Markdown",
    js: "JavaScript",
    jsx: "JavaScript JSX",
    ts: "TypeScript",
    tsx: "TypeScript JSX",
    json: "JSON",
    html: "HTML",
    htm: "HTML",
    xml: "XML",
    css: "CSS",
    py: "Python",
    rs: "Rust",
    c: "C",
    h: "C header",
    cpp: "C++",
    cc: "C++",
    hpp: "C++ header",
    yaml: "YAML",
    yml: "YAML",
    sql: "SQL",
    sh: "Shell",
    bash: "Bash",
    ps1: "PowerShell",
    txt: "Plain Text",
    log: "Log",
  };
  return labels[extension] ?? "Plain Text";
}

