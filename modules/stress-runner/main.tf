locals{
    codebuild_name        = "codebuild-stress-runner-${var.app_name}-${var.env_type}" 
    lambda_env_variables = merge({
    APP_NAME               = var.app_name
    ENV_TYPE               = var.env_type
    JMX_FILE_PATH          = var.jmx_file_path
    JMETER_VERSION         = var.jmeter_version
  },var.environment_variables)
}

resource "aws_codebuild_project" "stress_runner" {
  name          = "${local.codebuild_name}"
  description   = "Build spec for ${local.codebuild_name}"
  build_timeout = "120"
  service_role  = var.role

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/amazonlinux2-x86_64-standard:3.0"
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode = var.privileged_mode
  }

  logs_config {
    cloudwatch_logs {
      group_name  = "/${local.codebuild_name}/log-group"
      stream_name = "/${local.codebuild_name}/stream"
    }
  }

  source {
    type     = "NO_SOURCE"
    buildspec = templatefile("${path.module}/templates/stress_buildspec.yml.tpl", 
  {  app_name = var.app_name, env_type = var.env_type,stress_tests_bucket = var.stress_tests_bucket,jmx_file_path = var.jmx_file_path, jmeter_version = var.jmeter_version,threshold = var.threshold })
  }

    tags = tomap({
                Name="codebuild-${local.codebuild_name}",
                environment="${var.app_name}-${var.env_type}",
                created_by="terraform"
    })
}


resource "aws_lambda_layer_version" "lambda_layer_stress" {
  filename            = "${path.module}/layer/layer.zip"
  layer_name          = "postman"
  compatible_runtimes = ["nodejs16.x"]
  source_code_hash    = filebase64sha256("${path.module}/layer/layer.zip")
}

# ---- prepare lambda zip file
data "archive_file" "stress_runner_zip" {
    type        = "zip"
    source_file  = "${path.module}/lambda/stress_runner.js"
    output_path = "${path.module}/lambda/lambda.zip"
}

resource "aws_lambda_function" "stress_runner" {
  filename         = "${path.module}/lambda/lambda.zip"
  function_name    = "${var.app_name}-${var.env_type}-stress-runner"
  role             = var.role
  handler          = "stress_runner.handler"
  runtime          = "nodejs16.x"
  layers           = [aws_lambda_layer_version.lambda_layer_stress.arn]
  timeout          = 180
  source_code_hash = filebase64sha256("${path.module}/lambda/lambda.zip")
  environment {
    variables = local.lambda_env_variables
  }
  depends_on = [
    aws_lambda_layer_version.lambda_layer_stress,
    data.archive_file.stress_runner_zip,
  ]
}