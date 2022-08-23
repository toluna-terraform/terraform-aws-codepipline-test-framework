 variable "app_name" {
     type     = string
 }
 variable "env_type" {
  type = string
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

variable "role" {
  type = string
}

variable "privileged_mode" { 
    type        = bool
    default     = true
    description = "set to true if building a docker"
}

variable "jmx_file_path" {
    type = string
    default = ""
}

variable "jmeter_version" {
  type = string
  default = "5.5"
}

variable "threshold" {
  type = number
  default = 0
}