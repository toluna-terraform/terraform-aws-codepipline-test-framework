data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_ssm_parameter" "ado_password" {
  name = "/app/ado_password"
}

data "aws_ssm_parameter" "ado_user" {
  name = "/app/ado_user"
}
