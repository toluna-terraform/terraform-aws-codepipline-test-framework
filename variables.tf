variable "app_name" {
    type = string
}

variable "env_type" {
    type = string
}

variable "app_envs" {
}

variable "environment_variables_parameter_store" {
 type = map(string)
 default = {
    "ADO_USER" = "/app/ado_user",
    "ADO_PASSWORD" = "/app/ado_password"
 }
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
  description = "A list of postman collections (and environments) to run during the execution of the lambda function (in order). Collections and environments from the Postman API must be the collection/environment id"
}

variable "jmx_file_path" {
    type = string
    default = ""
}

variable "jmeter_version" {
  type = string
  default = "5.5"
}

variable "domain" {
  type = string
}

variable "tribe_vpcs" {
  description = "ID for the lambda's VPC"
  default     = {}
}