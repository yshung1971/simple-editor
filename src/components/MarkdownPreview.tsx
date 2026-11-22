import { ExternalLink } from "lucide-react";
import type { Element, Root } from "hast";
import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { openExternalUrl } from "../lib/platform";
import type { ThemeMode } from "../types";
import { MermaidDiagram } from "./MermaidDiagram";

type MarkdownPreviewProps = {
  content: string;
  sourceLine: number;
  themeMode: ThemeMode;
};

const SOURCE_LINE_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "pre",
  "table",
  "blockquote",
  "hr",
  "details",
  "summary",
  "dt",
  "dd",
  ".mermaid-block",
].join(",");

function rehypeSourceLines() {
  return (tree: Root) => {
    const visit = (node: Root | Element) => {
      if (node.type === "element" && node.position) {
        node.properties = {
          ...node.properties,
          "data-source-line": node.position.start.line,
        };
      }
      node.children.forEach((child) => {
        if (child.type === "element") {
          visit(child);
        }
      });
    };

    visit(tree);
  };
}

function hasMermaidBlock(children: ReactNode) {
  return Children.toArray(children).some(
    (child) =>
      isValidElement(child) &&
      (
        child.props as {
          "data-mermaid-block"?: string;
        }
      )["data-mermaid-block"] === "true",
  );
}

export function MarkdownPreview({
  content,
  sourceLine,
  themeMode,
}: MarkdownPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const components: Components = {
    pre: ({ children, ...props }) =>
      hasMermaidBlock(children) ? (
        <>{children}</>
      ) : (
        <pre {...props}>{children}</pre>
      ),
    code: ({ className, children, ...props }) => {
      if (className?.split(" ").includes("language-mermaid")) {
        const mermaidSourceLine = (
          props as Record<string, unknown>
        )["data-source-line"] as string | number | undefined;
        return (
          <MermaidDiagram
            chart={String(children).replace(/\n$/, "")}
            sourceLine={mermaidSourceLine}
            themeMode={themeMode}
          />
        );
      }

      return (
        <code {...props} className={className}>
          {children}
        </code>
      );
    },
    table: ({ children, ...props }) => (
      <div className="table-wrap">
        <table {...props}>{children}</table>
      </div>
    ),
    a: ({ href, children, ...props }) => (
      <a
        {...props}
        href={href}
        onClick={(event) => {
          event.preventDefault();
          if (href) {
            void openExternalUrl(href);
          }
        }}
      >
        {children}
        <ExternalLink
          aria-hidden="true"
          className="external-link-icon"
          size={12}
        />
      </a>
    ),
    input: ({ type, checked, ...props }: ComponentProps<"input">) => (
      <input
        {...props}
        type={type}
        checked={checked}
        disabled
        readOnly
      />
    ),
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const preview = previewRef.current;
      if (!preview) {
        return;
      }

      const anchors = Array.from(
        preview.querySelectorAll<HTMLElement>(SOURCE_LINE_SELECTOR),
      );
      let target: HTMLElement | null = null;
      let targetLine = 0;

      for (const candidate of anchors) {
        const line = Number(candidate.dataset.sourceLine);
        if (
          Number.isFinite(line) &&
          line <= sourceLine &&
          line >= targetLine
        ) {
          target = candidate;
          targetLine = line;
        }
      }

      if (!target) {
        preview.scrollTop = 0;
        return;
      }

      const previewTop = preview.getBoundingClientRect().top;
      const targetTop =
        target.getBoundingClientRect().top -
        previewTop +
        preview.scrollTop -
        16;
      preview.scrollTop = Math.max(0, targetTop);
    });

    return () => cancelAnimationFrame(frame);
  }, [content, sourceLine]);

  return (
    <div
      className="markdown-preview"
      ref={previewRef}
      aria-label="Markdown preview"
    >
      <div className="markdown-preview-inner">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[
            [rehypeHighlight, { detect: false }],
            rehypeSourceLines,
          ]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

