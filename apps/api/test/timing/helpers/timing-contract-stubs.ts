/**
 * Contract stubs for Stream 2 candidate runtime, workspace events, and auto-submit worker.
 *
 * Requirements Traceability:
 * - BR-08: Server-enforced timing, duration/window calculation, auto-submit at expiry.
 * - BR-09: Timer on disconnect keeps running unless pauseTimerOnDisconnect=true.
 * - CA-005: Candidate workspace connect state.
 * - CA-008: Fullscreen enforcement on cloud connect.
 * - CA-009: Exiting fullscreen disconnects workspace session.
 * - CA-010: Work persistence on disconnect (RPO <= 30s).
 * - CA-011: Reconnect and resume session.
 * - CA-012: Workspace launch obeys timing boundaries (403 on launch outside window).
 * - CA-018: Candidate work submission & auto-submit at expiry.
 * - CO-028: Time-bound assessment configuration.
 * - CO-030: Combined window + duration enforcement.
 * - CO-031: Extend candidate time / window.
 *
 * Current Repo State (origin/dev at 8c84a46):
 * - app.assignments table: Deferred to Stream 2 (Migration 0013 line 19).
 * - POST /candidate/assignments/:id/connect: Deferred to Stream 2.
 * - POST /candidate/workspaces/:id/events: Deferred to Stream 2.
 * - AutoSubmitWorker / sweeper: Scheduled for Stream 2 candidate lifecycle.
 *
 * When these features are implemented in Stream 2, the tests calling these stubs
 * can be un-skipped, and this stub file will be replaced by actual service calls.
 */

export interface CandidateLaunchParams {
  assignmentId: string;
  candidateSessionToken: string;
  clientTimestamp?: string;
}

export interface WorkspaceEventParams {
  workspaceId: string;
  assignmentId: string;
  candidateSessionToken: string;
  eventType: 'connect' | 'disconnect' | 'resume' | 'fullscreen_exit';
  clientTimestamp?: string;
  payload?: Record<string, unknown>;
}

export interface AutoSubmitSweepParams {
  orgId?: string;
  referenceTime?: Date;
  limit?: number;
}

export class TimingContractStubs {
  /**
   * Stub for candidate workspace launch/connect endpoint (POST /candidate/assignments/:id/connect).
   * Scheduled for Stream 2 candidate runtime (CA-005, CA-012, BR-08, T-021).
   */
  static async launchAssignment(_params: CandidateLaunchParams): Promise<never> {
    throw new Error(
      'UNIMPLEMENTED: POST /candidate/assignments/:id/connect and app.assignments table ' +
        'are scheduled for Stream 2 candidate runtime (CA-005, CA-012, BR-08, T-021).',
    );
  }

  /**
   * Stub for workspace lifecycle event reporting (POST /candidate/workspaces/:id/events).
   * Scheduled for Stream 2 candidate runtime (CA-009, CA-011, BR-09, T-022).
   */
  static async recordWorkspaceEvent(_params: WorkspaceEventParams): Promise<never> {
    throw new Error(
      'UNIMPLEMENTED: POST /candidate/workspaces/:id/events and workspace disconnect/resume handling ' +
        'are scheduled for Stream 2 candidate runtime (CA-009, CA-011, BR-09, T-022).',
    );
  }

  /**
   * Stub for auto-submit background sweeper worker.
   * Scheduled for Stream 2 candidate lifecycle (BR-08, CA-018, T-047).
   */
  static async triggerAutoSubmitSweep(_params?: AutoSubmitSweepParams): Promise<never> {
    throw new Error(
      'UNIMPLEMENTED: AutoSubmitWorker / sweeper job and BullMQ queue are scheduled for ' +
        'Stream 2 candidate lifecycle (BR-08, CA-018, T-047).',
    );
  }
}
