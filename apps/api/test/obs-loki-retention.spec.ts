import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('portable observability kit', () => {
  it('keeps Loki active retention at 7 days', () => {
    const yaml = readFileSync(resolve('../../infra/observability/loki-config.yaml'), 'utf8');
    expect(yaml).toContain('retention_period: 168h');
    expect(yaml).not.toMatch(/cloudwatch|firehose|x-ray/i);
  });
});
