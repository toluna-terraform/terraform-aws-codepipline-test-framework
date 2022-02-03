module "test_reports" {
  source                                = "./modules/test-publisher"
  app_name                              = var.app_name
  env_type                              = var.env_type
  codebuild_name                        = "tests-reports-${var.app_name}"
  s3_bucket                             = "${var.app_name}-${var.env_type}-postman-tests"
  privileged_mode                       = true
  environment_variables_parameter_store = var.environment_variables_parameter_store
}

module "test_runner" {
  source = "./modules/test-runner"
  app_name = var.app_name
  env_type = var.env_type
  postman_collections = var.postman_collections
}


resource "aws_codebuild_report_group" "TestReport" {
  for_each = toset(var.app_envs)
  name = "${var.app_name}-${each.key}-TestReport"
  type = "TEST"
  delete_reports = true
  export_config {
    type = "NO_EXPORT"
  }
}

resource "aws_codebuild_report_group" "CodeCoverageReport" {
  for_each = toset(var.app_envs)
  name = "${var.app_name}-${each.key}-CodeCoverageReport"
  type = "CODE_COVERAGE"
  delete_reports = true
  export_config {
    type = "NO_EXPORT"
  }
}

resource "aws_codebuild_report_group" "IntegrationTestReport" {
  for_each = toset(var.app_envs)
  name = "${var.app_name}-${each.key}-IntegrationTestReport"
  type = "TEST"
  delete_reports = true
  export_config {
    type = "NO_EXPORT"
  }
}