variable "env_type" {
    type = string
}

variable "app_name" {
  type = string
}

variable "environment_variables" {
  default = {}  
  type        = map(string)
}

variable "postman_collections" {
  type = list(object({
    collection  = string
    environment = string
  }))
  description = "A list of postman collections (and environments) to run during the execution of the lambda function (in order). Collections and environments from the Postman API must be the collection/environment id"
}

variable "integration_tests_bucket" {
  type        = string
  description = "S3 Bucket name for the S3 Bucket this module will upload the postman_collection_file and postman_environment_file to (defaults to <app_name>-postman-files)"
  default     = null
}

variable "tribe_vpcs" {
  description = "ID for the lambda's VPC"
  default     = {}
}

variable "role" {
  type = string
}