import { ExternalLink } from "lucide-react";
import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { openExternalUrl } from "../lib/platform";

type MarkdownPreviewProps = {
  content: string;
};

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="markdown-preview" aria-label="Markdown preview">
      <div className="markdown-preview-inner">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { detect: false }]]}
          components={{
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
            input: ({
              type,
              checked,
              ...props
            }: ComponentProps<"input">) => (
              <input
                {...props}
                type={type}
                checked={checked}
                disabled
                readOnly
              />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

