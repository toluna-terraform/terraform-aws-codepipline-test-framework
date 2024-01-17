locals {
  app_name                              = var.app_name == null ? var.test_framework_config.app_name : var.app_name
  app_envs                              = var.app_envs == null ? var.test_framework_config.app_envs : var.app_envs
  env_type                              = var.env_type == null ? var.test_framework_config.env_type : var.env_type
  domain                                = var.env_type == null ? var.test_framework_config.domain : var.domain
  environment_variables_parameter_store = var.environment_variables_parameter_store == null ? var.test_framework_config.environment_variables_parameter_store : var.environment_variables_parameter_store
  postman_collections                   = var.postman_collections == null ? var.test_framework_config.postman_collections : var.postman_collections
  jmeter_version                        = var.postman_collections == null ? var.test_framework_config.jmeter_version : var.jmeter_version
  jmx_file_path                         = var.jmx_file_path == null ? var.test_framework_config.jmx_file_path : var.jmx_file_path
  tribe_vpcs                            = var.tribe_vpcs == null ? var.test_framework_config.tribe_vpcs : var.tribe_vpcs
}



module "test_framework_manager" {
  source                                = "./modules/test-framework-manager"
  app_name                              = local.app_name
  env_type                              = local.env_type
  domain                                = local.domain
  codebuild_name                        = "tests-reports-${local.app_name}"
  s3_bucket                             = "${local.app_name}-${local.env_type}-tests"
  privileged_mode                       = true
  environment_variables_parameter_store = local.environment_variables_parameter_store
  postman_collections                   = local.postman_collections
  jmx_file_path                         = local.jmx_file_path
  tribe_vpcs                            = local.tribe_vpcs
}

resource "aws_codebuild_report_group" "TestReport" {
  for_each       = toset(local.app_envs)
  name           = "${local.app_name}-${each.key}-TestReport"
  type           = "TEST"
  delete_reports = true
  export_config {
    type = "NO_EXPORT"
  }
}

resource "aws_codebuild_report_group" "CodeCoverageReport" {
  for_each       = toset(local.app_envs)
  name           = "${local.app_name}-${each.key}-CodeCoverageReport"
  type           = "CODE_COVERAGE"
  delete_reports = true
  export_config {
    type = "NO_EXPORT"
  }
}

resource "aws_codebuild_report_group" "IntegrationTestReport" {
  for_each       = toset(local.app_envs)
  name           = "${local.app_name}-${each.key}-IntegrationTestReport"
  type           = "TEST"
  delete_reports = true
  export_config {
    type = "NO_EXPORT"
  }
}

resource "aws_codebuild_report_group" "StreesTestReport" {
  for_each       = toset(local.app_envs)
  name           = "${local.app_name}-${each.key}-StressTestReport"
  type           = "TEST"
  delete_reports = true
  export_config {
    type = "NO_EXPORT"
  }
}
