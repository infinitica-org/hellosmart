import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { EvidenceReference } from './evidence-reference';

const meta: Meta<typeof EvidenceReference> = {
  title: 'Domain/Content/EvidenceReference',
  component: EvidenceReference,
  tags: ['autodocs'],
  args: {
    reference: 'diff:src/db/tenant.go#L42-L65',
    onView: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof EvidenceReference>;

export const GitDiffReference: Story = {
  args: {
    reference: 'diff:src/db/tenant.go#L42-L65',
  },
};

export const TerminalCommandReference: Story = {
  args: {
    reference: 'term:go test -race ./tests/isolation_test.go',
  },
};

export const AiPromptTurnReference: Story = {
  args: {
    reference: 'ai:candidate_turn_03_refactor_query',
  },
};

export const TestResultReference: Story = {
  args: {
    reference: 'test:suite_tenant_isolation_passed',
  },
};

export const AllEvidenceTypes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-4">
      <EvidenceReference reference="diff:internal/auth/jwt.go#L12" onView={fn()} />
      <EvidenceReference reference="term:docker build -t app:latest ." onView={fn()} />
      <EvidenceReference reference="ai:system_agent_clarification" onView={fn()} />
      <EvidenceReference reference="file:README.md" onView={fn()} />
      <EvidenceReference reference="event:fullscreen_exit_detected" onView={fn()} />
      <EvidenceReference reference="test:benchmarks_under_p99" onView={fn()} />
    </div>
  ),
};

