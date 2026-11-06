import type { Meta, StoryObj } from '@storybook/react';
import { HashChainStatusBanner } from './hash-chain-status-banner';

const meta: Meta<typeof HashChainStatusBanner> = {
  title: 'Feedback/HashChainStatusBanner',
  component: HashChainStatusBanner,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['idle', 'verifying', 'valid', 'tampered', 'empty', 'inconclusive'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof HashChainStatusBanner>;

export const Idle: Story = {
  args: {
    status: 'idle',
    onVerify: () => console.log('Verify triggered'),
  },
};

export const Verifying: Story = {
  args: {
    status: 'verifying',
    isLoading: true,
  },
};

export const Valid: Story = {
  args: {
    status: 'valid',
    recordsChecked: 1420,
    chainStart: '1',
    chainEnd: '1420',
    verifiedAt: new Date().toISOString(),
    onVerify: () => console.log('Re-verify triggered'),
  },
};

export const Inconclusive: Story = {
  args: {
    status: 'inconclusive',
    recordsChecked: 41,
    recordsVerifiedBeforeIssue: 41,
    chainStart: '1',
    firstInconclusiveEventId: '42',
    inconclusiveReason:
      'Cannot verify cryptographic hash: original JSON property ordering for nested state changes (before/after) cannot be recovered from PostgreSQL JSONB',
    verifiedAt: new Date().toISOString(),
    onVerify: () => console.log('Re-verify triggered'),
  },
};

export const Tampered: Story = {
  args: {
    status: 'tampered',
    firstInvalidEventId: '42',
    failureReason: 'Cryptographic hash mismatch: row payload, actor, action, or stored hash has been tampered with',
    expectedHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    storedHash: 'bad0000000000000000000000000000000000000000000000000000000000bad',
    onVerify: () => console.log('Re-verify triggered'),
  },
};
