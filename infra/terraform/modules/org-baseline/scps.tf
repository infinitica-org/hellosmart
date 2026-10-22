# Service control policies applied to every workload OU. Preventive guardrails that no IAM policy
# inside an account can override.

data "aws_iam_policy_document" "baseline" {
  statement {
    sid       = "DenyOutsideApprovedRegions"
    effect    = "Deny"
    not_actions = ["iam:*", "organizations:*", "sts:*", "support:*", "cloudfront:*", "route53:*", "waf:*", "wafv2:*", "acm:*", "budgets:*", "ce:*"]
    resources = ["*"]
    condition {
      test     = "StringNotEquals"
      variable = "aws:RequestedRegion"
      values   = var.allowed_regions
    }
  }

  statement {
    sid    = "ProtectSecurityServices"
    effect = "Deny"
    actions = [
      "cloudtrail:StopLogging", "cloudtrail:DeleteTrail", "cloudtrail:UpdateTrail",
      "guardduty:DeleteDetector", "guardduty:DisassociateFromMasterAccount",
      "config:StopConfigurationRecorder", "config:DeleteConfigurationRecorder",
      "securityhub:DisableSecurityHub", "access-analyzer:DeleteAnalyzer",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "DenyRootUser"
    effect    = "Deny"
    actions   = ["*"]
    resources = ["*"]
    condition {
      test     = "StringLike"
      variable = "aws:PrincipalArn"
      values   = ["arn:aws:iam::*:root"]
    }
  }

  statement {
    sid       = "DenyLongLivedUserKeys"
    effect    = "Deny"
    actions   = ["iam:CreateAccessKey", "iam:CreateUser"]
    resources = ["*"]
  }

  statement {
    sid       = "RequireIMDSv2"
    effect    = "Deny"
    actions   = ["ec2:RunInstances"]
    resources = ["arn:aws:ec2:*:*:instance/*"]
    condition {
      test     = "StringNotEquals"
      variable = "ec2:MetadataHttpTokens"
      values   = ["required"]
    }
  }

  statement {
    sid       = "DenyUnencryptedS3Uploads"
    effect    = "Deny"
    actions   = ["s3:PutObject"]
    resources = ["*"]
    condition {
      test     = "Null"
      variable = "s3:x-amz-server-side-encryption"
      values   = ["true"]
    }
  }
}

# Extra limits for the candidate-compute accounts: no data services, capped instance types.
data "aws_iam_policy_document" "workspaces" {
  statement {
    sid       = "NoDataServicesInWorkspaces"
    effect    = "Deny"
    actions   = ["rds:*", "dynamodb:*", "secretsmanager:CreateSecret", "iam:CreateRole", "lambda:*"]
    resources = ["*"]
    condition {
      test     = "StringNotLike"
      variable = "aws:PrincipalArn"
      values   = ["arn:aws:iam::*:role/hs-terraform-*"]
    }
  }

  statement {
    sid       = "AllowedInstanceTypesOnly"
    effect    = "Deny"
    actions   = ["ec2:RunInstances"]
    resources = ["arn:aws:ec2:*:*:instance/*"]
    condition {
      test     = "StringNotLike"
      variable = "ec2:InstanceType"
      values   = var.workspace_instance_types
    }
  }
}

resource "aws_organizations_policy" "baseline" {
  name    = "hs-baseline"
  type    = "SERVICE_CONTROL_POLICY"
  content = data.aws_iam_policy_document.baseline.json
}

resource "aws_organizations_policy" "workspaces" {
  name    = "hs-workspaces"
  type    = "SERVICE_CONTROL_POLICY"
  content = data.aws_iam_policy_document.workspaces.json
}

resource "aws_organizations_policy_attachment" "baseline" {
  for_each  = toset(var.workload_ou_ids)
  policy_id = aws_organizations_policy.baseline.id
  target_id = each.value
}

resource "aws_organizations_policy_attachment" "workspaces" {
  policy_id = aws_organizations_policy.workspaces.id
  target_id = var.workspaces_ou_id
}
