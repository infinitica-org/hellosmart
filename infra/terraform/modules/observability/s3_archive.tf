# Dedicated S3 bucket for cold log archival.
# Strictly separated from candidate submissions (hs-candidate-*) and business audit events.

resource "aws_s3_bucket" "archive" {
  # checkov:skip=CKV_AWS_18:Log archive bucket itself does not self-log to avoid recursive access log loops
  # checkov:skip=CKV_AWS_144:Cross-region replication not required for internal log archives
  bucket = local.bucket_name

  tags = merge(local.merged_tags, {
    Name = local.bucket_name
  })
}

resource "aws_s3_bucket_public_access_block" "archive" {
  bucket = aws_s3_bucket.archive.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "archive" {
  bucket = aws_s3_bucket.archive.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.s3_kms_key_arn
      sse_algorithm     = var.s3_kms_key_arn != null ? "aws:kms" : "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "archive" {
  bucket = aws_s3_bucket.archive.id

  versioning_configuration {
    status = "Enabled"
  }
}

data "aws_iam_policy_document" "s3_archive_tls_only" {
  statement {
    sid     = "EnforceTLSRequestsOnly"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.archive.arn,
      "${aws_s3_bucket.archive.arn}/*"
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "archive" {
  bucket = aws_s3_bucket.archive.id
  policy = data.aws_iam_policy_document.s3_archive_tls_only.json
}

resource "aws_s3_bucket_lifecycle_configuration" "archive" {
  bucket = aws_s3_bucket.archive.id

  rule {
    id     = "log-archive-lifecycle"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    transition {
      days          = var.archive_transition_glacier_days
      storage_class = "GLACIER"
    }

    dynamic "expiration" {
      for_each = var.archive_retention_days != null ? [var.archive_retention_days] : []
      content {
        days = expiration.value
      }
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    dynamic "noncurrent_version_expiration" {
      for_each = var.archive_retention_days != null ? [var.archive_retention_days] : []
      content {
        noncurrent_days = noncurrent_version_expiration.value
      }
    }
  }
}
