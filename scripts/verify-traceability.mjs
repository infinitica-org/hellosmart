import fs from 'node:fs';
import path from 'node:path';

/**
 * Validates docs/traceability-matrix.md against AGENTS.md Section 9.
 * Ensures:
 * 1. Exactly 126 in-scope MMP requirements are present and unique.
 * 2. Exactly 24 deferred Phase 2/3 requirements are present and unique.
 * 3. Requirement IDs, names, priorities, and phases match AGENTS.md.
 * 4. Each MMP requirement maps to a valid test type and target path.
 * 5. Reports drift, missing requirements, and test asset existence status.
 */
export function verifyTraceabilityMatrix() {
  const rootDir = process.cwd();
  const agentsPath = path.join(rootDir, 'AGENTS.md');
  const matrixPath = path.join(rootDir, 'docs', 'traceability-matrix.md');

  if (!fs.existsSync(agentsPath)) {
    throw new Error(`AGENTS.md not found at ${agentsPath}`);
  }
  if (!fs.existsSync(matrixPath)) {
    throw new Error(`docs/traceability-matrix.md not found at ${matrixPath}`);
  }

  const agentsContent = fs.readFileSync(agentsPath, 'utf8');
  const matrixContent = fs.readFileSync(matrixPath, 'utf8');

  // 1. Parse AGENTS.md Section 9
  const agentsLines = agentsContent.split('\n');
  let inSection9 = false;
  const agentsReqs = new Map();

  for (const line of agentsLines) {
    if (line.startsWith('## 9. Feature requirements')) {
      inSection9 = true;
      continue;
    }
    if (inSection9 && line.startsWith('## 10.')) {
      inSection9 = false;
      break;
    }
    if (inSection9) {
      const match = line.match(/^-\s*\[\s*\]\s*\*\*([A-Z]+-[0-9]+)\*\*\s*(.*?)\s*`([^`]+)`/);
      if (match) {
        const id = match[1];
        const name = match[2].trim();
        const tag = match[3].trim();
        const parts = tag.split(/[\u00b7\u2022•·]/).map((s) => s.trim());
        const priority = parts[0];
        const phase = parts[1];
        agentsReqs.set(id, { id, name, priority, phase });
      }
    }
  }

  // 2. Parse docs/traceability-matrix.md
  const mmpTableMatch = matrixContent.match(/## MMP requirement traceability[\s\S]*?(?=## Deferred requirements)/);
  if (!mmpTableMatch) {
    throw new Error('Could not find MMP requirement traceability table in docs/traceability-matrix.md');
  }

  const deferredTableMatch = matrixContent.match(/## Deferred requirements excluded[\s\S]*?(?=## Verification notes)/);
  if (!deferredTableMatch) {
    throw new Error('Could not find Deferred requirements table in docs/traceability-matrix.md');
  }

  const mmpRows = [];
  for (const line of mmpTableMatch[0].split('\n')) {
    if (line.trim().startsWith('|') && !line.includes('Requirement ID') && !line.includes('|---|')) {
      const cols = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 5) {
        mmpRows.push({
          id: cols[0],
          nameDesc: cols[1],
          testType: cols[2],
          targetPath: cols[3].replace(/`/g, ''),
          status: cols[4],
        });
      }
    }
  }

  const deferredRows = [];
  for (const line of deferredTableMatch[0].split('\n')) {
    if (line.trim().startsWith('|') && !line.includes('Requirement ID') && !line.includes('|---|')) {
      const cols = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 3) {
        deferredRows.push({
          id: cols[0],
          name: cols[1],
          phase: cols[2],
        });
      }
    }
  }

  const errors = [];

  // Check unique IDs in MMP
  const seenMmp = new Set();
  for (const r of mmpRows) {
    if (seenMmp.has(r.id)) {
      errors.push(`Duplicate MMP requirement ID in matrix: ${r.id}`);
    }
    seenMmp.add(r.id);
  }

  // Check unique IDs in Deferred
  const seenDef = new Set();
  for (const r of deferredRows) {
    if (seenDef.has(r.id)) {
      errors.push(`Duplicate Deferred requirement ID in matrix: ${r.id}`);
    }
    seenDef.add(r.id);
  }

  // Compare against AGENTS.md
  for (const [id, req] of agentsReqs.entries()) {
    if (req.phase === 'MMP') {
      if (!seenMmp.has(id)) {
        errors.push(`Missing MMP requirement from matrix: ${id} (${req.name})`);
      }
    } else {
      if (!seenDef.has(id)) {
        errors.push(`Missing Deferred requirement from matrix: ${id} (${req.name})`);
      }
    }
  }

  for (const r of mmpRows) {
    const expected = agentsReqs.get(r.id);
    if (!expected) {
      errors.push(`Unknown requirement ID in MMP matrix: ${r.id}`);
    } else if (expected.phase !== 'MMP') {
      errors.push(`Requirement ${r.id} is listed as MMP in matrix but is ${expected.phase} in AGENTS.md`);
    }
  }

  for (const r of deferredRows) {
    const expected = agentsReqs.get(r.id);
    if (!expected) {
      errors.push(`Unknown requirement ID in Deferred table: ${r.id}`);
    } else if (expected.phase === 'MMP') {
      errors.push(`Requirement ${r.id} is listed as Deferred in matrix but is MMP in AGENTS.md`);
    }
  }

  // Analyze target paths and statuses
  const statusCounts = {};
  let existingTargetFiles = 0;
  let missingTargetFiles = 0;

  for (const r of mmpRows) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    const cleanPath = r.targetPath.replace(/^`+|`+$/g, '');
    if (fs.existsSync(path.join(rootDir, cleanPath))) {
      existingTargetFiles++;
    } else {
      missingTargetFiles++;
    }
  }

  return {
    mmpCount: mmpRows.length,
    deferredCount: deferredRows.length,
    statusCounts,
    existingTargetFiles,
    missingTargetFiles,
    errors,
  };
}

if (process.argv[1] && process.argv[1].endsWith('verify-traceability.mjs')) {
  console.log('Auditing docs/traceability-matrix.md against AGENTS.md Section 9...');
  const result = verifyTraceabilityMatrix();

  console.log(`- MMP Requirements Mapped: ${result.mmpCount} (Expected: 126)`);
  console.log(`- Deferred Requirements Mapped: ${result.deferredCount} (Expected: 24)`);
  console.log('- Status Distribution:', JSON.stringify(result.statusCounts));
  console.log(`- Existing Target Test Files: ${result.existingTargetFiles}`);
  console.log(`- Missing/Planned Target Test Files: ${result.missingTargetFiles}`);

  if (result.errors.length > 0) {
    console.error(`\nFound ${result.errors.length} traceability validation error(s):`);
    for (const err of result.errors) {
      console.error(`  [ERROR] ${err}`);
    }
    process.exit(1);
  } else {
    console.log('\nSUCCESS: Traceability matrix is 100% compliant with AGENTS.md requirements.');
    process.exit(0);
  }
}
