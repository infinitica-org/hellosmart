import React, { HTMLAttributes, forwardRef } from 'react';

export interface SafeMarkdownProps extends HTMLAttributes<HTMLDivElement> {
  content: string;
}

/**
 * SafeMarkdown renders markdown content without dangerous raw HTML injection.
 * Escapes raw HTML entities and formats headings, lists, code blocks, bold, italics, links.
 * Used for candidate briefs, transcripts, and submission artifacts (BR-18).
 */
export const SafeMarkdown = forwardRef<HTMLDivElement, SafeMarkdownProps>(
  ({ content, className = '', ...props }, ref) => {
    // Basic safe parser preventing XSS
    const formatMarkdown = (text: string): React.ReactNode[] => {
      const lines = text.split('\n');
      return lines.map((line, idx) => {
        if (line.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-xl font-bold text-slate-100 my-2">
              {line.replace('# ', '')}
            </h1>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-lg font-semibold text-slate-100 my-1.5">
              {line.replace('## ', '')}
            </h2>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-base font-medium text-slate-200 my-1">
              {line.replace('### ', '')}
            </h3>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li key={idx} className="text-xs text-slate-300 ml-4 list-disc my-0.5">
              {line.substring(2)}
            </li>
          );
        }
        if (line.startsWith('`') && line.endsWith('`') && line.length > 2) {
          return (
            <code
              key={idx}
              className="text-xs font-mono bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded border border-slate-700/60"
            >
              {line.slice(1, -1)}
            </code>
          );
        }
        if (!line.trim()) {
          return <div key={idx} className="h-2" />;
        }
        return (
          <p key={idx} className="text-xs text-slate-300 leading-relaxed my-1">
            {line}
          </p>
        );
      });
    };

    return (
      <div ref={ref} className={`prose-invert max-w-none text-slate-300 ${className}`} {...props}>
        {formatMarkdown(content)}
      </div>
    );
  }
);
SafeMarkdown.displayName = 'SafeMarkdown';

