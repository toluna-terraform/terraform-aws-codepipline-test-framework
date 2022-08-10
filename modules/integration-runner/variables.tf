variable "env_type" {
    type = string
}

variable "app_name" {
  type = string
}

variable "alb_wait_time" {
  type        = number
  description = "The number of seconds the Lambda function should wait for the new ALB target group to initialize before running tests."
  default     = 10
}

variable "postman_collections" {
  type = list(object({
    collection  = string
    environment = string
  }))
  description = "A list of postman collections (and environments) to run during the execution of the lambda function (in order). Collections and environments from the Postman API must be the collection/environment id"
}

variable "postman_files_bucket_name" {
  type        = string
  description = "S3 Bucket name for the S3 Bucket this module will upload the postman_collection_file and postman_environment_file to (defaults to <app_name>-postman-files)"
  default     = null
}

variable "vpc_subnet_ids" {
  type        = list(string)
  description = "Subnet ids that the lambda should be in."
  default     = []
}

variable "vpc_id" {
  type        = string
  description = "ID for the lambda's VPC"
  default     = null
}

variable "test_env_var_overrides" {
  type        = map(string)
  description = "Values to set or override in the Postman test environment."
  default     = {}
}