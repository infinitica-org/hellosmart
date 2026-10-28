import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { RubricScoreCard } from './rubric-score-card';

const meta: Meta<typeof RubricScoreCard> = {
  title: 'Domain/Review/RubricScoreCard',
  component: RubricScoreCard,
  tags: ['autodocs'],
  args: {
    name: 'Algorithmic Complexity & Architecture',
    weight: 35,
    score: 88,
    maxScore: 100,
    rationale:
      'Candidate selected O(log n) binary search approach and maintained clean separation between data ingestion and real-time processing threads.',
    evidence: [
      'diff:src/services/router.go#L42-L78',
      'term:make test-benchmarks',
      'ai:prompt_session_turn_04',
    ],
    confidence: 94,
    flags: ['Deterministic Test Coverage Passed'],
    onViewEvidence: fn(),
  },
  argTypes: {
    score: { control: 'number' },
    weight: { control: 'number' },
    confidence: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof RubricScoreCard>;

export const HighScoreWithEvidence: Story = {
  args: {},
};

export const ModerateScoreWithFlag: Story = {
  args: {
    name: 'Cloud Security & Tenant Isolation',
    weight: 25,
    score: 65,
    rationale:
      'Tenant isolation implemented in database queries but missing automated cross-tenant security test assertions.',
    evidence: ['diff:src/db/tenant.go#L15', 'test:suite_tenant_isolation'],
    confidence: 82,
    flags: ['Missing cross-tenant test file (BR-01)'],
  },
};

export const LowScoreWithCriticalFlags: Story = {
  args: {
    name: 'Code Cleanliness & Error Handling',
    weight: 40,
    score: 42,
    rationale: 'Uncaught panics in worker goroutines and hardcoded credentials found in test mock.',
    evidence: ['diff:src/worker/pool.go#L90', 'term:panic: runtime error'],
    confidence: 96,
    flags: ['Hardcoded Mock Secret Detected (BR-16)', 'Unhandled Panic in Worker Loop'],
  },
};

