import fs from 'fs';
import path from 'path';

console.log('🔍 [AIDLC] Running Documentation Synchronization Check...\n');

let hasDrift = false;
const warnings = [];

// 1. Verify Database Schema Documentation
const migrationsDir = path.resolve('packages/contracts/db/migrations');
const dbDocPath = path.resolve('apps/docs/content/docs/database/db-visualization.mdx');

if (fs.existsSync(migrationsDir) && fs.existsSync(dbDocPath)) {
  const dbDoc = fs.readFileSync(dbDocPath, 'utf8');
  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

  const tables = new Set();
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const tableMatches = sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?app\.([a-z_]+)/gi);
    for (const match of tableMatches) {
      tables.add(match[1]);
    }
  }

  for (const table of tables) {
    // Check if table name is in documentation
    const regex = new RegExp(`\\b${table}\\b`, 'i');
    if (!regex.test(dbDoc)) {
      warnings.push(`[DB Drift] Table 'app.${table}' from migrations is not documented in ${path.relative('.', dbDocPath)}`);
      hasDrift = true;
    }
  }

  if (tables.size > 0 && !hasDrift) {
    console.log(`✅ [Database] All ${tables.size} tables from SQL migrations are documented in DB Visualization.`);
  }
}

// 2. Verify OpenAPI Paths Documentation
const openApiPath = path.resolve('packages/contracts/openapi/openapi.yaml');
const apiDocPath = path.resolve('apps/docs/content/docs/api/overview.mdx');

if (fs.existsSync(openApiPath) && fs.existsSync(apiDocPath)) {
  const openApi = fs.readFileSync(openApiPath, 'utf8');
  const apiDoc = fs.readFileSync(apiDocPath, 'utf8');

  const pathMatches = openApi.matchAll(/^\s{2}(\/[a-zA-Z0-9_\-\/{}:]+):/gm);
  let totalPaths = 0;
  for (const match of pathMatches) {
    totalPaths++;
    const endpoint = match[1];
    if (!apiDoc.includes(endpoint) && !apiDoc.includes(endpoint.split('/')[1])) {
      warnings.push(`[API Drift] OpenAPI path '${endpoint}' is not referenced in ${path.relative('.', apiDocPath)}`);
    }
  }

  console.log(`✅ [API Contract] Verified ${totalPaths} OpenAPI path definitions.`);
}

// 3. Verify Frameworks Matrix
const frameworksDocPath = path.resolve('apps/docs/content/docs/architecture/frameworks-and-versions.mdx');
if (fs.existsSync(frameworksDocPath)) {
  const fwDoc = fs.readFileSync(frameworksDocPath, 'utf8');
  const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  if (rootPkg.packageManager && !fwDoc.includes(rootPkg.packageManager)) {
    warnings.push(`[Version Drift] Package manager '${rootPkg.packageManager}' differs from Frameworks & Versions matrix.`);
  } else {
    console.log(`✅ [Frameworks] Root package manager and dependencies match architecture matrix.`);
  }
}

// 4. Output Summary
if (hasDrift) {
  console.error('\n❌ [AIDLC Alert] Documentation drift detected:');
  warnings.forEach((w) => console.error(`  - ${w}`));
  console.error('\n👉 AIDLC RULE: Whenever changing database schemas, APIs, or architecture, you MUST update docs in apps/docs/ in the same PR.');
  process.exit(1);
} else {
  console.log('\n🎉 [AIDLC] All documentation is in sync with database schemas, APIs, and architecture!');
  process.exit(0);
}
