import type { CandidateDto, CandidateStatus, CreateCandidateDto } from '@hs/contracts';

export type { CandidateDto, CandidateStatus, CreateCandidateDto };

export interface CandidateListResponse {
  items: CandidateDto[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  metrics?: CandidateMetricStats;
}

export interface CandidateFilters {
  search: string;
  status: CandidateStatus | 'all';
  page: number;
  limit: number;
}

export interface UpdateCandidateInput {
  name?: string;
  email?: string;
}

export interface BulkCandidateError {
  rowNumber: number;
  name: string;
  email: string;
  reason: string;
}

export interface BulkCandidateUploadPayload {
  candidates: CreateCandidateDto[];
}

export interface BulkCandidateUploadResponse {
  created: CandidateDto[];
  errors: BulkCandidateError[];
}

export interface CsvValidationPreview {
  validRows: Array<{ rowNumber: number; name: string; email: string }>;
  invalidRows: BulkCandidateError[];
  duplicateRows: BulkCandidateError[];
  totalRows: number;
}

export interface CandidateMetricStats {
  total: number;
  invited: number;
  active: number;
}

