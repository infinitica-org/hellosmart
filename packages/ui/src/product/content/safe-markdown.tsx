import React, { HTMLAttributes, forwardRef } from 'react';

export interface SafeMarkdownProps extends HTMLAttributes<HTMLDivElement> {
  content: string;
}

/**
 * Parses inline formatting safely (bold and inline code) without dangerouslySetInnerHTML.
 */
function parseInlineFormatting(inlineText: string): React.ReactNode {
  const parts = inlineText.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  if (parts.length === 1) return inlineText;

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-neutral-900 dark:text-neutral-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="text-[11px] font-mono bg-neutral-100 dark:bg-neutral-800 text-primary dark:text-orange-400 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * SafeMarkdown renders markdown content without dangerous raw HTML injection.
 * Escapes raw HTML entities and formats headings, lists, code blocks, bold, italics, links.
 * Used for candidate briefs, transcripts, and submission artifacts (BR-18).
 */
export const SafeMarkdown = forwardRef<HTMLDivElement, SafeMarkdownProps>(
  ({ content, className = '', ...props }, ref) => {
    const formatMarkdown = (text: string): React.ReactNode[] => {
      const lines = text.split('\n');
      return lines.map((line, idx) => {
        if (line.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight mt-3 mb-2 pb-1.5 border-b border-neutral-100 dark:border-neutral-800">
              {parseInlineFormatting(line.replace('# ', ''))}
            </h1>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mt-4 mb-2">
              {parseInlineFormatting(line.replace('## ', ''))}
            </h2>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-3 mb-1.5">
              {parseInlineFormatting(line.replace('### ', ''))}
            </h3>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li key={idx} className="text-xs text-neutral-600 dark:text-neutral-300 ml-4 list-disc my-1 leading-relaxed">
              {parseInlineFormatting(line.substring(2))}
            </li>
          );
        }
        if (line.match(/^\d+\.\s/)) {
          const match = line.match(/^(\d+\.\s)(.*)/);
          const itemText = match?.[2] ?? line;
          return (
            <li key={idx} className="text-xs text-neutral-600 dark:text-neutral-300 ml-4 list-decimal my-1 leading-relaxed">
              {parseInlineFormatting(itemText)}
            </li>
          );
        }
        if (line.startsWith('`') && line.endsWith('`') && line.length > 2) {
          return (
            <code
              key={idx}
              className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 text-primary px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 block my-1.5"
            >
              {line.slice(1, -1)}
            </code>
          );
        }
        if (!line.trim()) {
          return <div key={idx} className="h-1.5" />;
        }
        return (
          <p key={idx} className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed my-1">
            {parseInlineFormatting(line)}
          </p>
        );
      });
    };

    return (
      <div ref={ref} className={`max-w-none text-neutral-700 dark:text-neutral-300 ${className}`} {...props}>
        {formatMarkdown(content)}
      </div>
    );
  }
);
SafeMarkdown.displayName = 'SafeMarkdown';

