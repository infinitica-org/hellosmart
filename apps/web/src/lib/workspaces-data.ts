import type {
  AdminWorkspaceListItemDto,
  AdminWorkspaceDetailDto,
  AdminWorkspacesListResponseDto,
  AdminWorkspaceQueryDto,
  EmergencyDestroyResponseDto,
} from '@hs/contracts';

let mockWorkspaces: AdminWorkspaceListItemDto[] = [
  {
    id: '88888888-8888-4888-8888-888888888881',
    orgId: '22222222-2222-4222-8222-222222222222',
    orgName: 'Acme Corp',
    orgSlug: 'acme-corp',
    candidateId: '33333333-3333-4333-8333-333333333331',
    candidateName: 'Alex Rivera',
    candidateEmail: 'alex.rivera@example.test',
    assignmentId: '44444444-4444-4444-8444-444444444441',
    assessmentId: '55555555-5555-4555-8555-555555555551',
    assessmentName: 'Senior Backend Engineer Challenge',
    mode: 'cloud',
    status: 'connected',
    runtimeRef: 'hs-container-vm-101',
    snapshotRef: 's3://hellosmart-snapshots/ws-8881/snapshot.tar.gz',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    lastActivityAt: new Date(Date.now() - 120000).toISOString(),
    disconnectedAt: null,
    endedAt: null,
    deadlineAt: new Date(Date.now() + 7200000).toISOString(),
    idleMinutes: 2,
    isOnline: true,
    spendInfo: {
      meteringStatus: 'unconnected',
      meteringNotice: 'AI proxy runtime metering unconnected',
      allocatedAmountCents: 10000,
      usedAmountCents: 0,
      balanceCents: 10000,
      markupPercentage: 15.0,
      spendCapCents: 20000,
    },
  },
  {
    id: '88888888-8888-4888-8888-888888888882',
    orgId: '22222222-2222-4222-8222-222222222222',
    orgName: 'Acme Corp',
    orgSlug: 'acme-corp',
    candidateId: '33333333-3333-4333-8333-333333333332',
    candidateName: 'Priya Sharma',
    candidateEmail: 'priya.sharma@example.test',
    assignmentId: '44444444-4444-4444-8444-444444444442',
    assessmentId: '55555555-5555-4555-8555-555555555552',
    assessmentName: 'Full Stack Engineer Evaluation',
    mode: 'chat',
    status: 'disconnected',
    runtimeRef: 'hs-chat-runner-202',
    snapshotRef: null,
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    lastActivityAt: new Date(Date.now() - 900000).toISOString(),
    disconnectedAt: new Date(Date.now() - 900000).toISOString(),
    endedAt: null,
    deadlineAt: new Date(Date.now() + 3600000).toISOString(),
    idleMinutes: 15,
    isOnline: false,
    spendInfo: {
      meteringStatus: 'unconnected',
      meteringNotice: 'AI proxy runtime metering unconnected',
      allocatedAmountCents: 10000,
      usedAmountCents: 0,
      balanceCents: 10000,
      markupPercentage: 15.0,
      spendCapCents: 20000,
    },
  },
  {
    id: '88888888-8888-4888-8888-888888888883',
    orgId: '99999999-9999-4999-8999-999999999999',
    orgName: 'Initech Global',
    orgSlug: 'initech-global',
    candidateId: '33333333-3333-4333-8333-333333333333',
    candidateName: 'David Kim',
    candidateEmail: 'david.kim@example.test',
    assignmentId: '44444444-4444-4444-8444-444444444443',
    assessmentId: '55555555-5555-4555-8555-555555555553',
    assessmentName: 'DevOps & Cloud Reliability Challenge',
    mode: 'cloud',
    status: 'ended',
    runtimeRef: 'hs-container-vm-303',
    snapshotRef: 's3://hellosmart-snapshots/ws-8883/final.tar.gz',
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    lastActivityAt: new Date(Date.now() - 82800000).toISOString(),
    disconnectedAt: null,
    endedAt: new Date(Date.now() - 82800000).toISOString(),
    deadlineAt: new Date(Date.now() - 82800000).toISOString(),
    idleMinutes: 1380,
    isOnline: false,
    spendInfo: {
      meteringStatus: 'unconnected',
      meteringNotice: 'AI proxy runtime metering unconnected',
      allocatedAmountCents: null,
      usedAmountCents: null,
      balanceCents: null,
      markupPercentage: null,
      spendCapCents: null,
    },
  },
];

