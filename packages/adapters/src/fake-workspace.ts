import crypto from 'node:crypto';
import type { WorkspaceRuntime } from './index.js';

export interface FakeSlotRecord {
  slotId: string;
  hostId: string;
  orgId: string;
  workspaceId: string;
  image: string;
  size: 'small' | 'medium' | 'dedicated';
  egressAllow: string[];
  aiEnabled: boolean;
  status: 'running' | 'destroyed';
  snapshots: string[];
  createdAt: Date;
  destroyedAt?: Date;
}

export class FakeWorkspaceRuntime implements WorkspaceRuntime {
  private slots = new Map<string, FakeSlotRecord>();
  private defaultHostId: string;

  constructor(defaultHostId: string = 'host_fake_01') {
    this.defaultHostId = defaultHostId;
  }

  async createSlot(input: {
    orgId: string;
    workspaceId: string;
    image: string;
    size: 'small' | 'medium' | 'dedicated';
    egressAllow: string[];
    aiEnabled: boolean;
  }): Promise<{ slotId: string; hostId: string }> {
    const slotId = `slot_fake_${crypto.randomUUID().slice(0, 8)}`;
    const hostId = this.defaultHostId;

    const record: FakeSlotRecord = {
      ...input,
      slotId,
      hostId,
      status: 'running',
      snapshots: [],
      createdAt: new Date(),
    };

    this.slots.set(slotId, record);
    return { slotId, hostId };
  }

  async snapshot(slotId: string): Promise<{ snapshotKey: string }> {
    const slot = this.slots.get(slotId);
    if (!slot) {
      throw new Error(`Slot ${slotId} not found`);
    }
    if (slot.status === 'destroyed') {
      throw new Error(`Cannot snapshot destroyed slot ${slotId}`);
    }

    const snapshotKey = `snapshots/${slot.orgId}/${slot.workspaceId}/${Date.now()}_${crypto.randomUUID().slice(0, 6)}.tar.gz`;
    slot.snapshots.push(snapshotKey);
    return { snapshotKey };
  }

  async destroy(slotId: string): Promise<void> {
    const slot = this.slots.get(slotId);
    if (slot) {
      slot.status = 'destroyed';
      slot.destroyedAt = new Date();
    }
  }

  getSlot(slotId: string): FakeSlotRecord | undefined {
    return this.slots.get(slotId);
  }

  getAllSlots(): FakeSlotRecord[] {
    return Array.from(this.slots.values());
  }

  clear(): void {
    this.slots.clear();
  }
}
