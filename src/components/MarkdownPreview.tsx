import { ExternalLink } from "lucide-react";
import { Children, isValidElement, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { openExternalUrl } from "../lib/platform";
import type { ThemeMode } from "../types";
import { MermaidDiagram } from "./MermaidDiagram";

type MarkdownPreviewProps = {
  content: string;
  themeMode: ThemeMode;
};

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
  themeMode,
}: MarkdownPreviewProps) {
  const components: Components = {
    pre: ({ children, ...props }) =>
      hasMermaidBlock(children) ? (
        <>{children}</>
      ) : (
        <pre {...props}>{children}</pre>
      ),
    code: ({ className, children, ...props }) => {
      if (className?.split(" ").includes("language-mermaid")) {
        return (
          <MermaidDiagram
            chart={String(children).replace(/\n$/, "")}
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

  return (
    <div className="markdown-preview" aria-label="Markdown preview">
      <div className="markdown-preview-inner">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { detect: false }]]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

