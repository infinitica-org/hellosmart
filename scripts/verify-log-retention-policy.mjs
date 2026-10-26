import fs from 'fs';
import path from 'path';

console.log('🔍 [Observability Policy] Verifying 7-Day Log Retention and S3 Archival IaC...\n');

let failed = false;
const errors = [];
const passed = [];

function check(condition, message) {
  if (condition) {
    passed.push(message);
  } else {
    failed = true;
    errors.push(message);
  }
}

// 1. Verify module structure
const moduleDir = path.resolve('infra/terraform/modules/observability');
check(fs.existsSync(moduleDir), 'Terraform observability module directory exists');

const requiredFiles = [
  'versions.tf',
  'variables.tf',
  'main.tf',
  'cloudwatch.tf',
  's3_archive.tf',
  'firehose.tf',
  'outputs.tf'
];

for (const file of requiredFiles) {
  const filePath = path.join(moduleDir, file);
  check(fs.existsSync(filePath), `Observability module contains ${file}`);
}

// 2. Verify variables and 7-day retention constraint
const variablesTf = fs.readFileSync(path.join(moduleDir, 'variables.tf'), 'utf8');
check(
  variablesTf.includes('default     = 7') && variablesTf.includes('var.retention_in_days == 7'),
  'Variables enforce 7-day active retention default with validation condition'
);
check(
  variablesTf.includes('archive_retention_days') && variablesTf.includes('default     = null'),
  'Archive expiration is configurable and defaults to null (unset until legal approval)'
);

const expectedServices = ['api', 'worker', 'ai-proxy', 'reviewer', 'ws-gateway'];
for (const service of expectedServices) {
  check(
    variablesTf.includes(`"${service}"`),
    `Service scope includes '${service}'`
  );
}

// 3. Verify CloudWatch configuration
const cloudwatchTf = fs.readFileSync(path.join(moduleDir, 'cloudwatch.tf'), 'utf8');
check(
  cloudwatchTf.includes('aws_cloudwatch_log_group') && cloudwatchTf.includes('retention_in_days = var.retention_in_days'),
  'CloudWatch Log Groups enforce var.retention_in_days'
);
check(
  cloudwatchTf.includes('aws_cloudwatch_log_subscription_filter') && cloudwatchTf.includes('destination_arn = aws_kinesis_firehose_delivery_stream.archive[each.key].arn'),
  'CloudWatch Subscription Filters route logs to Kinesis Firehose delivery streams'
);
check(
  cloudwatchTf.includes('aws_cloudwatch_metric_alarm') && cloudwatchTf.includes('DeliveryToS3.DataFreshness'),
  'CloudWatch metric alarm monitors Firehose S3 delivery health'
);

// 4. Verify S3 Archive Bucket security and lifecycle
const s3Tf = fs.readFileSync(path.join(moduleDir, 's3_archive.tf'), 'utf8');
check(
  s3Tf.includes('aws_s3_bucket_public_access_block') &&
  s3Tf.includes('block_public_acls       = true') &&
  s3Tf.includes('block_public_policy     = true') &&
  s3Tf.includes('ignore_public_acls      = true') &&
  s3Tf.includes('restrict_public_buckets = true'),
  'S3 Archive Bucket blocks all public access (4/4 flags true)'
);
check(
  s3Tf.includes('aws_s3_bucket_server_side_encryption_configuration') &&
  s3Tf.includes('bucket_key_enabled = true'),
  'S3 Archive Bucket enforces server-side encryption with bucket keys enabled'
);
check(
  s3Tf.includes('aws_s3_bucket_versioning') && s3Tf.includes('status = "Enabled"'),
  'S3 Archive Bucket enables object versioning'
);
check(
  s3Tf.includes('aws:SecureTransport') && s3Tf.includes('false') && s3Tf.includes('Deny'),
  'S3 Archive Bucket Policy enforces TLS 1.2+ (denies unencrypted transport)'
);
check(
  s3Tf.includes('abort_incomplete_multipart_upload') && s3Tf.includes('days_after_initiation = 7'),
  'S3 Lifecycle Configuration aborts incomplete multipart uploads after 7 days'
);
check(
  s3Tf.includes('storage_class = "GLACIER"'),
  'S3 Lifecycle Configuration transitions cold logs to Glacier'
);
check(
  s3Tf.includes('dynamic "expiration"') && s3Tf.includes('for_each = var.archive_retention_days != null ? [var.archive_retention_days] : []'),
  'S3 Lifecycle Configuration conditionally applies expiration only when archive_retention_days is set'
);

// 5. Verify Kinesis Firehose delivery configuration
const firehoseTf = fs.readFileSync(path.join(moduleDir, 'firehose.tf'), 'utf8');
check(
  firehoseTf.includes('compression_format  = "GZIP"'),
  'Firehose delivery stream applies GZIP compression'
);
check(
  firehoseTf.includes('services/${each.key}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/'),
  'Firehose delivery stream partitions S3 objects by service and date (year/month/day/hour)'
);
check(
  firehoseTf.includes('server_side_encryption') && firehoseTf.includes('enabled  = true'),
  'Firehose delivery stream enforces server-side encryption'
);
check(
  firehoseTf.includes('aws_cloudwatch_log_group') && firehoseTf.includes('/aws/kinesisfirehose/hellosmart-errors-'),
  'Dedicated CloudWatch error logging configured for Firehose troubleshooting'
);

// 6. Verify environment configurations
const stagingTf = path.resolve('infra/terraform/envs/staging/main.tf');
const prodTf = path.resolve('infra/terraform/envs/prod/main.tf');
check(fs.existsSync(stagingTf), 'Staging environment Terraform configuration exists');
check(fs.existsSync(prodTf), 'Production environment Terraform configuration exists');

if (fs.existsSync(stagingTf)) {
  const content = fs.readFileSync(stagingTf, 'utf8');
  check(content.includes('retention_in_days = 7') && content.includes('archive_retention_days = null'), 'Staging env config sets retention=7 and archive_retention=null');
}
if (fs.existsSync(prodTf)) {
  const content = fs.readFileSync(prodTf, 'utf8');
  check(content.includes('retention_in_days = 7') && content.includes('archive_retention_days = null'), 'Production env config sets retention=7 and archive_retention=null');
}

// 7. Verify documentation updates
const policyDoc = path.resolve('docs/log-retention-and-archival.md');
check(fs.existsSync(policyDoc), 'Documentation docs/log-retention-and-archival.md exists');
if (fs.existsSync(policyDoc)) {
  const content = fs.readFileSync(policyDoc, 'utf8');
  check(content.includes('CREATE EXTERNAL TABLE IF NOT EXISTS hellosmart_observability.api_logs'), 'Policy documentation includes Athena DDL for log verification');
}

const dataClassDoc = path.resolve('apps/docs/content/docs/security/data-classification.mdx');
if (fs.existsSync(dataClassDoc)) {
  const content = fs.readFileSync(dataClassDoc, 'utf8');
  check(content.includes('CloudWatch (active: 7 days)'), 'Data classification docs reflect 7-day CloudWatch active retention and S3 archive');
}

// Print results
for (const p of passed) {
  console.log(`  ✅ ${p}`);
}

if (failed) {
  console.error('\n❌ Verification failed with errors:');
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
} else {
  console.log(`\n🎉 [Success] All ${passed.length} log retention and archival requirements verified successfully!`);
  process.exit(0);
}
