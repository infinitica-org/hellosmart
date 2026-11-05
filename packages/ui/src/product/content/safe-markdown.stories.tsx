import type { Meta, StoryObj } from '@storybook/react';
import { SafeMarkdown } from './safe-markdown';

const markdownContent = `# Distributed Systems Assessment Brief

## Task Objectives
- Implement an in-memory key-value cache with LRU eviction.
- Ensure thread-safe concurrent access across multiple worker routines.
- Maintain consistent response times under high benchmark pressure.

### Constraints & Instructions
- Use \`sync.RWMutex\` or lock-free channel concurrency.
- Run tests via \`go test -v -race ./...\`.
- External network egress is blocked by the HelloSmart container boundary.`;

const meta: Meta<typeof SafeMarkdown> = {
  title: 'Domain/Content/SafeMarkdown',
  component: SafeMarkdown,
  tags: ['autodocs'],
  args: {
    content: markdownContent,
  },
};

export default meta;
type Story = StoryObj<typeof SafeMarkdown>;

export const DefaultBrief: Story = {
  args: {},
};

export const WithInlineCodeAndLists: Story = {
  args: {
    content: `## Reviewer Agent Feedback
- Code style conforms to Go 1.22 best practices.
- Zero data races detected during execution.
- Used \`atomic.Int64\` for metrics collection.`,
  },
};

