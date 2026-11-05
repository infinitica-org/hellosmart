import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AdminAgentsPage, { type AgentInfo } from '../app/(admin)/admin/agents/page';

describe('AdminAgentsPage (BR-18, BR-19 Reviewer Agent Telemetry & Library)', () => {
  it('renders honest empty standby state when zero reviewer engines are registered', () => {
    const html = renderToString(<AdminAgentsPage />);

    expect(html).toContain('Reviewer Agent Library');
    expect(html).toContain('ACTIVE REVIEWER AGENTS');
    expect(html).toContain('No evaluation engines registered');
    expect(html).toContain('SUPPORTED RUNTIMES');
    expect(html).toContain('Workspace evaluation tracks in standby');
    expect(html).toContain('CONSENSUS AGGREGATOR');
    expect(html).toContain('Standby');
    expect(html).toContain('Aggregator idle until reviewer agents are deployed');
    expect(html).toContain('No Reviewer Agents Registered');
  });

  it('renders dynamic telemetry and agent cards when agents are populated', () => {
    const mockAgents: AgentInfo[] = [
      {
        id: 'agent_code_quality',
        name: 'Code Quality & Architecture',
        version: 'v1.4.0',
        mode: 'post_session',
        status: 'healthy',
        description: 'Analyzes modular separation, cyclomatic complexity, and test coverage.',
        signals: ['static_analysis', 'git_diff', 'linter_cleanliness'],
        defaultWeight: 35,
        model: 'gemini-2.0-flash',
      },
      {
        id: 'agent_problem_solving',
        name: 'Problem Solving & Correctness',
        version: 'v1.2.1',
        mode: 'post_session',
        status: 'healthy',
        description: 'Validates solution output correctness and boundary conditions.',
        signals: ['test_execution', 'terminal_logs', 'edge_case_handling'],
        defaultWeight: 65,
        model: 'gemini-2.0-flash',
      },
    ];

    const html = renderToString(<AdminAgentsPage initialAgents={mockAgents} />);

    expect(html).toContain('Reviewer Agent Library');
    expect(html).toContain('ACTIVE REVIEWER AGENTS');
    expect(html).toContain('Independent evaluation engines ready');
    expect(html).toContain('SUPPORTED RUNTIMES');
    expect(html).toContain('Node, Python, Go');
    expect(html).toContain('CONSENSUS AGGREGATOR');
    expect(html).toContain('2/2 Healthy');
    expect(html).toContain('Code Quality &amp; Architecture');
    expect(html).toContain('Problem Solving &amp; Correctness');
    expect(html).toContain('static_analysis');
    expect(html).toContain('gemini-2.0-flash');
    expect(html).not.toContain('No Reviewer Agents Registered');
  });
});
