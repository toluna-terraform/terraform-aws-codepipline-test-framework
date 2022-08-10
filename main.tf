module "test_reports" {
  source                                = "./modules/test-publisher"
  app_name                              = var.app_name
  env_type                              = var.env_type
  codebuild_name                        = "tests-reports-${var.app_name}"
  s3_bucket                             = "${var.app_name}-${var.env_type}-postman-tests"
  privileged_mode                       = true
  environment_variables_parameter_store = var.environment_variables_parameter_store
  depends_on = [
    module.integration_runner,module.stress_runner
  ]
}

module "integration_runner" {
  source = "./modules/integration-runner"
  app_name = var.app_name
  env_type = var.env_type
  postman_collections = var.postman_collections
}

module "stress_runner" {
  source = "./modules/stress-runner"
  app_name = var.app_name
  env_type = var.env_type
  jmx_file_path = var.jmx_file_path
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

resource "aws_codebuild_report_group" "StreesTestReport" {
  for_each = toset(var.app_envs)
  name = "${var.app_name}-${each.key}-StressTestReport"
  type = "TEST"
  delete_reports = true
  export_config {
    type = "NO_EXPORT"
  }
}