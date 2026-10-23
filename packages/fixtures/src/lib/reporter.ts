export type Outcome = 'created' | 'updated' | 'unchanged' | 'skipped';

export interface EntityCounts {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
}

export class RunReporter {
  private counts = new Map<string, EntityCounts>();
  private startTime = Date.now();

  record(entity: string, outcome: Outcome): void {
    let current = this.counts.get(entity);
    if (!current) {
      current = { created: 0, updated: 0, unchanged: 0, skipped: 0 };
      this.counts.set(entity, current);
    }
    current[outcome]++;
  }

  getTotalCreated(): number {
    let total = 0;
    for (const counts of this.counts.values()) {
      total += counts.created;
    }
    return total;
  }

  getTotalUpdated(): number {
    let total = 0;
    for (const counts of this.counts.values()) {
      total += counts.updated;
    }
    return total;
  }

  printSummary(options: {
    dryRun: boolean;
    targetDb: string;
    logger?: (msg: string) => void;
  }): void {
    const log = options.logger || console.log;
    const elapsedMs = Date.now() - this.startTime;
    log('\n' + '='.repeat(68));
    log(` SEED RUN SUMMARY ${options.dryRun ? '[DRY-RUN - NO WRITES PERFORMED]' : '[COMMITTED]'}`);
    log('='.repeat(68));
    log(` Target Database: ${options.targetDb}`);
    log(` Elapsed Time:    ${elapsedMs}ms\n`);

    log(
      ' ' +
        'Entity'.padEnd(24) +
        'Created'.padStart(10) +
        'Updated'.padStart(10) +
        'Unchanged'.padStart(12) +
        'Skipped'.padStart(10),
    );
    log(' ' + '-'.repeat(66));

    let sumCreated = 0;
    let sumUpdated = 0;
    let sumUnchanged = 0;
    let sumSkipped = 0;

    for (const [entity, c] of this.counts.entries()) {
      sumCreated += c.created;
      sumUpdated += c.updated;
      sumUnchanged += c.unchanged;
      sumSkipped += c.skipped;

      log(
        ' ' +
          entity.padEnd(24) +
          String(c.created).padStart(10) +
          String(c.updated).padStart(10) +
          String(c.unchanged).padStart(12) +
          String(c.skipped).padStart(10),
      );
    }

    log(' ' + '-'.repeat(66));
    log(
      ' ' +
        'TOTALS'.padEnd(24) +
        String(sumCreated).padStart(10) +
        String(sumUpdated).padStart(10) +
        String(sumUnchanged).padStart(12) +
        String(sumSkipped).padStart(10),
    );
    log('='.repeat(68) + '\n');
  }
}
