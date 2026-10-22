variable "allowed_regions" {
  type    = list(string)
  default = ["ap-south-1", "ap-south-2"]
}

variable "workload_ou_ids" {
  type        = list(string)
  description = "OUs holding shared, dev, staging, prod and workspaces accounts."
}

variable "workspaces_ou_id" {
  type = string
}

variable "workspace_instance_types" {
  type    = list(string)
  default = ["m7i.2xlarge", "m7i.xlarge", "t3.xlarge"]
}