export function getMockWorkspacesList(
  query: AdminWorkspaceQueryDto = {},
): AdminWorkspacesListResponseDto {
  let filtered = [...mockWorkspaces];

  if (query.org_id) {
    filtered = filtered.filter((w) => w.orgId === query.org_id);
  }

  if (query.status && query.status !== 'all') {
    if (query.status === 'active') {
      filtered = filtered.filter((w) =>
        ['queued', 'provisioning', 'not_connected', 'connected', 'disconnected'].includes(
          w.status,
        ),
      );
    } else {
      filtered = filtered.filter((w) => w.status === query.status);
    }
  }

  if (query.mode && query.mode !== 'all') {
    filtered = filtered.filter((w) => w.mode === query.mode);
  }

  if (query.search && query.search.trim()) {
    const term = query.search.trim().toLowerCase();
    filtered = filtered.filter(
      (w) =>
        w.candidateName.toLowerCase().includes(term) ||
        w.candidateEmail.toLowerCase().includes(term) ||
        w.orgName.toLowerCase().includes(term) ||
        w.assessmentName.toLowerCase().includes(term) ||
        w.id.toLowerCase().includes(term),
    );
  }

  const page = query.page || 1;
  const pageSize = query.page_size || 25;
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalWorkspaces = mockWorkspaces.length;
  const activeWorkspaces = mockWorkspaces.filter((w) =>
    ['queued', 'provisioning', 'not_connected', 'connected', 'disconnected'].includes(w.status),
  ).length;
  const connectedCount = mockWorkspaces.filter((w) => w.status === 'connected').length;
  const disconnectedCount = mockWorkspaces.filter((w) => w.status === 'disconnected').length;
  const destroyedCount = mockWorkspaces.filter((w) => w.status === 'destroyed').length;
  const endedCount = mockWorkspaces.filter((w) => w.status === 'ended').length;
  const trackedTenantsCount = new Set(mockWorkspaces.map((w) => w.orgId)).size;

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    metrics: {
      totalWorkspaces,
      activeWorkspaces,
      connectedCount,
      disconnectedCount,
      destroyedCount,
      endedCount,
      trackedTenantsCount,
    },
  };
}

export function getMockWorkspaceDetail(id: string): AdminWorkspaceDetailDto | null {
  const ws = mockWorkspaces.find((w) => w.id === id);
  if (!ws) return null;

  return {
    ...ws,
    recentEvents: [
      {
        id: '77777777-7777-4777-8777-777777777771',
        type: 'connect',
        payload: { pauseTimerOnDisconnect: false },
        ip: '192.168.1.100',
        at: ws.startedAt,
      },
    ],
    tenantCreditAllocation: ws.spendInfo.allocatedAmountCents != null
      ? {
          id: '66666666-6666-4666-8666-666666666661',
          allocatedAmountCents: ws.spendInfo.allocatedAmountCents,
          usedAmountCents: ws.spendInfo.usedAmountCents || 0,
          balanceCents: ws.spendInfo.balanceCents || ws.spendInfo.allocatedAmountCents,
          markupPercentage: ws.spendInfo.markupPercentage || 15.0,
          spendCapCents: ws.spendInfo.spendCapCents ?? null,
          status: 'active',
        }
      : null,
    assignmentTiming: {
      deadlineAt: ws.deadlineAt ?? null,
      extendedMinutes: 0,
      firstConnectAt: ws.startedAt,
      submittedAt: ws.endedAt ?? null,
      autoSubmitted: false,
      writeRevokedAt: ws.status === 'destroyed' ? ws.endedAt ?? null : null,
    },
  };
}

