'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ArrowUp,
  Plus,
  ChevronDown,
  RotateCcw,
  Square,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { TokenBudgetGauge } from './token-budget-gauge';
import { ChatMessageList } from './chat-message-list';
import { useAiCopilot, type AiPolicyConfig } from '../../../hooks/workspace/use-ai-copilot';

export interface AiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  aiPolicy?: AiPolicyConfig | null | undefined;
  onInsertCode?: ((code: string) => void) | undefined;
  theme?: 'dark' | 'light' | undefined;
  width?: number | undefined;
}

export function AiCopilotDrawer({
  isOpen,
  onClose,
  workspaceId,
  aiPolicy,
  onInsertCode,
  theme = 'dark',
  width = 380,
}: AiCopilotDrawerProps) {
  const isLight = theme === 'light';
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Model & Effort selector state (matching Cursor / Agent UI)
  const availableModels = aiPolicy?.allowedModels && aiPolicy.allowedModels.length > 0
    ? aiPolicy.allowedModels
    : ['GPT-5', 'Claude 3.5 Sonnet', 'Gemini 1.5 Pro'];

  const [selectedModel, setSelectedModel] = useState<string>(availableModels[0] || 'GPT-5');
  const [effort, setEffort] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isEffortMenuOpen, setIsEffortMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    messages,
    isStreaming,
    tokensUsed,
    tokenCap,
    isCapReached,
    aiEnabled,
    error,
    sendMessage,
    clearHistory,
    stopGeneration,
  } = useAiCopilot({
    workspaceId,
    aiPolicy,
  });

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming || !aiEnabled || isCapReached) return;
    const text = inputText;
    setInputText('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && aiEnabled && !isCapReached) {
      textareaRef.current?.focus();
    }
  }, [isOpen, aiEnabled, isCapReached]);

  if (!isOpen) return null;

  return (
    <aside
      style={{ width: `${width}px` }}
      className={`h-full flex flex-col border-l shrink-0 relative overflow-hidden select-none transition-colors ${
        isLight
          ? 'bg-white border-neutral-200 text-neutral-800'
          : 'bg-neutral-950 border-neutral-800/80 text-neutral-100'
      }`}
      data-testid="ai-copilot-drawer"
    >
      {/* Top Header matching Cursor Agent screenshot */}
      <div
        className={`shrink-0 flex items-center justify-between px-4 py-3 border-b select-none transition-colors ${
          isLight
            ? 'bg-white border-neutral-200/90 text-neutral-900'
            : 'bg-neutral-950 border-neutral-800/80 text-white'
        }`}
      >
        <div>
          <h2
            className={`font-bold text-sm tracking-tight ${
              isLight ? 'text-neutral-900' : 'text-white'
            }`}
          >
            New Thread
          </h2>
          <p
            className={`text-xs mt-0.5 ${
              isLight ? 'text-neutral-500' : 'text-neutral-400'
            }`}
          >
            Ask the agent to change your code.
          </p>
        </div>

        {/* Action Buttons: Reset Thread & Close */}
        <div className="flex items-center gap-1.5">
          {aiEnabled && (
            <button
              type="button"
              onClick={clearHistory}
              title="Reset Thread"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                isLight
                  ? 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
              data-testid="copilot-clear-history-btn"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close Copilot Panel"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isLight
                ? 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            data-testid="copilot-close-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Token Budget Gauge (BR-15) */}
      {aiEnabled && (
        <div className="px-4 py-2 shrink-0 border-b border-neutral-200/90 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-900/40">
          <TokenBudgetGauge
            tokensUsed={tokensUsed}
            tokenCap={tokenCap}
            theme={theme}
          />
        </div>
      )}

      {/* Content Area */}
      {!aiEnabled ? (
        /* Disabled State (BR-14) */
        <div
          className="flex-1 flex flex-col items-center justify-center p-6 text-center"
          data-testid="copilot-disabled-banner"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-3 shadow-xs">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 mb-2">
            <Lock className="w-3 h-3" />
            AI Assistance is turned OFF for this task
          </span>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs leading-relaxed mt-1">
            The employer has configured this assessment with AI assistance disabled. All code and test solutions must be implemented independently (BR-14).
          </p>
        </div>
      ) : (
        /* Active Chat & Messages / Empty State */
        <ChatMessageList
          messages={
            searchQuery.trim()
              ? messages.filter((m) =>
                  m.content.toLowerCase().includes(searchQuery.toLowerCase().trim())
                )
              : messages
          }
          isStreaming={isStreaming}
          onInsertCode={onInsertCode}
          onSelectPrompt={(text) => {
            setInputText(text);
            textareaRef.current?.focus();
          }}
          theme={theme}
        />
      )}

      {/* Error banner if present */}
      {error && aiEnabled && (
        <div className="px-4 py-1.5 bg-rose-50 dark:bg-rose-950/50 border-t border-rose-200 dark:border-rose-900 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
          {error}
        </div>
      )}

      {/* Floating Bottom Input Box (Cursor / Agent Style matching screenshot) */}
      <div className={`p-3.5 shrink-0 ${isLight ? 'bg-white' : 'bg-neutral-950'}`}>
        <div
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          data-lt-active="false"
          className={`rounded-2xl border p-3 flex flex-col gap-2.5 shadow-md transition-all ${
            isLight
              ? 'bg-neutral-100/80 border-neutral-200/90 focus-within:border-neutral-300 focus-within:bg-white'
              : 'bg-neutral-900 border-neutral-800 focus-within:border-neutral-700'
          }`}
        >
          {/* Textarea without any inner border or outline */}
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputText}
            disabled={!aiEnabled || isCapReached || isStreaming}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-lt-active="false"
            placeholder={
              !aiEnabled
                ? 'AI is turned OFF for this assessment'
                : isCapReached
                  ? 'Token budget cap reached (BR-15)'
                  : 'Ask the agent to change your code...'
            }
            className={`copilot-textarea w-full text-xs bg-transparent resize-none !border-0 !border-none !outline-none !ring-0 !shadow-none focus:!outline-none focus:!ring-0 focus-visible:!outline-none focus-visible:!ring-0 disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed p-0 m-0 ${
              isLight ? 'text-neutral-900 placeholder:text-neutral-400' : 'text-neutral-100 placeholder:text-neutral-500'
            }`}
            style={{
              outline: 'none',
              border: 'none',
              boxShadow: 'none',
              WebkitBoxShadow: 'none',
            }}
            data-testid="copilot-input-textarea"
          />

          {/* Controls Bar */}
          <div className="flex items-center justify-between text-xs select-none pt-0.5">
            {/* Left: + Add Attachment / Context button */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setInputText((prev) => (prev ? `${prev} @solution.ts ` : '@solution.ts '));
                  textareaRef.current?.focus();
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer border ${
                  isLight
                    ? 'bg-white border-neutral-300/80 text-neutral-700 hover:text-neutral-900 hover:border-neutral-400 shadow-2xs'
                    : 'bg-neutral-800 border-neutral-700/60 text-neutral-400 hover:text-white hover:border-neutral-600'
                }`}
                title="Add file context (@solution.ts)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right: Model Selector, Effort Selector & Circular Send Arrow */}
            <div className="flex items-center gap-2">
              {/* Model Dropdown Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsModelMenuOpen(!isModelMenuOpen);
                    setIsEffortMenuOpen(false);
                  }}
                  className={`h-7 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100 shadow-2xs'
                      : 'bg-neutral-800 border-neutral-700/60 text-neutral-200 hover:bg-neutral-700'
                  }`}
                  data-testid="copilot-model-selector"
                >
                  <span>{selectedModel}</span>
                  <ChevronDown className={`w-3.5 h-3.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`} />
                </button>

                {isModelMenuOpen && (
                  <div
                    className={`absolute bottom-full mb-1 right-0 w-36 rounded-xl border p-1 shadow-xl z-50 text-xs ${
                      isLight ? 'bg-white border-neutral-200 text-neutral-800' : 'bg-neutral-800 border-neutral-700 text-neutral-200'
                    }`}
                  >
                    {availableModels.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m);
                          setIsModelMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          selectedModel === m
                            ? 'bg-blue-600 text-white font-semibold'
                            : isLight
                              ? 'hover:bg-neutral-100 text-neutral-700'
                              : 'hover:bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Effort Dropdown Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsEffortMenuOpen(!isEffortMenuOpen);
                    setIsModelMenuOpen(false);
                  }}
                  className={`h-7 px-3 rounded-full text-xs font-medium flex items-center gap-1 border transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100 shadow-2xs'
                      : 'bg-neutral-800 border-neutral-700/60 text-neutral-200 hover:bg-neutral-700'
                  }`}
                  data-testid="copilot-effort-selector"
                >
                  <span className={isLight ? 'text-neutral-500 mr-1' : 'text-neutral-400 mr-1'}>Effort</span>
                  <span className={isLight ? 'text-neutral-800 font-medium' : 'text-neutral-200'}>{effort}</span>
                  <ChevronDown className={`w-3.5 h-3.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`} />
                </button>

                {isEffortMenuOpen && (
                  <div
                    className={`absolute bottom-full mb-1 right-0 w-32 rounded-xl border p-1 shadow-xl z-50 text-xs ${
                      isLight ? 'bg-white border-neutral-200 text-neutral-800' : 'bg-neutral-800 border-neutral-700 text-neutral-200'
                    }`}
                  >
                    {(['Low', 'Medium', 'High'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => {
                          setEffort(lvl);
                          setIsEffortMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          effort === lvl
                            ? 'bg-blue-600 text-white font-semibold'
                            : isLight
                              ? 'hover:bg-neutral-100 text-neutral-700'
                              : 'hover:bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Circular Send / Stop Arrow Button */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                  title="Stop generation"
                  data-testid="copilot-stop-btn"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!inputText.trim() || !aiEnabled || isCapReached}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                    inputText.trim() && aiEnabled && !isCapReached
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : isLight
                        ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                  title="Send prompt (Enter)"
                  data-testid="copilot-send-btn"
                >
                  <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
