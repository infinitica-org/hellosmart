import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { Select, MultiSelect } from './select';

const mockOptions = [
  { value: 'cloud', label: 'Cloud VM Workspace (Full Linux Shell & IDE)' },
  { value: 'chat', label: 'Chat Only Workspace (AI Agent Simulation)' },
  { value: 'local', label: 'Local Development CLI (Phase 2)', disabled: true },
  { value: 'browser', label: 'Browser Sandbox (Phase 2)', disabled: true },
];

const rubricTags = [
  { value: 'architecture', label: 'System Architecture' },
  { value: 'code_quality', label: 'Code Quality & Patterns' },
  { value: 'ai_tool_usage', label: 'Governed AI Tool Usage' },
  { value: 'git_discipline', label: 'Git Hygiene & Commits' },
  { value: 'edge_cases', label: 'Edge Case Resilience' },
  { value: 'test_coverage', label: 'Automated Test Coverage' },
];

const meta: Meta<typeof Select> = {
  title: 'Foundation/Select',
  component: Select,
  tags: ['autodocs'],
  args: {
    placeholder: 'Select assessment workspace mode...',
    options: mockOptions,
    disabled: false,
    hasError: false,
  },
  argTypes: {
    hasError: {
      control: 'boolean',
      description: 'Highlights select input in error state',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables select dropdown interaction',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder label for unselected option',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {},
};

export const Preselected: Story = {
  args: {
    defaultValue: 'cloud',
  },
};

export const WithError: Story = {
  args: {
    hasError: true,
    defaultValue: '',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'cloud',
  },
};

export const InteractiveSelection: Story = {
  args: {
    placeholder: 'Choose mode...',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox');
    await userEvent.selectOptions(select, 'chat');
    await expect(select).toHaveValue('chat');
  },
};

export const MultiSelectDemo: Story = {
  render: () => {
    return (
      <div className="max-w-md space-y-4 p-4 bg-white rounded-md border border-neutral-200">
        <div>
          <label className="text-xs font-semibold text-neutral-700 block mb-1">
            Rubric Evaluation Agents (Multi-Select)
          </label>
          <MultiSelect
            options={rubricTags}
            defaultValue={['architecture', 'ai_tool_usage']}
            placeholder="Select evaluation dimensions..."
          />
        </div>
        <p className="text-xs text-neutral-500">
          Supports multiple selections, badge tags, search filtering, and clear-all.
        </p>
      </div>
    );
  },
};


