output "log_group_names" {
  description = "Map of service names to CloudWatch log group names."
  value       = { for s, lg in aws_cloudwatch_log_group.services : s => lg.name }
}

output "log_group_arns" {
  description = "Map of service names to CloudWatch log group ARNs."
  value       = { for s, lg in aws_cloudwatch_log_group.services : s => lg.arn }
}

output "cloudwatch_retention_days" {
  description = "Configured active CloudWatch log retention period in days (7 days)."
  value       = var.retention_in_days
}

output "archive_bucket_id" {
  description = "Name/ID of the dedicated S3 log archive bucket."
  value       = aws_s3_bucket.archive.id
}

output "archive_bucket_arn" {
  description = "ARN of the dedicated S3 log archive bucket."
  value       = aws_s3_bucket.archive.arn
}

output "firehose_delivery_stream_arns" {
  description = "Map of service names to Kinesis Firehose delivery stream ARNs."
  value       = { for s, stream in aws_kinesis_firehose_delivery_stream.archive : s => stream.arn }
}

output "firehose_delivery_stream_names" {
  description = "Map of service names to Kinesis Firehose delivery stream names."
  value       = { for s, stream in aws_kinesis_firehose_delivery_stream.archive : s => stream.name }
}

output "archive_lifecycle_expiration_days" {
  description = "Expiration period in days configured for S3 log archives (null if unconfigured)."
  value       = var.archive_retention_days
}
