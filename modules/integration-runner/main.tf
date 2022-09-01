locals {
  local_collections = compact([
    for each in var.postman_collections :
    substr(each.collection, length(each.collection) - 5, 5) == ".json" ? each.collection : ""
  ])
  external_collections = compact([
    for each in var.postman_collections :
    substr(each.collection, length(each.collection) - 5, 5) != ".json" ? each.collection : ""
  ])
  local_environments = compact([
    for each in var.postman_collections :
    each.environment != null ? substr(each.environment, length(each.environment) - 5, 5) == ".json" ? each.environment : "" : ""
  ])
  external_environments = compact([
    for each in var.postman_collections :
    each.environment != null ? substr(each.environment, length(each.environment) - 5, 5) != ".json" ? each.environment : "" : ""
  ])
  using_local_files = length(local.local_collections) + length(local.local_environments) > 0
  lambda_env_variables = merge({
    S3_BUCKET              = local.using_local_files ? var.integration_tests_bucket : null
    POSTMAN_COLLECTIONS    = jsonencode(var.postman_collections)
    APP_NAME               = var.app_name
    ENV_TYPE               = var.env_type
  },var.environment_variables)
  lambda_function_name = "${var.app_name}-postman-tests"
}

resource "aws_lambda_layer_version" "lambda_layer_integration" {
  filename   = "${path.module}/layer/layer.zip"
  layer_name = "postman"
  compatible_runtimes = ["nodejs16.x"]
  source_code_hash = filebase64sha256("${path.module}/layer/layer.zip")
}

resource "aws_lambda_function" "integration_runner" {
  filename      = "${path.module}/lambda/lambda.zip"
  function_name = "${var.app_name}-${var.env_type}-integration-runner"
  role          = var.role
  handler       = "integration_runner.handler"
  runtime       = "nodejs16.x"
  layers = [aws_lambda_layer_version.lambda_layer_integration.arn]
  timeout       = 900
  source_code_hash = filebase64sha256("${path.module}/lambda/lambda.zip")
  environment {
    variables = local.lambda_env_variables
  }
  depends_on = [
    aws_lambda_layer_version.lambda_layer_integration,
    ]
}



