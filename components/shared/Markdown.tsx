"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * Renders Markdown safely:
 *  - raw HTML in the text is NOT interpreted (react-markdown escapes it),
 *  - images are never rendered (they could leak data through the URL),
 *  - links only open when they start with http(s) and always use rel="noopener noreferrer".
 * Citation numbers like [1] become clickable chips when they match a real source.
 */
export function Markdown({
  content,
  validCitations,
  onCite,
}: {
  content: string;
  /** Citation numbers that exist as real sources. Other "[n]" text is left untouched. */
  validCitations?: number[];
  onCite?: (n: number) => void;
}) {
  const valid = new Set(validCitations ?? []);

  // Turn [n] into a link "#cite-n", but never inside code.
  const prepared = content
    .split(/(```[\s\S]*?```|`[^`\n]+`)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/\[(\d{1,2})\](?!\()/g, (match, n: string) =>
            valid.has(Number(n)) ? `[\\[${n}\\]](#cite-${n})` : match,
          ),
    )
    .join("");

  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={{
          img: () => null,
          a: ({ href, children }) => {
            if (href?.startsWith("#cite-")) {
              const n = Number(href.slice(6));
              return (
                <button
                  type="button"
                  onClick={() => onCite?.(n)}
                  aria-label={`Open source ${n}`}
                  className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/15 px-1 align-baseline text-xs font-semibold text-primary no-underline hover:bg-primary/25"
                >
                  {n}
                </button>
              );
            }
            if (href && /^https?:\/\//i.test(href)) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                  {children}
                </a>
              );
            }
            return <span>{children}</span>;
          },
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
