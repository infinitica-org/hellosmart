terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-south-1"
}

module "observability" {
  source = "../../modules/observability"

  env               = "staging"
  aws_region        = "ap-south-1"
  services          = ["api", "worker", "ai-proxy", "reviewer", "ws-gateway"]
  retention_in_days = 7
  # Archive expiration is explicitly null pending legal/compliance approval
  archive_retention_days = null

  tags = {
    Environment = "staging"
  }
}
