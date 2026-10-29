# Central Observability & Log Archival Module — HelloSmart.ai
# Manages CloudWatch log groups with 7-day retention and S3 cold archive via Kinesis Firehose.

data "aws_caller_identity" "current" {}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  bucket_name = var.s3_bucket_name_override != null ? var.s3_bucket_name_override : "hs-logs-archive-${local.account_id}-${var.env}"

  default_tags = {
    org          = "hellosmart"
    env          = var.env
    "owner-dept" = "platform"
    "data-class" = "internal"
  }

  merged_tags = merge(local.default_tags, var.tags)

  # Fallback to module-provisioned SNS topic if no external topic ARN is provided
  alerts_topic_arn = var.alerts_topic_arn != null ? var.alerts_topic_arn : aws_sns_topic.alerts[0].arn
}
