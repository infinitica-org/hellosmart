import { Injectable, Logger } from '@nestjs/common';
import type { NotificationStatus } from '../workspace-reaper.types.js';

export interface WorkspaceNotifierPort {
  /**
   * Notifies the candidate that their workspace has been destroyed (BR-22, CO-044).
   * Returns notification status: 'notified', 'not_implemented', or 'failed'.
   */
  notifyCandidate(params: {
    orgId: string;
    workspaceId: string;
    candidateId: string;
    reason: string;
  }): Promise<NotificationStatus>;
}

export const WORKSPACE_NOTIFIER_PORT = Symbol('WORKSPACE_NOTIFIER_PORT');

@Injectable()
export class NoOpWorkspaceNotifier implements WorkspaceNotifierPort {
  private readonly logger = new Logger(NoOpWorkspaceNotifier.name);

  async notifyCandidate(params: {
    orgId: string;
    workspaceId: string;
    candidateId: string;
    reason: string;
  }): Promise<NotificationStatus> {
    this.logger.debug(
      `Workspace destroy notification for candidate ${params.candidateId} (ws=${params.workspaceId}): notification service template not implemented.`,
    );
    return 'not_implemented';
  }
}

export class FakeWorkspaceNotifier implements WorkspaceNotifierPort {
  public notifications: Array<{
    orgId: string;
    workspaceId: string;
    candidateId: string;
    reason: string;
  }> = [];

  public statusToReturn: NotificationStatus = 'notified';

  async notifyCandidate(params: {
    orgId: string;
    workspaceId: string;
    candidateId: string;
    reason: string;
  }): Promise<NotificationStatus> {
    this.notifications.push(params);
    return this.statusToReturn;
  }
}
