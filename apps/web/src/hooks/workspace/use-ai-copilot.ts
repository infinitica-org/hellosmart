import { useState, useCallback, useRef, useEffect } from 'react';
import type { CopilotMessage } from '../../components/workspace/copilot/chat-message-list';

export interface AiPolicyConfig {
  enabled?: boolean | undefined;
  allowedModels?: string[] | undefined;
  capPerCandidate?: { unit: string; value: number } | undefined;
  rpm?: number | undefined;
}

export interface UseAiCopilotOptions {
  workspaceId: string;
  aiPolicy?: AiPolicyConfig | null | undefined;
  initialTokensUsed?: number | undefined;
  apiEndpoint?: string | undefined;
}

export interface UseAiCopilotReturn {
  messages: CopilotMessage[];
  isStreaming: boolean;
  tokensUsed: number;
  tokenCap: number;
  isCapReached: boolean;
  isWarning: boolean;
  aiEnabled: boolean;
  error: string | null;
  sendMessage: (prompt: string) => Promise<void>;
  clearHistory: () => void;
  stopGeneration: () => void;
}

const DEFAULT_TOKEN_CAP = 10000;

export function useAiCopilot({
  workspaceId,
  aiPolicy,
  initialTokensUsed = 0,
  apiEndpoint = '/api/v1/proxy/ai/chat/completions',
}: UseAiCopilotOptions): UseAiCopilotReturn {
  const aiEnabled = aiPolicy?.enabled !== false;
  const tokenCap = aiPolicy?.capPerCandidate?.value || DEFAULT_TOKEN_CAP;

  const [messages, setMessages] = useState<CopilotMessage[]>([]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [tokensUsed, setTokensUsed] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`hs_tokens_${workspaceId}`);
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 0) return parsed;
        }
      } catch {}
    }
    return initialTokensUsed;
  });
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const isCapReached = tokensUsed >= tokenCap;
  const isWarning = tokensUsed >= tokenCap * 0.8 && !isCapReached;

  // Persist token count locally
  useEffect(() => {
    try {
      localStorage.setItem(`hs_tokens_${workspaceId}`, tokensUsed.toString());
    } catch {}
  }, [tokensUsed, workspaceId]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clearHistory = useCallback(() => {
    stopGeneration();
    setMessages([]);
    setError(null);
  }, [stopGeneration]);

  // Simulated SSE generator when endpoint is not reachable or in test/dev
  const simulateStreamingResponse = useCallback(
    async (prompt: string, assistantId: string) => {
      let simulatedResponse = '';

      const lower = prompt.toLowerCase();
      if (lower.includes('test') || lower.includes('spec')) {
        simulatedResponse =
          'Here is a recommended test assertion suite for your solution in TypeScript:\n\n' +
          '```typescript\n' +
          "import { CandidateSolution } from '../src/solution';\n\n" +
          "describe('CandidateSolution Unit Tests', () => {\n" +
          "  it('should validate edge cases correctly', () => {\n" +
          '    const solution = new CandidateSolution();\n' +
          "    const res = solution.execute({ taskId: 'verify-1', candidateInput: {} });\n" +
          "    expect(res.status).toBe('passed');\n" +
          '  });\n' +
          '});\n' +
          '```\n\n' +
          'You can click **Insert into Editor** above to inject this directly into your test file.';
      } else if (lower.includes('solution') || lower.includes('code') || lower.includes('fix')) {
        simulatedResponse =
          'Here is an optimized implementation for `src/solution.ts`:\n\n' +
          '```typescript\n' +
          'export class CandidateSolution {\n' +
          '  execute(payload: Record<string, unknown>): { status: string; timestamp: number } {\n' +
          '    // Process input data cleanly\n' +
          '    return {\n' +
          "      status: 'passed',\n" +
          '      timestamp: Date.now(),\n' +
          '    };\n' +
          '  }\n' +
          '}\n' +
          '```\n\n' +
          'Notice how the execute method returns a typed status object meeting the rubric specification.';
      } else {
        simulatedResponse =
          `I reviewed your request: "${prompt}".\n\n` +
          'Consider structuring your solution with modular separation between data transformations and validation logic. Remember to verify your solution against `npm test` before final submission.';
      }

      const words = simulatedResponse.split(' ');
      let accumulated = '';

      for (let i = 0; i < words.length; i++) {
        accumulated += (i > 0 ? ' ' : '') + words[i];
        const currentText = accumulated;

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: currentText } : m))
        );

        // Small delay to simulate realistic streaming
        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      // Add estimated tokens (~1 token per 4 characters)
      const tokensConsumed = Math.max(30, Math.ceil((prompt.length + simulatedResponse.length) / 4));
      setTokensUsed((prev) => Math.min(tokenCap, prev + tokensConsumed));
      setIsStreaming(false);
    },
    [tokenCap]
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || isStreaming) return;

      if (!aiEnabled) {
        setError('AI Assistance is turned OFF for this task (BR-14)');
        return;
      }

      if (isCapReached) {
        setError('Token budget cap reached (BR-15). Further requests are blocked.');
        return;
      }

      setError(null);

      const userMessage: CopilotMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };

      const assistantId = `assistant-${Date.now()}`;
      const assistantPlaceholder: CopilotMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            workspaceId,
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: controller.signal,
        });

        if (response.status === 403) {
          throw new Error('AI Assistance is turned OFF for this task (BR-14)');
        }

        if (response.status === 402) {
          setTokensUsed(tokenCap);
          throw new Error('Token budget cap reached (BR-15). Further requests are blocked.');
        }

        if (!response.ok || !response.body) {
          // Fallback to simulated assistant when backend proxy route is mocking
          await simulateStreamingResponse(trimmed, assistantId);
          return;
        }

        // Check budget warning header
        if (response.headers.get('x-hs-budget-warning')) {
          console.warn('[AICopilot] 80% Token budget warning triggered from server.');
        }

        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith('data:')) continue;

            const dataStr = trimmedLine.replace(/^data:\s*/, '');
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              const deltaContent = parsed.choices?.[0]?.delta?.content || '';
              if (deltaContent) {
                accumulatedText += deltaContent;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulatedText } : m
                  )
                );
              }

              // Update token usage if returned in stream
              if (parsed.usage?.total_tokens) {
                setTokensUsed((prev) => Math.min(tokenCap, prev + parsed.usage.total_tokens));
              }
            } catch {}
          }
        }

        // Estimate tokens if not provided directly
        const estTokens = Math.max(30, Math.ceil((trimmed.length + accumulatedText.length) / 4));
        setTokensUsed((prev) => Math.min(tokenCap, prev + estTokens));
        setIsStreaming(false);
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
          return;
        }

        // If fetch failed completely (e.g. proxy server not running), fallback to simulator
        const msg = (err as Error)?.message || 'AI request failed';
        if (msg.includes('AI Assistance is turned OFF') || msg.includes('Token budget cap reached')) {
          setError(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: `⚠️ ${msg}` } : m
            )
          );
          setIsStreaming(false);
        } else {
          await simulateStreamingResponse(trimmed, assistantId);
        }
      }
    },
    [aiEnabled, apiEndpoint, isCapReached, isStreaming, messages, simulateStreamingResponse, tokenCap, workspaceId]
  );

  return {
    messages,
    isStreaming,
    tokensUsed,
    tokenCap,
    isCapReached,
    isWarning,
    aiEnabled,
    error,
    sendMessage,
    clearHistory,
    stopGeneration,
  };
}
