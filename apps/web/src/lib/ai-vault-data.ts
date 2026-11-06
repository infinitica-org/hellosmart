import type {
  PlatformAiKeyDto,
  CreditAllocationDto,
  PlatformAiVaultStatsDto,
  CreatePlatformAiKeyDto,
  UpdatePlatformAiKeyDto,
  CreateCreditAllocationDto,
  AdjustCreditAllocationDto,
  AiProvider,
} from '@hs/contracts';

let keysStore: PlatformAiKeyDto[] = [];
let allocationsStore: CreditAllocationDto[] = [];

function formatMaskedKey(provider: AiProvider, last4: string): string {
  switch (provider) {
    case 'openai':
      return `sk-...${last4}`;
    case 'anthropic':
      return `sk-ant-...${last4}`;
    case 'gemini':
      return `AIza...${last4}`;
    case 'deepseek':
      return `sk-ds-...${last4}`;
    default:
      return `...${last4}`;
  }
}

export function getPlatformAiKeys(): PlatformAiKeyDto[] {
  return [...keysStore];
}

export function getPlatformAiKeyById(id: string): PlatformAiKeyDto | null {
  return keysStore.find((k) => k.id === id) || null;
}

export function createPlatformAiKey(
  input: CreatePlatformAiKeyDto,
  creatorId = 'usr_admin',
): PlatformAiKeyDto {
  const last4 = input.apiKey.trim().slice(-4);
  const newKey: PlatformAiKeyDto = {
    id: `00000000-0000-0000-0000-${Date.now().toString(16).padStart(12, '0')}`,
    provider: input.provider,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    keyLast4: last4,
    maskedKey: formatMaskedKey(input.provider, last4),
    status: 'active',
    isActive: true,
    totalAllocatedCents: 0,
    activeAllocationsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastTestedAt: null,
  };

  keysStore.unshift(newKey);
  return newKey;
}

export function updatePlatformAiKey(
  id: string,
  input: UpdatePlatformAiKeyDto,
): PlatformAiKeyDto {
  const index = keysStore.findIndex((k) => k.id === id);
  if (index === -1) {
    throw new Error(`Platform AI Key "${id}" not found.`);
  }

  const existing = keysStore[index]!;
  let keyLast4 = existing.keyLast4;
  let maskedKey = existing.maskedKey;

  if (input.apiKey && input.apiKey.trim().length >= 8) {
    keyLast4 = input.apiKey.trim().slice(-4);
    maskedKey = formatMaskedKey(existing.provider, keyLast4);
  }

  const status = input.status ?? existing.status;
  const updated: PlatformAiKeyDto = {
    ...existing,
    name: input.name?.trim() ?? existing.name,
    description: input.description !== undefined ? input.description?.trim() || null : existing.description,
    status,
    isActive: status === 'active',
    keyLast4,
    maskedKey,
    updatedAt: new Date().toISOString(),
  };

  keysStore[index] = updated;
  return updated;
}

export function deletePlatformAiKey(id: string): PlatformAiKeyDto {
  const index = keysStore.findIndex((k) => k.id === id);
  if (index === -1) {
    throw new Error(`Platform AI Key "${id}" not found.`);
  }

  const existing = keysStore[index]!;
  const updated: PlatformAiKeyDto = {
    ...existing,
    status: 'revoked',
    isActive: false,
    updatedAt: new Date().toISOString(),
  };

  keysStore[index] = updated;
  return updated;
}

export function testPlatformAiKey(id: string): { success: boolean; message: string; testedAt: string } {
  const key = keysStore.find((k) => k.id === id);
  if (!key) {
    throw new Error(`Platform AI Key "${id}" not found.`);
  }

  const testedAt = new Date().toISOString();
  key.lastTestedAt = testedAt;
  return {
    success: key.status === 'active',
    message: key.status === 'active' ? 'Connection validated successfully' : 'Key is inactive or revoked',
    testedAt,
  };
}

export function getCreditAllocations(filters?: {
  orgId?: string | undefined;
  platformKeyId?: string | undefined;
  status?: string | undefined;
}): CreditAllocationDto[] {
  let list = [...allocationsStore];
  if (filters?.orgId) {
    list = list.filter((a) => a.orgId === filters.orgId);
  }
  if (filters?.platformKeyId) {
    list = list.filter((a) => a.platformKeyId === filters.platformKeyId);
  }
  if (filters?.status) {
    list = list.filter((a) => a.status === filters.status);
  }
  return list;
}

export function getCreditAllocationById(id: string): CreditAllocationDto | null {
  return allocationsStore.find((a) => a.id === id) || null;
}

