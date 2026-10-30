'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { CandidateAssignmentDto } from '@hs/contracts';
import {
  PageHeader,
  EmptyState,
  Badge,
  Button,
  Card,
  Spinner,
  Alert,
  Dialog,
  CountdownTimer,
  ConsentPanel,
  WorkspaceConnectionStatus,
  AiUsageIndicator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Terminal as TerminalIcon,
  RefreshCw,
  Check,
  Building2,
  Cpu,
  LogOut,
} from '@hs/ui';
import {
  listCandidateAssignments,
  startCandidateAssignment,
  submitCandidateAssignment,
} from '@/lib/api-client';

export default function CandidateDashboardPage(): React.JSX.Element {
  const [assignments, setAssignments] = useState<CandidateAssignmentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Workspace state
  const [activeTask, setActiveTask] = useState<CandidateAssignmentDto | null>(null);

  // Consent modal state
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [taskForConsent, setTaskForConsent] = useState<CandidateAssignmentDto | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Submit modal state
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Simulated Terminal state inside workspace
  const [commandInput, setCommandInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<Array<{ type: 'cmd' | 'output'; text: string }>>([
    { type: 'output', text: 'HelloSmart Cloud Simulation Environment v2.4 (Ubuntu 24.04 LTS)' },
    { type: 'output', text: 'Workspace attached. Governed AI proxy connected. Type "help" or "npm test".' },
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Simulated AI Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Hello! I am your HelloSmart AI assistant. I can assist you with system architecture, debugging, and code suggestions. Note: all AI prompts and responses are logged for evaluation (BR-13, BR-18).',
    },
  ]);
  const [tokensUsed, setTokensUsed] = useState(1450);

  const fetchAssignments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listCandidateAssignments();
      setAssignments(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch candidate assignments.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  const handleStartOrResume = (task: CandidateAssignmentDto) => {
    if (task.status === 'ready') {
      setTaskForConsent(task);
      setIsConsentOpen(true);
    } else if (task.status === 'in_progress') {
      setActiveTask(task);
    }
  };

  const handleConsentAccept = async (consentData: { textVersion: string; acceptedAt: string }) => {
    if (!taskForConsent) return;
    setIsStarting(true);
    try {
      const updated = await startCandidateAssignment(taskForConsent.id, consentData);
      setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setIsConsentOpen(false);
      setTaskForConsent(null);
      setActiveTask(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to start assessment. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSubmitConfirm = async () => {
    if (!activeTask) return;
    setIsSubmitting(true);
    try {
      const updated = await submitCandidateAssignment(activeTask.id);
      setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setActiveTask(null);
      setIsSubmitOpen(false);
      setSubmissionSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit assessment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    const newLogs: Array<{ type: 'cmd' | 'output'; text: string }> = [
      ...terminalLogs,
      { type: 'cmd', text: `candidate@hellosmart-vm:~$ ${cmd}` },
    ];

    switch (cmd.toLowerCase()) {
      case 'help':
        newLogs.push({
          type: 'output',
          text: 'Available simulation commands:\n  npm test      - Run automated verification test suite\n  git status    - Check repository working tree status\n  git log       - Display recent commit history\n  ls / ls -la   - List workspace files and directories\n  clear         - Clear the terminal console\n  cat brief.md  - View task instructions and constraints',
        });
        break;
      case 'npm test':
        newLogs.push({
          type: 'output',
          text: 'RUNNING automated test suite...\n✓ tests/unit/auth.test.ts (4 tests passed)\n✓ tests/integration/tenancy.test.ts (3 tests passed)\n✓ tests/e2e/workflow.test.ts (2 tests passed)\n\nTest Suites: 3 passed, 3 total\nTests:       9 passed, 9 total\nSnapshots:   0 total\nTime:        1.842s\nRan all test suites.',
        });
        break;
      case 'git status':
        newLogs.push({
          type: 'output',
          text: 'On branch simulation-main\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n\tmodified:   src/solution.ts\n\tmodified:   tests/unit/auth.test.ts\n\nno changes added to commit (use "git add" and/or "git commit -a")',
        });
        break;
      case 'git log':
        newLogs.push({
          type: 'output',
          text: 'commit 8f3a12d (HEAD -> simulation-main)\nAuthor: Candidate <candidate@hellosmart.ai>\nDate:   Today\n\n    feat: implement core evaluation logic\n\ncommit 1a0b94c\nAuthor: HelloSmart System <seed@hellosmart.ai>\nDate:   Yesterday\n\n    chore: initial simulation workspace scaffolding',
        });
        break;
      case 'ls':
      case 'ls -la':
        newLogs.push({
          type: 'output',
          text: 'total 48\ndrwxr-xr-x 6 candidate candidate 4096 Oct 30 10:00 .\ndrwxr-xr-x 3 root      root      4096 Oct 30 09:59 ..\n-rw-r--r-- 1 candidate candidate 1240 Oct 30 10:00 brief.md\n-rw-r--r-- 1 candidate candidate  850 Oct 30 10:00 package.json\ndrwxr-xr-x 2 candidate candidate 4096 Oct 30 10:00 src\ndrwxr-xr-x 3 candidate candidate 4096 Oct 30 10:00 tests\n-rw-r--r-- 1 candidate candidate  320 Oct 30 10:00 tsconfig.json',
        });
        break;
      case 'cat brief.md':
        newLogs.push({
          type: 'output',
          text: '# Full-Stack System Architecture Simulation\nDesign and verify the tenant isolation and data flow logic.\nDeliverables:\n1. Implement robust tenant scoping in src/solution.ts\n2. Ensure all 9 unit and integration tests pass via `npm test`\n3. Submit your completed work before the session timer expires.',
        });
        break;
      case 'clear':
        setTerminalLogs([]);
        setCommandInput('');
        return;
      default:
        newLogs.push({
          type: 'output',
          text: `bash: ${cmd}: command not found. Type "help" for a list of simulation commands.`,
        });
        break;
    }

    setTerminalLogs(newLogs);
    setCommandInput('');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    const updated = [
      ...chatMessages,
      { role: 'user' as const, text },
      {
        role: 'assistant' as const,
        text: `Based on the simulation rubric, ensure all database operations in src/solution.ts are scoped with org_id and validated against the tenant isolation policy. You can run \`npm test\` to confirm.`,
      },
    ];

    setChatMessages(updated);
    setChatInput('');
    setTokensUsed((prev) => Math.min(prev + 180, 10000));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Active Workspace Full-Screen View
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeTask) {
    const deadline = new Date(Date.now() + activeTask.durationMinutes * 60 * 1000).toISOString();

    return (
      <div className="space-y-4">
        {/* Workspace Top Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-neutral-900 text-white shadow-md">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTask(null)}
              className="bg-neutral-800 text-neutral-200 border-neutral-700 hover:bg-neutral-700"
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
            >
              Exit to Dashboard
            </Button>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">{activeTask.title}</h2>
              <p className="text-xs text-neutral-400">
                {activeTask.companyName} &bull; Controlled Cloud VM (BR-10, BR-12)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <WorkspaceConnectionStatus state="connected" className="bg-neutral-800 border-neutral-700 text-neutral-200" />
            <CountdownTimer
              deadlineUtc={deadline}
              className="bg-neutral-800 border border-neutral-700 text-neutral-200 px-3 py-1.5 rounded-md"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsSubmitOpen(true)}
              className="bg-success hover:bg-success/90 text-white font-medium border-transparent"
              leftIcon={<Check className="w-4 h-4" />}
            >
              Submit Assessment
            </Button>
          </div>
        </div>

        {/* Main Workspace Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Area: Terminal & Brief */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-0 overflow-hidden border border-neutral-200 bg-neutral-950 text-neutral-100 font-mono text-xs shadow-sm">
              <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-neutral-300">
                <div className="flex items-center gap-2">
                  <TerminalIcon className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-xs text-neutral-200">bash &bull; candidate@hellosmart-vm:~</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-sans">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Autosaved (RPO &le; 30s)
                </div>
              </div>

              {/* Terminal Logs Output */}
              <div className="p-4 h-96 overflow-y-auto space-y-1.5 font-mono text-xs leading-relaxed text-neutral-300">
                {terminalLogs.map((log, index) => (
                  <div
                    key={index}
                    className={
                      log.type === 'cmd'
                        ? 'text-primary font-semibold'
                        : 'text-neutral-300 whitespace-pre-wrap'
                    }
                  >
                    {log.text}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>

              {/* Terminal Prompt Input Form */}
              <form onSubmit={handleRunCommand} className="flex items-center gap-2 p-2.5 bg-neutral-900 border-t border-neutral-800">
                <span className="text-primary font-bold pl-2">$</span>
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="Type command ('npm test', 'git status', 'ls', 'help')..."
                  className="flex-1 bg-transparent border-0 text-white placeholder-neutral-500 focus:outline-none text-xs font-mono"
                  autoFocus
                />
                <Button type="submit" variant="primary" size="sm" className="h-7 text-xs px-2.5">
                  Run
                </Button>
              </form>
            </Card>

            {/* Task Brief & Instructions */}
            <Card className="p-5 border border-neutral-200 shadow-xs space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">Task Brief & Acceptance Criteria</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                You are evaluating a microservice architecture for multi-tenant isolation. Implement the required database scoping in the virtual workspace, verify all 9 automated tests pass with <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-800">npm test</code>, and finalize your submission.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-neutral-100">
                <div>
                  <span className="text-neutral-500 block">AI Policy</span>
                  <span className="font-medium text-neutral-800">Governed AI Proxy (BR-13)</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Integrity Rules</span>
                  <span className="font-medium text-neutral-800">Full-Screen Monitored (BR-10)</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Sidebar: AI Assistant & Telemetry */}
          <div className="space-y-4">
            <AiUsageIndicator usedTokens={tokensUsed} capTokens={10000} />

            <Card className="flex flex-col h-[460px] p-0 overflow-hidden border border-neutral-200 shadow-xs">
              <div className="p-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-neutral-800">AI Assistant (Proxy)</span>
                </div>
                <Badge variant="info" size="sm">Active</Badge>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg max-w-[90%] leading-relaxed ${
                      msg.role === 'user'
                        ? 'ml-auto bg-primary text-white'
                        : 'mr-auto bg-neutral-100 text-neutral-800'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>

              {/* Chat Input Form */}
              <form onSubmit={handleSendChat} className="p-2 border-t border-neutral-200 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask AI assistant..."
                  className="flex-1 text-xs border border-neutral-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button type="submit" variant="primary" size="sm" className="h-8 px-3">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Button>
              </form>
            </Card>
          </div>
        </div>

        {/* Submit Assessment Confirmation Dialog */}
        <Dialog
          open={isSubmitOpen}
          onClose={() => setIsSubmitOpen(false)}
          title="Submit Assessment"
          description="Are you ready to submit your assessment? Once submitted, your workspace state is snapshot and finalized for independent AI reviewer agent evaluation (BR-18, BR-20)."
          size="md"
        >
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              ⚠️ You will not be able to modify your code or resume this session after submitting.
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSubmitOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={isSubmitting}
                onClick={handleSubmitConfirm}
              >
                Confirm & Submit
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Standard Candidate Dashboard View
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Candidate Assessment Workspace"
          description="Complete practical work simulation tasks in a controlled cloud environment with real developer tools."
          badge={{ text: 'Candidate Portal', variant: 'info' }}
          data-testid="candidate-page-header"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAssignments}
          disabled={isLoading}
          leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {submissionSuccess && (
        <Alert
          variant="success"
          title="Assessment Successfully Submitted"
          onClose={() => setSubmissionSuccess(false)}
        >
          Your work simulation has been snapshot and submitted for evaluation. Independent AI reviewer agents are analyzing your rubric signals (BR-18, BR-20).
        </Alert>
      )}

      {error && (
        <Alert
          variant="error"
          title="Error"
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Spinner size="lg" className="text-primary mb-3" />
          <p className="text-sm text-neutral-500 font-medium">Loading assigned assessments...</p>
        </Card>
      ) : assignments.length > 0 ? (
        <div className="space-y-4">
          {assignments.map((task) => (
            <Card
              key={task.id}
              className="p-6 sm:p-8 space-y-5 shadow-xs border border-neutral-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-100">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-neutral-900">{task.title}</h2>
                    <Badge
                      variant={
                        task.status === 'ready'
                          ? 'success'
                          : task.status === 'in_progress'
                            ? 'warning'
                            : 'default'
                      }
                      dot
                    >
                      {task.status === 'ready'
                        ? 'Ready to Start'
                        : task.status === 'in_progress'
                          ? 'In Progress'
                          : 'Submitted'}
                    </Badge>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Issued by <span className="text-neutral-800 font-medium">{task.companyName}</span> &bull; {task.durationMinutes} minutes duration
                  </p>
                </div>

                {task.status === 'submitted' ? (
                  <Badge variant="success" size="md">
                    ✓ Completed & Submitted
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    data-testid="start-assessment-button"
                    onClick={() => handleStartOrResume(task)}
                    className="flex-shrink-0 bg-primary hover:bg-primary-hover text-white border-transparent font-medium"
                  >
                    {task.status === 'ready' ? 'Start Assessment →' : 'Resume Assessment →'}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/80">
                  <span className="text-neutral-500 block mb-0.5 font-light">Environment</span>
                  <span className="text-neutral-800 font-medium">{task.mode === 'cloud' ? 'Cloud VM (Terminal/IDE)' : 'Interactive Chat'}</span>
                </div>
                <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/80">
                  <span className="text-neutral-500 block mb-0.5 font-light">Duration</span>
                  <span className="text-neutral-800 font-medium">{task.durationMinutes} Minutes</span>
                </div>
                <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/80">
                  <span className="text-neutral-500 block mb-0.5 font-light">AI Assistance</span>
                  <span className="text-neutral-800 font-medium">Governed AI Proxy (BR-13)</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Assigned Tasks</h2>
            <p className="text-xs text-neutral-500 font-normal mt-0.5">
              Active invitations from hiring companies.
            </p>
          </div>

          <EmptyState
            title="No active assignments"
            description="You do not currently have any pending assessments. Please check your invitation email or contact your hiring recruiter."
          />
        </Card>
      )}

      {/* Consent Modal Dialog (BR-12) */}
      <Dialog
        open={isConsentOpen}
        onClose={() => setIsConsentOpen(false)}
        title="Assessment Environment Agreement"
        description="Review session recording, AI proxy, and timer rules before connecting (BR-12)."
        size="lg"
      >
        {taskForConsent && (
          <ConsentPanel
            workspaceMode={taskForConsent.mode}
            aiEnabled={taskForConsent.aiEnabled}
            pauseTimerOnDisconnect={taskForConsent.pauseTimerOnDisconnect}
            onAccept={handleConsentAccept}
            isLoading={isStarting}
          />
        )}
      </Dialog>
    </div>
  );
}