export function destroyMockWorkspace(
  id: string,
  reason: string,
): EmergencyDestroyResponseDto | null {
  const idx = mockWorkspaces.findIndex((w) => w.id === id);
  if (idx === -1) return null;

  const current = mockWorkspaces[idx]!;
  if (current.status === 'destroyed' || current.status === 'ended') {
    throw new Error('WORKSPACE_ALREADY_TERMINATED');
  }

  const nowIso = new Date().toISOString();
  mockWorkspaces[idx] = {
    ...current,
    status: 'destroyed',
    endedAt: nowIso,
    isOnline: false,
  };

  return {
    success: true,
    workspaceId: id,
    status: 'destroyed',
    destroyedAt: nowIso,
    assignmentRevoked: true,
    reason,
    limitations: {
      runtimeTerminated: false,
      snapshotSaved: Boolean(current.snapshotRef),
      candidateNotified: false,
      notice:
        'Database status updated and assignment write capability revoked. Hypervisor container termination and push notifications are not connected in MMP; candidate session will disconnect on next ping.',
    },
  };
}

export function resetMockWorkspaces(): void {
  // Resets to initial mock items for tests
  mockWorkspaces = [
    {
      id: '88888888-8888-4888-8888-888888888881',
      orgId: '22222222-2222-4222-8222-222222222222',
      orgName: 'Acme Corp',
      orgSlug: 'acme-corp',
      candidateId: '33333333-3333-4333-8333-333333333331',
      candidateName: 'Alex Rivera',
      candidateEmail: 'alex.rivera@example.test',
      assignmentId: '44444444-4444-4444-8444-444444444441',
      assessmentId: '55555555-5555-4555-8555-555555555551',
      assessmentName: 'Senior Backend Engineer Challenge',
      mode: 'cloud',
      status: 'connected',
      runtimeRef: 'hs-container-vm-101',
      snapshotRef: 's3://hellosmart-snapshots/ws-8881/snapshot.tar.gz',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      lastActivityAt: new Date(Date.now() - 120000).toISOString(),
      disconnectedAt: null,
      endedAt: null,
      deadlineAt: new Date(Date.now() + 7200000).toISOString(),
      idleMinutes: 2,
      isOnline: true,
      spendInfo: {
        meteringStatus: 'unconnected',
        meteringNotice: 'AI proxy runtime metering unconnected',
        allocatedAmountCents: 10000,
        usedAmountCents: 0,
        balanceCents: 10000,
        markupPercentage: 15.0,
        spendCapCents: 20000,
      },
    },
    {
      id: '88888888-8888-4888-8888-888888888882',
      orgId: '22222222-2222-4222-8222-222222222222',
      orgName: 'Acme Corp',
      orgSlug: 'acme-corp',
      candidateId: '33333333-3333-4333-8333-333333333332',
      candidateName: 'Priya Sharma',
      candidateEmail: 'priya.sharma@example.test',
      assignmentId: '44444444-4444-4444-8444-444444444442',
      assessmentId: '55555555-5555-4555-8555-555555555552',
      assessmentName: 'Full Stack Engineer Evaluation',
      mode: 'chat',
      status: 'disconnected',
      runtimeRef: 'hs-chat-runner-202',
      snapshotRef: null,
      startedAt: new Date(Date.now() - 7200000).toISOString(),
      lastActivityAt: new Date(Date.now() - 900000).toISOString(),
      disconnectedAt: new Date(Date.now() - 900000).toISOString(),
      endedAt: null,
      deadlineAt: new Date(Date.now() + 3600000).toISOString(),
      idleMinutes: 15,
      isOnline: false,
      spendInfo: {
        meteringStatus: 'unconnected',
        meteringNotice: 'AI proxy runtime metering unconnected',
        allocatedAmountCents: 10000,
        usedAmountCents: 0,
        balanceCents: 10000,
        markupPercentage: 15.0,
        spendCapCents: 20000,
      },
    },
  ];
}

