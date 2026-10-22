# Shared workspace host pool (D-11). Runs in the workspaces account only.

resource "aws_launch_template" "host" {
  name_prefix   = "hs-ws-host-"
  image_id      = var.host_ami_id # Packer: infra/packer/ws-host.pkr.hcl
  instance_type = var.host_instance_type

  metadata_options {
    http_tokens                 = "required" # IMDSv2
    http_put_response_hop_limit = 1          # slots (one hop further) cannot reach IMDS
    http_endpoint               = "enabled"
  }

  iam_instance_profile { name = aws_iam_instance_profile.host.name }

  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size           = 200
      volume_type           = "gp3"
      encrypted             = true
      kms_key_id            = var.ebs_kms_key_arn
      delete_on_termination = true
    }
  }

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [aws_security_group.host.id]
  }

  tag_specifications {
    resource_type = "instance"
    tags          = merge(var.tags, { Name = "hs-ws-host", "data-class" = "candidate-work" })
  }
}

resource "aws_autoscaling_group" "hosts" {
  name                  = "hs-ws-hosts"
  min_size              = var.min_hosts
  max_size              = var.max_hosts
  vpc_zone_identifier   = var.private_subnet_ids
  max_instance_lifetime = 86400 # recycle hosts every 24 h
  protect_from_scale_in = true  # orchestrator releases protection only on empty hosts

  launch_template {
    id      = aws_launch_template.host.id
    version = "$Latest"
  }

  instance_refresh {
    strategy = "Rolling"
    preferences { min_healthy_percentage = 90 }
  }
}

resource "aws_security_group" "host" {
  name_prefix = "hs-ws-host-"
  vpc_id      = var.vpc_id
  description = "Workspace hosts: ingress only from ws-gateway; egress only via Network Firewall"

  ingress {
    description     = "slot ports from gateway"
    from_port       = 20000
    to_port         = 29999
    protocol        = "tcp"
    security_groups = [var.gateway_sg_id]
  }

  egress {
    description = "all egress is inspected by Network Firewall allowlist"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Host role: pull images, write its own logs/metrics, read its own SSM params. No data access.
data "aws_iam_policy_document" "host" {
  statement {
    actions   = ["ecr:GetAuthorizationToken", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
    resources = ["*"]
  }
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "cloudwatch:PutMetricData"]
    resources = ["*"]
  }
  statement {
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:*:*:parameter/ws/*"]
  }
}

resource "aws_iam_role" "host" {
  name_prefix        = "hs-ws-host-"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}

resource "aws_iam_role_policy" "host" {
  role   = aws_iam_role.host.id
  policy = data.aws_iam_policy_document.host.json
}

resource "aws_iam_instance_profile" "host" {
  name_prefix = "hs-ws-host-"
  role        = aws_iam_role.host.name
}

resource "aws_budgets_budget" "workspaces" {
  name         = "hs-workspaces-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_sns_topic_arns  = [var.alerts_topic_arn]
  }
}
