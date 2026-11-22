import { ExternalLink } from "lucide-react";
import type { Element as HastElement, Root as HastRoot } from "hast";
import {
  Children,
  forwardRef,
  isValidElement,
  memo,
  useImperativeHandle,
  useRef,
  type ComponentProps,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { openExternalUrl } from "../lib/platform";
import type { ThemeMode } from "../types";
import { MermaidDiagram } from "./MermaidDiagram";

export type MarkdownPreviewHandle = {
  scrollToSourceLine: (sourceLine: number) => void;
};

type MarkdownPreviewProps = {
  content: string;
  onSourceLineClick: (sourceLine: number) => void;
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
  return (tree: HastRoot) => {
    const visit = (node: HastRoot | HastElement) => {
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

function sourceLineAtClick(
  preview: HTMLElement,
  target: EventTarget | null,
  clientY: number,
) {
  if (target instanceof Element) {
    const closest = target.closest<HTMLElement>(SOURCE_LINE_SELECTOR);
    if (closest && preview.contains(closest)) {
      const line = Number(closest.dataset.sourceLine);
      if (Number.isFinite(line)) {
        return line;
      }
    }
  }

  let nearest: HTMLElement | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const anchors = preview.querySelectorAll<HTMLElement>(SOURCE_LINE_SELECTOR);
  for (const anchor of anchors) {
    const distance = Math.abs(
      anchor.getBoundingClientRect().top - clientY,
    );
    if (distance < nearestDistance) {
      nearest = anchor;
      nearestDistance = distance;
    }
  }

  if (!nearest) {
    return null;
  }
  const line = Number(nearest.dataset.sourceLine);
  return Number.isFinite(line) ? line : null;
}

const MarkdownPreviewComponent = forwardRef<
  MarkdownPreviewHandle,
  MarkdownPreviewProps
>(function MarkdownPreview(
  { content, onSourceLineClick, themeMode },
  ref,
) {
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

  useImperativeHandle(
    ref,
    () => ({
      scrollToSourceLine(sourceLine) {
        const preview = previewRef.current;
        if (!preview) {
          return;
        }

        const anchors = preview.querySelectorAll<HTMLElement>(
          SOURCE_LINE_SELECTOR,
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
      },
    }),
    [],
  );

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest("a, button, input, select, textarea")
    ) {
      return;
    }

    const sourceLine = sourceLineAtClick(
      event.currentTarget,
      event.target,
      event.clientY,
    );
    if (sourceLine !== null) {
      onSourceLineClick(sourceLine);
    }
  };

  return (
    <div
      className="markdown-preview"
      ref={previewRef}
      aria-label="Markdown preview"
      onClick={handleClick}
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
});

export const MarkdownPreview = memo(MarkdownPreviewComponent);