export function createCreditAllocation(
  input: CreateCreditAllocationDto,
  creatorId = 'usr_admin',
): CreditAllocationDto {
  const key = keysStore.find((k) => k.id === input.platformKeyId);
  if (!key) {
    throw new Error(`Platform Key "${input.platformKeyId}" not found.`);
  }

  const existingActive = allocationsStore.find(
    (a) => a.orgId === input.orgId && a.platformKeyId === input.platformKeyId && a.status === 'active',
  );
  if (existingActive) {
    throw new Error(`Active credit allocation already exists for this organization and key.`);
  }

  const newAllocation: CreditAllocationDto = {
    id: `00000000-0000-0000-0001-${Date.now().toString(16).padStart(12, '0')}`,
    orgId: input.orgId,
    orgName: `Tenant Org (${input.orgId.slice(0, 8)})`,
    platformKeyId: input.platformKeyId,
    platformKeyName: key.name,
    provider: key.provider,
    maskedKey: key.maskedKey,
    allocatedAmountCents: input.allocatedAmountCents,
    usedAmountCents: 0,
    balanceCents: input.allocatedAmountCents,
    markupPercentage: input.markupPercentage ?? 15.0,
    tokenCap: input.tokenCap ?? null,
    spendCapCents: input.spendCapCents ?? null,
    status: 'active',
    notes: input.notes?.trim() || null,
    expiresAt: input.expiresAt ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  allocationsStore.unshift(newAllocation);

  key.totalAllocatedCents += input.allocatedAmountCents;
  key.activeAllocationsCount += 1;

  return newAllocation;
}

export function adjustCreditAllocation(
  id: string,
  input: AdjustCreditAllocationDto,
): CreditAllocationDto {
  const index = allocationsStore.findIndex((a) => a.id === id);
  if (index === -1) {
    throw new Error(`Credit allocation "${id}" not found.`);
  }

  const existing = allocationsStore[index]!;
  if (existing.status === 'revoked') {
    throw new Error('Cannot adjust a revoked credit allocation.');
  }

  const allocatedAmountCents = existing.allocatedAmountCents + input.adjustmentAmountCents;
  const balanceCents = allocatedAmountCents - existing.usedAmountCents;
  if (balanceCents < 0) {
    throw new Error(
      `Adjusted allocation would result in negative balance (${balanceCents} cents). Minimum required: ${existing.usedAmountCents} cents.`,
    );
  }

  const status = balanceCents === 0 ? 'exhausted' : 'active';

  const updated: CreditAllocationDto = {
    ...existing,
    allocatedAmountCents,
    balanceCents,
    status,
    markupPercentage: input.markupPercentage ?? existing.markupPercentage,
    expiresAt: input.expiresAt !== undefined ? input.expiresAt : existing.expiresAt,
    notes: existing.notes ? `${existing.notes} | Adj: ${input.reason}` : `Adj: ${input.reason}`,
    updatedAt: new Date().toISOString(),
  };

  allocationsStore[index] = updated;
  return updated;
}

export function revokeCreditAllocation(
  id: string,
  reason: string,
): CreditAllocationDto {
  const index = allocationsStore.findIndex((a) => a.id === id);
  if (index === -1) {
    throw new Error(`Credit allocation "${id}" not found.`);
  }

  const existing = allocationsStore[index]!;
  const updated: CreditAllocationDto = {
    ...existing,
    status: 'revoked',
    notes: existing.notes ? `${existing.notes} | Revoked: ${reason}` : `Revoked: ${reason}`,
    updatedAt: new Date().toISOString(),
  };

  allocationsStore[index] = updated;

  const key = keysStore.find((k) => k.id === existing.platformKeyId);
  if (key && key.activeAllocationsCount > 0) {
    key.activeAllocationsCount -= 1;
  }

  return updated;
}

export function getAiVaultStats(): PlatformAiVaultStatsDto {
  const totalKeys = keysStore.length;
  const activeKeys = keysStore.filter((k) => k.status === 'active').length;
  const totalAllocations = allocationsStore.length;
  const totalAllocatedCents = allocationsStore.reduce((sum, a) => sum + a.allocatedAmountCents, 0);
  const totalUsedCents = allocationsStore.reduce((sum, a) => sum + a.usedAmountCents, 0);
  const totalRemainingBalanceCents = totalAllocatedCents - totalUsedCents;

  return {
    totalKeys,
    activeKeys,
    totalAllocations,
    totalAllocatedCents,
    totalUsedCents,
    totalRemainingBalanceCents,
  };
}

export function resetAiVaultStore(): void {
  keysStore = [];
  allocationsStore = [];
}
