import type { PatchStatus } from '../submission-bundler.types.js';

export interface PatchResult {
  patchText: string;
  patchStatus: PatchStatus;
  filesChanged: number;
  additions: number;
  deletions: number;
  isPartial: boolean;
  reason?: string | undefined;
}

export interface GeneratePatchParams {
  templateFiles: Map<string, Buffer> | null;
  candidateFiles: Map<string, Buffer>;
  templateModes?: Map<string, number>;
  candidateModes?: Map<string, number>;
  maxPatchSizeBytes?: number;
  maxFileSizeBytes?: number;
  timeoutMs?: number;
}

export interface PatchGeneratorPort {
  generatePatch(params: GeneratePatchParams): Promise<PatchResult>;
}

export const PATCH_GENERATOR_PORT = Symbol('PATCH_GENERATOR_PORT');
