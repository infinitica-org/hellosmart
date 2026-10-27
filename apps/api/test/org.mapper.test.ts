import { describe, expect, it } from 'vitest';
import { slugifyOrgName } from '../src/modules/admin/org.mapper.js';

describe('slugifyOrgName', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyOrgName('Brindle & Co')).toBe('brindle-co');
    expect(slugifyOrgName('  Aster Ridge!!! ')).toBe('aster-ridge');
  });
});
