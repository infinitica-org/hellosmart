# Kinesis Data Firehose delivery pipeline for reliable S3 log archival.

# IAM Role: CloudWatch Logs -> Kinesis Firehose
data "aws_iam_policy_document" "cw_to_firehose_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type = "Service"
      identifiers = [
        "logs.amazonaws.com",
        "logs.${var.aws_region}.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role" "cw_to_firehose" {
  name_prefix        = "hs-cw-to-fh-${var.env}-"
  assume_role_policy = data.aws_iam_policy_document.cw_to_firehose_assume.json
  tags               = local.merged_tags
}

data "aws_iam_policy_document" "cw_to_firehose" {
  statement {
    sid    = "FirehosePut"
    effect = "Allow"
    actions = [
      "firehose:PutRecord",
      "firehose:PutRecordBatch"
    ]
    resources = [for stream in aws_kinesis_firehose_delivery_stream.archive : stream.arn]
  }

  dynamic "statement" {
    for_each = var.s3_kms_key_arn != null ? [var.s3_kms_key_arn] : []
    content {
      sid    = "KmsFirehosePut"
      effect = "Allow"
      actions = [
        "kms:GenerateDataKey*",
        "kms:Decrypt"
      ]
      resources = [statement.value]
    }
  }
}

resource "aws_iam_role_policy" "cw_to_firehose" {
  name_prefix = "hs-cw-to-fh-policy-"
  role        = aws_iam_role.cw_to_firehose.id
  policy      = data.aws_iam_policy_document.cw_to_firehose.json
}

# IAM Role: Kinesis Firehose -> S3 Archive
data "aws_iam_policy_document" "firehose_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["firehose.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "firehose_to_s3" {
  name_prefix        = "hs-fh-to-s3-${var.env}-"
  assume_role_policy = data.aws_iam_policy_document.firehose_assume.json
  tags               = local.merged_tags
}

data "aws_iam_policy_document" "firehose_to_s3" {
  statement {
    sid    = "S3ArchiveDelivery"
    effect = "Allow"
    actions = [
      "s3:AbortMultipartUpload",
      "s3:GetBucketLocation",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
      "s3:PutObject"
    ]
    resources = [
      aws_s3_bucket.archive.arn,
      "${aws_s3_bucket.archive.arn}/*"
    ]
  }

  statement {
    sid    = "CloudWatchLogging"
    effect = "Allow"
    actions = [
      "logs:PutLogEvents"
    ]
    resources = [
      "${aws_cloudwatch_log_group.firehose_errors.arn}:*"
    ]
  }

  dynamic "statement" {
    for_each = var.s3_kms_key_arn != null ? [var.s3_kms_key_arn] : []
    content {
      sid    = "KmsEncryption"
      effect = "Allow"
      actions = [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:DescribeKey"
      ]
      resources = [statement.value]
    }
  }
}

resource "aws_iam_role_policy" "firehose_to_s3" {
  name_prefix = "hs-fh-to-s3-policy-"
  role        = aws_iam_role.firehose_to_s3.id
  policy      = data.aws_iam_policy_document.firehose_to_s3.json
}

# Dedicated error log group for Firehose delivery troubleshooting
resource "aws_cloudwatch_log_group" "firehose_errors" {
  name              = "/aws/kinesisfirehose/hellosmart-errors-${var.env}"
  retention_in_days = var.retention_in_days
  kms_key_id        = var.kms_key_arn
  tags              = local.merged_tags
}

resource "aws_cloudwatch_log_stream" "firehose_errors" {
  for_each       = toset(var.services)
  name           = "s3-delivery-${each.key}"
  log_group_name = aws_cloudwatch_log_group.firehose_errors.name
}

# Kinesis Firehose delivery stream per service
resource "aws_kinesis_firehose_delivery_stream" "archive" {
  for_each = toset(var.services)

  name        = "hs-logs-${each.key}-${var.env}"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn            = aws_iam_role.firehose_to_s3.arn
    bucket_arn          = aws_s3_bucket.archive.arn
    prefix              = "services/${each.key}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/"
    error_output_prefix = "errors/services/${each.key}/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/"
    buffer_size         = var.firehose_buffer_size_mb
    buffer_interval     = var.firehose_buffer_interval_seconds
    compression_format  = "UNCOMPRESSED" # CloudWatch Logs subscription filter delivers GZIP batches; avoid double-compression
    kms_key_arn         = var.s3_kms_key_arn

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.firehose_errors.name
      log_stream_name = aws_cloudwatch_log_stream.firehose_errors[each.key].name
    }
  }

  server_side_encryption {
    enabled  = true
    key_type = var.s3_kms_key_arn != null ? "CUSTOMER_MANAGED_CMK" : "AWS_OWNED_CMK"
    key_arn  = var.s3_kms_key_arn
  }

  tags = merge(local.merged_tags, {
    service = each.key
  })
}
