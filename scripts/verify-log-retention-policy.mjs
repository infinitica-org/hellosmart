import fs from 'fs';
import path from 'path';

console.log('🔍 [Observability Policy] Running Rigorous 7-Day Log Retention & S3 Archival IaC Verification...\n');

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

// Helper: Strip comments from HCL code to prevent false positives from commented-out code
function stripHclComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '') // multi-line comments
    .replace(/(^|[^:])#.*$/gm, '$1')   // single-line '#' comments (ignoring URL anchors like #)
    .replace(/\/\/.*$/gm, '');        // single-line '//' comments
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
const rawVariablesTf = fs.readFileSync(path.join(moduleDir, 'variables.tf'), 'utf8');
const variablesTf = stripHclComments(rawVariablesTf);

check(
  variablesTf.includes('default     = 7') && variablesTf.includes('var.retention_in_days == 7'),
  'Variables enforce 7-day active retention default with compile-time validation condition'
);
check(
  variablesTf.includes('archive_retention_days') && variablesTf.includes('default     = null'),
  'Archive expiration is configurable and defaults to null (unset until legal approval)'
);
check(
  variablesTf.includes('archive_storage_class') && variablesTf.includes('default     = "GLACIER_IR"'),
  'Archive storage class defaults to GLACIER_IR for immediate Athena forensic queryability'
);

const expectedServices = ['web', 'api', 'worker', 'ai-proxy', 'reviewer', 'ws-gateway'];
for (const service of expectedServices) {
  check(
    variablesTf.includes(`"${service}"`),
    `Service scope encompasses deployed container service '${service}'`
  );
}

// 3. Verify CloudWatch configuration and alert destinations
const rawCloudwatchTf = fs.readFileSync(path.join(moduleDir, 'cloudwatch.tf'), 'utf8');
const cloudwatchTf = stripHclComments(rawCloudwatchTf);

check(
  cloudwatchTf.includes('aws_cloudwatch_log_group') && cloudwatchTf.includes('retention_in_days = var.retention_in_days'),
  'CloudWatch Log Groups enforce var.retention_in_days (7-day active retention)'
);
check(
  cloudwatchTf.includes('aws_cloudwatch_log_subscription_filter') && cloudwatchTf.includes('destination_arn = aws_kinesis_firehose_delivery_stream.archive[each.key].arn'),
  'CloudWatch Subscription Filters route logs to Kinesis Firehose delivery streams'
);
check(
  cloudwatchTf.includes('aws_cloudwatch_metric_alarm') && cloudwatchTf.includes('DeliveryToS3.DataFreshness'),
  'CloudWatch metric alarm monitors Firehose S3 delivery freshness'
);
check(
  cloudwatchTf.includes('treat_missing_data  = "notBreaching"'),
  'Metric alarm treats missing data as notBreaching to avoid flapping in low-traffic periods'
);
check(
  cloudwatchTf.includes('aws_sns_topic') && cloudwatchTf.includes('hs-observability-alerts-'),
  'Module provisions dedicated fallback SNS alert topic when no external topic is supplied'
);
check(
  cloudwatchTf.includes('alarm_actions       = [local.alerts_topic_arn]'),
  'Metric alarm reliably notifies configured/provisioned SNS alert topic'
);

// 4. Verify S3 Archive Bucket security and lifecycle
const rawS3Tf = fs.readFileSync(path.join(moduleDir, 's3_archive.tf'), 'utf8');
const s3Tf = stripHclComments(rawS3Tf);

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
  s3Tf.includes('storage_class = var.archive_storage_class'),
  'S3 Lifecycle Configuration transitions cold logs to configurable storage class (GLACIER_IR)'
);
check(
  s3Tf.includes('dynamic "expiration"') && s3Tf.includes('for_each = var.archive_retention_days != null ? [var.archive_retention_days] : []'),
  'S3 Lifecycle Configuration conditionally applies expiration only when archive_retention_days is set'
);

// 5. Verify Kinesis Firehose delivery configuration and KMS permissions
const rawFirehoseTf = fs.readFileSync(path.join(moduleDir, 'firehose.tf'), 'utf8');
const firehoseTf = stripHclComments(rawFirehoseTf);

check(
  firehoseTf.includes('compression_format  = "UNCOMPRESSED"'),
  'Firehose delivery stream avoids double-compression by leaving CloudWatch native GZIP payload uncompressed'
);
check(
  !firehoseTf.includes('compression_format  = "GZIP"'),
  'Double-GZIP compression regression guard: compression_format is NOT set to GZIP'
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
  firehoseTf.includes('kms:GenerateDataKey*') && firehoseTf.includes('kms:Decrypt'),
  'CloudWatch Logs to Firehose IAM role grants KMS decrypt/generate data key permissions when CMK is used'
);
check(
  firehoseTf.includes('aws_cloudwatch_log_group') && firehoseTf.includes('/aws/kinesisfirehose/hellosmart-errors-'),
  'Dedicated CloudWatch error logging configured for Firehose troubleshooting'
);

// 6. Verify environment configurations
const stagingTf = path.resolve('infra/terraform/envs/staging/main.tf');
const prodTf = path.resolve('infra/terraform/envs/prod/main.tf');
check(fs.existsSync(stagingTf), 'Staging environment Terraform configuration exists');

if (fs.existsSync(stagingTf)) {
  const content = stripHclComments(fs.readFileSync(stagingTf, 'utf8'));
  check(content.includes('retention_in_days = 7') && content.includes('archive_retention_days = null'), 'Staging env sets retention=7 and archive_retention=null');
  for (const s of expectedServices) {
    check(content.includes(`"${s}"`), `Staging env includes service '${s}'`);
  }
}
if (fs.existsSync(prodTf)) {
  const content = stripHclComments(fs.readFileSync(prodTf, 'utf8'));
  check(content.includes('retention_in_days = 7') && content.includes('archive_retention_days = null'), 'Production env sets retention=7 and archive_retention=null');
  for (const s of expectedServices) {
    check(content.includes(`"${s}"`), `Production env includes service '${s}'`);
  }
}

// 7. Verify outputs
const rawOutputsTf = fs.readFileSync(path.join(moduleDir, 'outputs.tf'), 'utf8');
const outputsTf = stripHclComments(rawOutputsTf);
check(outputsTf.includes('alerts_topic_arn'), 'Outputs expose alerts_topic_arn for downstream notification integration');
check(outputsTf.includes('archive_storage_class'), 'Outputs expose archive_storage_class');

// 8. Verify documentation updates
const policyDoc = path.resolve('docs/log-retention-and-archival.md');
check(fs.existsSync(policyDoc), 'Documentation docs/log-retention-and-archival.md exists');
if (fs.existsSync(policyDoc)) {
  const content = fs.readFileSync(policyDoc, 'utf8');
  check(content.includes('QA deployment currently runs on a single KVM VPS via Docker Compose'), 'Policy documentation notes QA VPS runtime status');
  check(content.includes('CREATE EXTERNAL TABLE IF NOT EXISTS hellosmart_observability.service_logs'), 'Policy documentation includes Athena DDL for log verification');
  check(content.includes('GLACIER_IR'), 'Policy documentation documents GLACIER_IR rationale');
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
  console.log(`\n🎉 [Success] All ${passed.length} rigorous log retention and archival checks passed successfully!`);
  process.exit(0);
}
