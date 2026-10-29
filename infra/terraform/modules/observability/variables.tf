variable "env" {
  type        = string
  description = "Target deployment environment (e.g. dev, staging, prod)."
}

variable "aws_region" {
  type        = string
  description = "AWS region for observability resources."
  default     = "ap-south-1"
}

variable "services" {
  type        = list(string)
  description = "List of container service names to ingest, retain, and archive. Encompasses all deployed container images."
  default     = ["web", "api", "worker", "ai-proxy", "reviewer", "ws-gateway"]
}

variable "retention_in_days" {
  type        = number
  description = "Active CloudWatch Log Group retention period in days. HelloSmart policy mandates exactly 7 days."
  default     = 7

  validation {
    condition     = var.retention_in_days == 7
    error_message = "Active CloudWatch log retention must be exactly 7 days per HelloSmart logging policy."
  }
}

variable "kms_key_arn" {
  type        = string
  description = "ARN of the KMS CMK used to encrypt CloudWatch log groups. If null, AWS-managed encryption is used."
  default     = null
}

variable "s3_kms_key_arn" {
  type        = string
  description = "ARN of the KMS CMK used for S3 log archive encryption and Firehose delivery. If null, AES256 server-side encryption is used."
  default     = null
}

variable "archive_retention_days" {
  type        = number
  description = "Expiration period in days for archived logs in S3. Must remain null until confirmed by legal/compliance."
  default     = null
}

variable "archive_transition_glacier_days" {
  type        = number
  description = "Number of days before transitioning archived logs to cold storage."
  default     = 90
}

variable "archive_storage_class" {
  type        = string
  description = "S3 storage class for cold archived logs after the transition period. Defaults to GLACIER_IR to support immediate, low-latency Amazon Athena queries without asynchronous restore delays."
  default     = "GLACIER_IR"

  validation {
    condition     = contains(["GLACIER_IR", "GLACIER", "INTELLIGENT_TIERING", "DEEP_ARCHIVE"], var.archive_storage_class)
    error_message = "archive_storage_class must be one of GLACIER_IR, GLACIER, INTELLIGENT_TIERING, or DEEP_ARCHIVE."
  }
}

variable "s3_bucket_name_override" {
  type        = string
  description = "Optional override for S3 log archive bucket name. Defaults to hs-logs-archive-<account_id>-<env>."
  default     = null
}

variable "firehose_buffer_size_mb" {
  type        = number
  description = "Buffer incoming log data to the specified size in MBs before delivering to S3."
  default     = 5

  validation {
    condition     = var.firehose_buffer_size_mb >= 1 && var.firehose_buffer_size_mb <= 128
    error_message = "Firehose buffer size must be between 1 MB and 128 MB."
  }
}

variable "firehose_buffer_interval_seconds" {
  type        = number
  description = "Buffer incoming log data for the specified duration in seconds before delivering to S3."
  default     = 300

  validation {
    condition     = var.firehose_buffer_interval_seconds >= 60 && var.firehose_buffer_interval_seconds <= 900
    error_message = "Firehose buffer interval must be between 60 and 900 seconds."
  }
}

variable "alerts_topic_arn" {
  type        = string
  description = "ARN of the SNS topic for observability alarms. If null, a dedicated topic is provisioned by the module."
  default     = null
}

variable "tags" {
  type        = map(string)
  description = "Common resource tags."
  default     = {}
}
