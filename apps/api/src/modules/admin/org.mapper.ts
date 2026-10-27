import type { OrgDto } from '@hs/contracts';

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  logo_key: string | null;
  custom_domain: string | null;
  retention_days: number;
  created_at: Date;
}

export function slugifyOrgName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function toOrgDto(
  row: OrganizationRow,
  planId: string | null = null,
  whiteLabel = false,
): OrgDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status as OrgDto['status'],
    planId,
    logoUrl: row.logo_key ? `https://cdn.hellosmart.ai/${row.logo_key}` : null,
    whiteLabel,
    customDomain: row.custom_domain,
    retentionDays: row.retention_days,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
