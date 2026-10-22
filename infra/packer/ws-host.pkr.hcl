# Workspace host golden AMI: Ubuntu 24.04 + Docker + Sysbox + CIS level-1 hardening.
packer {
  required_plugins {
    amazon = { source = "github.com/hashicorp/amazon", version = "~> 1.3" }
  }
}

variable "region" { default = "ap-south-1" }
variable "template_images" {
  type        = list(string)
  description = "ECR URIs of published template images to pre-pull (fast slot start)."
  default     = []
}

source "amazon-ebs" "ws_host" {
  region          = var.region
  instance_type   = "m7i.xlarge"
  ssh_username    = "ubuntu"
  ami_name        = "hs-ws-host-{{timestamp}}"
  encrypt_boot    = true
  imds_support    = "v2.0"
  source_ami_filter {
    filters     = { name = "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" }
    owners      = ["099720109477"]
    most_recent = true
  }
  metadata_options {
    http_tokens = "required"
  }
}

build {
  sources = ["source.amazon-ebs.ws_host"]

  provisioner "shell" {
    scripts = [
      "scripts/01-harden.sh",      # CIS L1, unattended-upgrades, auditd, no password SSH, SSM agent only
      "scripts/02-docker.sh",      # docker-ce pinned, userns defaults
      "scripts/03-sysbox.sh",      # sysbox-ce pinned + checksum verify
      "scripts/04-slot-runtime.sh" # quota'd slot volumes, cgroup v2 slices, nftables slot isolation
    ]
  }

  provisioner "shell" {
    inline = [for img in var.template_images : "sudo docker pull ${img}"]
  }

  post-processor "manifest" {}
}
