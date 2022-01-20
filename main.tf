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


