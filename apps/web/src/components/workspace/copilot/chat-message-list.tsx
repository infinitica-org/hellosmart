'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Copy, Check, ArrowDownToLine } from 'lucide-react';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
}

export interface ChatMessageListProps {
  messages: CopilotMessage[];
  isStreaming?: boolean | undefined;
  onInsertCode?: ((code: string) => void) | undefined;
  onSelectPrompt?: ((prompt: string) => void) | undefined;
  theme?: 'dark' | 'light' | undefined;
}

interface ParsedBlock {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

function parseContentBlocks(raw: string): ParsedBlock[] {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: ParsedBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: 'text',
        content: raw.slice(lastIndex, match.index),
      });
    }

    blocks.push({
      type: 'code',
      language: match[1] || 'plaintext',
      content: match[2] || '',
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    blocks.push({
      type: 'text',
      content: raw.slice(lastIndex),
    });
  }

  return blocks;
}

function CodeBlockRenderer({
  code,
  language,
  onInsertCode,
}: {
  code: string;
  language?: string | undefined;
  onInsertCode?: ((code: string) => void) | undefined;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-2.5 rounded-lg border border-neutral-700/80 bg-neutral-950 text-neutral-100 font-mono text-xs overflow-hidden shadow-xs">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-700/60 text-[11px] text-neutral-400 select-none">
        <span className="font-semibold uppercase tracking-wider text-primary text-[10px]">
          {language || 'code'}
        </span>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            title="Copy code to clipboard"
            data-testid="copilot-copy-code-btn"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>

          {onInsertCode && (
            <button
              type="button"
              onClick={() => onInsertCode(code)}
              className="flex items-center gap-1 text-primary hover:text-orange-400 font-medium transition-colors cursor-pointer bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded border border-primary/30"
              title="Insert snippet directly into active file in editor"
              data-testid="copilot-insert-code-btn"
            >
              <ArrowDownToLine className="w-3 h-3" />
              <span>Insert into Editor</span>
            </button>
          )}
        </div>
      </div>

      {/* Code Content */}
      <pre className="p-3 overflow-x-auto text-[11.5px] leading-relaxed text-neutral-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TextBlockRenderer({ content }: { content: string }) {
  const paragraphs = content.split('\n\n').filter(Boolean);

  return (
    <div className="space-y-2 text-xs leading-relaxed">
      {paragraphs.map((p, idx) => {
        const parts = p.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

        return (
          <p key={idx}>
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={pIdx} className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <code
                    key={pIdx}
                    className="font-mono text-[11px] px-1 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-primary border border-neutral-300/60 dark:border-neutral-700/80"
                  >
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
}

export function ChatMessageList({
  messages,
  isStreaming = false,
  onInsertCode,
  onSelectPrompt,
  theme = 'dark',
}: ChatMessageListProps) {
  const isLight = theme === 'light';
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Clean empty state matching Cursor/Agent screenshot
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none" data-testid="copilot-empty-state">
        {/* Dotted Rounded Squircle Icon from screenshot */}
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-xs transition-colors border ${
            isLight
              ? 'bg-orange-50 border-orange-200/80 text-primary'
              : 'bg-neutral-900 border-neutral-700/60 text-neutral-300'
          }`}
        >
          <svg
            className={`w-5 h-5 ${isLight ? 'text-primary' : 'text-neutral-400'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="3 3"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <path d="m9 12 2 2 4-4" strokeDasharray="none" />
          </svg>
        </div>

        {/* Heading */}
        <h3
          className={`text-base font-bold tracking-tight mb-2 ${
            isLight ? 'text-neutral-900' : 'text-white'
          }`}
        >
          What should we build?
        </h3>

        {/* Subtitle */}
        <p
          className={`max-w-xs text-xs leading-relaxed mb-6 ${
            isLight ? 'text-neutral-600' : 'text-neutral-400'
          }`}
        >
          The agent can read your code, run commands and make changes. Press send to start.
        </p>

        {/* Quick Suggestion Pills */}
        {onSelectPrompt && (
          <div className="flex flex-col gap-2.5 w-full max-w-xs">
            <button
              type="button"
              onClick={() => onSelectPrompt('Add a dark mode toggle to the settings page.')}
              className={`p-3.5 rounded-xl text-left text-xs border transition-all cursor-pointer shadow-2xs ${
                isLight
                  ? 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200/90 text-neutral-800'
                  : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-200 hover:border-neutral-700'
              }`}
            >
              <span className={`font-medium block ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`}>
                Add a dark mode toggle to the settings page.
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectPrompt('Implement execute method in src/solution.ts to pass verification tests.')}
              className={`p-3.5 rounded-xl text-left text-xs border transition-all cursor-pointer shadow-2xs ${
                isLight
                  ? 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200/90 text-neutral-800'
                  : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-200 hover:border-neutral-700'
              }`}
            >
              <span className={`font-medium block ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`}>
                Implement solution logic in src/solution.ts for test verification
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto p-4 space-y-4"
      data-testid="copilot-message-list"
    >
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        const isLast = index === messages.length - 1;
        const blocks = parseContentBlocks(msg.content);

        return (
          <div
            key={msg.id}
            className={`flex gap-3 text-xs ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            data-testid={`copilot-message-${msg.role}`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center border shadow-2xs ${
                isUser
                  ? isLight
                    ? 'bg-orange-50 border-orange-200 text-primary'
                    : 'bg-neutral-800 border-neutral-700 text-primary'
                  : 'bg-primary text-white border-primary shadow-xs'
              }`}
            >
              {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-2xs transition-colors ${
                isUser
                  ? isLight
                    ? 'bg-orange-500 text-white rounded-tr-none'
                    : 'bg-primary text-white rounded-tr-none'
                  : isLight
                    ? 'bg-white border border-neutral-200 text-neutral-800 rounded-tl-none'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none'
              }`}
            >
              {isUser ? (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              ) : (
                <div className="space-y-1">
                  {blocks.map((b, bIdx) =>
                    b.type === 'code' ? (
                      <CodeBlockRenderer
                        key={bIdx}
                        code={b.content}
                        language={b.language}
                        onInsertCode={onInsertCode}
                      />
                    ) : (
                      <TextBlockRenderer key={bIdx} content={b.content} />
                    )
                  )}

                  {isStreaming && isLast && (
                    <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
