variable "host_ami_id" { type = string }
variable "host_instance_type" {
  type    = string
  default = "m7i.2xlarge"
}
variable "ebs_kms_key_arn" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "gateway_sg_id" { type = string }
variable "alerts_topic_arn" { type = string }
variable "min_hosts" {
  type    = number
  default = 2
}
variable "max_hosts" {
  type    = number
  default = 40
}
variable "monthly_budget_usd" {
  type    = string
  default = "3000"
}
variable "tags" {
  type    = map(string)
  default = {}
}
