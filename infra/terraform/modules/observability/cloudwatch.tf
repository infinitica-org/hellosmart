# CloudWatch Log Groups with explicit 7-day retention, Firehose subscription filters, and delivery alarms.

# Dedicated SNS topic for observability alarms when none is passed from the environment
resource "aws_sns_topic" "alerts" {
  count = var.alerts_topic_arn == null ? 1 : 0

  name = "hs-observability-alerts-${var.env}"

  tags = merge(local.merged_tags, {
    Name = "hs-observability-alerts-${var.env}"
  })
}

resource "aws_cloudwatch_log_group" "services" {
  for_each = toset(var.services)

  name              = "/aws/ecs/hellosmart-${each.key}-${var.env}"
  retention_in_days = var.retention_in_days
  kms_key_id        = var.kms_key_arn

  tags = merge(local.merged_tags, {
    service = each.key
    Name    = "hs-log-${each.key}-${var.env}"
  })
}

resource "aws_cloudwatch_log_subscription_filter" "firehose" {
  for_each = toset(var.services)

  name            = "hs-sub-${each.key}-${var.env}"
  log_group_name  = aws_cloudwatch_log_group.services[each.key].name
  filter_pattern  = "" # All events
  destination_arn = aws_kinesis_firehose_delivery_stream.archive[each.key].arn
  role_arn        = aws_iam_role.cw_to_firehose.arn

  depends_on = [
    aws_iam_role_policy.cw_to_firehose
  ]
}

resource "aws_cloudwatch_metric_alarm" "firehose_delivery_errors" {
  for_each = toset(var.services)

  alarm_name          = "hs-firehose-delivery-errors-${each.key}-${var.env}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "DeliveryToS3.DataFreshness"
  namespace           = "AWS/Firehose"
  period              = 300
  statistic           = "Maximum"
  threshold           = 900 # 15 minutes freshness threshold
  alarm_description   = "Firehose delivery to S3 is delayed or failing for service ${each.key} (${var.env})."
  alarm_actions       = [local.alerts_topic_arn]
  ok_actions          = [local.alerts_topic_arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    DeliveryStreamName = aws_kinesis_firehose_delivery_stream.archive[each.key].name
  }

  tags = merge(local.merged_tags, {
    service = each.key
  })
}
