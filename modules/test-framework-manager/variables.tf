variable "env_type" {
    type = string
}

variable "app_name" {
  type = string
}

variable "codebuild_name" {
    type = string
  
}
  variable "s3_bucket" {
     type     = string
 }

variable "environment_variables" {
  default = {}  
  type        = map(string)
}

variable "environment_variables_parameter_store" {
 type = map(string)
 default = {
 "ADO_USER" = "/app/ado_user"
 "ADO_PASSWORD" = "/app/ado_password"
 }
}

variable "postman_collections" {
  type = list(object({
    collection  = string
    environment = string
  }))
  description = "A list of postman collections (and environments) to run during the execution of the lambda function (in order). Collections and environments from the Postman API must be the collection/environment id"
}

variable "privileged_mode" { 
    type        = bool
    default     = true
    description = "set to true if building a docker"
}

variable "jmeter_version" {
  type = string
  default = "5.5"
}

variable "jmx_file_path" {
    type = string
    default = ""
}

variable "test_env_var_overrides" {
  type        = map(string)
  description = "Values to set or override in the Postman test environment."
  default     = {}
}