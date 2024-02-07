variable "test_framework_config" {
}

variable "app_name" {
  type     = string
  default  = null
}

variable "env_type" {
  type     = string
  default  = null
}

variable "app_envs" {
  type     = list(string)
  default  = null
}

variable "environment_variables_parameter_store" {
  type = map(string)
  default  = null
}

variable "environment_variables" {
  type = map(string)
  default = {
  }
}

variable "postman_collections" {
  type = list(object({
    collection  = string
    environment = string
  }))
  default     = null
  description = "A list of postman collections (and environments) to run during the execution of the lambda function (in order). Collections and environments from the Postman API must be the collection/environment id"
}

variable "jmx_file_path" {
  type     = string
  default  = null
}

variable "jmeter_version" {
  type    = string
  default = "5.5"
}

variable "domain" {
  type     = string
  default  = null
}

variable "tribe_vpcs" {
  type = map(
    object({
    private_subnets  = list(string)
    vpc_id = string
  }))
  description = "ID for the lambda's VPC"
  default  = null
}
