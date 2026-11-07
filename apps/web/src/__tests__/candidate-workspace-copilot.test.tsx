import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TokenBudgetGauge } from '../components/workspace/copilot/token-budget-gauge';
import { ChatMessageList, type CopilotMessage } from '../components/workspace/copilot/chat-message-list';
import { AiCopilotDrawer } from '../components/workspace/copilot/ai-copilot-drawer';

describe('Candidate AI Copilot Drawer & Token Budget Gauge (Stream 7.3 / BR-13, BR-14, BR-15)', () => {
  describe('TokenBudgetGauge Component (BR-15)', () => {
    it('renders normal token consumption with remaining count', () => {
      const html = renderToString(
        <TokenBudgetGauge
          tokensUsed={2500}
          tokenCap={10000}
          theme="dark"
        />
      );

      expect(html).toContain('Token Budget (BR-15)');
      expect(html).toContain('25% Used');
      expect(html).toContain('2,500');
      expect(html).toContain('10,000');
      expect(html).toContain('7,500 remaining');
    });

    it('triggers 80% warning badge when consumption reaches or exceeds 80%', () => {
      const html = renderToString(
        <TokenBudgetGauge
          tokensUsed={8500}
          tokenCap={10000}
          theme="dark"
        />
      );

      expect(html).toContain('80% Warning');
      expect(html).toContain('8,500');
    });

    it('triggers Cap Reached and Input Blocked status at 100% cap', () => {
      const html = renderToString(
        <TokenBudgetGauge
          tokensUsed={10000}
          tokenCap={10000}
          theme="dark"
        />
      );

      expect(html).toContain('Cap Reached');
      expect(html).toContain('Input Blocked');
      expect(html).toContain('Token budget cap reached for this candidate session');
    });
  });

  describe('ChatMessageList Component', () => {
    it('renders user prompt and assistant response bubbles', () => {
      const messages: CopilotMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'How do I test my solution?',
          createdAt: Date.now(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Run `npm test` in the interactive terminal to execute the test suite.',
          createdAt: Date.now(),
        },
      ];

      const html = renderToString(
        <ChatMessageList
          messages={messages}
          theme="dark"
        />
      );

      expect(html).toContain('How do I test my solution?');
      expect(html).toContain('npm test');
      expect(html).toContain('copilot-message-user');
      expect(html).toContain('copilot-message-assistant');
    });

    it('renders code blocks with Insert into Editor button', () => {
      const messages: CopilotMessage[] = [
        {
          id: '1',
          role: 'assistant',
          content:
            'Here is the solution:\n\n```typescript\nexport const answer = 42;\n```\n',
          createdAt: Date.now(),
        },
      ];

      const html = renderToString(
        <ChatMessageList
          messages={messages}
          onInsertCode={vi.fn()}
          theme="dark"
        />
      );

      expect(html).toContain('export const answer = 42;');
      expect(html).toContain('copilot-insert-code-btn');
      expect(html).toContain('Insert into Editor');
      expect(html).toContain('copilot-copy-code-btn');
    });
  });

  describe('AiCopilotDrawer Component & Policy Enforcement', () => {
    it('renders open drawer with token budget gauge and input field', () => {
      const html = renderToString(
        <AiCopilotDrawer
          isOpen={true}
          onClose={vi.fn()}
          workspaceId="ws-test-123"
          aiPolicy={{
            enabled: true,
            allowedModels: ['gemini-1.5-pro'],
            capPerCandidate: { unit: 'tokens', value: 10000 },
          }}
          theme="dark"
        />
      );

      expect(html).toContain('data-testid="ai-copilot-drawer"');
      expect(html).toContain('gemini-1.5-pro');
      expect(html).toContain('data-testid="token-budget-gauge"');
      expect(html).toContain('data-testid="copilot-input-textarea"');
      expect(html).toContain('data-testid="copilot-send-btn"');
    });

    it('renders disabled badge when AI policy has enabled = false (BR-14)', () => {
      const html = renderToString(
        <AiCopilotDrawer
          isOpen={true}
          onClose={vi.fn()}
          workspaceId="ws-test-123"
          aiPolicy={{
            enabled: false,
          }}
          theme="dark"
        />
      );

      expect(html).toContain('AI Assistance is turned OFF for this task');
      expect(html).toContain('data-testid="copilot-disabled-banner"');
      expect(html).toContain('disabled');
    });

    it('returns null when drawer is closed', () => {
      const html = renderToString(
        <AiCopilotDrawer
          isOpen={false}
          onClose={vi.fn()}
          workspaceId="ws-test-123"
        />
      );

      expect(html).toBe('');
    });

    it('renders clean empty state with suggestion prompts when messages list is empty', () => {
      const html = renderToString(
        <ChatMessageList
          messages={[]}
          theme="dark"
        />
      );

      expect(html).toContain('copilot-empty-state');
    });

    it('renders properly in light theme mode', () => {
      const html = renderToString(
        <AiCopilotDrawer
          isOpen={true}
          onClose={vi.fn()}
          workspaceId="ws-test-light"
          aiPolicy={{ enabled: true }}
          theme="light"
        />
      );

      expect(html).toContain('data-testid="ai-copilot-drawer"');
      expect(html).toContain('bg-white');
    });
  });
});
