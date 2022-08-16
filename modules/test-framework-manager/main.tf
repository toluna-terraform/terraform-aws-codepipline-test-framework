locals {
  codebuild_name    = "codebuild-publish-reports-${var.app_name}-${var.env_type}"
  codepipeline_name = "codepipeline-publish-reports-${var.app_name}-${var.env_type}"
  lambda_env_variables = {
    APP_NAME               = var.app_name
    ENV_TYPE               = var.env_type
    TEST_ENV_VAR_OVERRIDES = jsonencode(var.test_env_var_overrides)
  }
}

resource "aws_lambda_layer_version" "lambda_layer" {
  filename            = "${path.module}/layer/layer.zip"
  layer_name          = "postman"
  compatible_runtimes = ["nodejs16.x"]
  source_code_hash    = filebase64sha256("${path.module}/layer/layer.zip")
}

resource "aws_lambda_function" "test_framework" {
  filename         = "${path.module}/lambda/lambda.zip"
  function_name    = "${var.app_name}-${var.env_type}-test-framework-manager"
  role             = aws_iam_role.test_framework.arn
  handler          = "test_framework_manager.handler"
  runtime          = "nodejs16.x"
  layers           = [aws_lambda_layer_version.lambda_layer.arn]
  timeout          = 180
  source_code_hash = filebase64sha256("${path.module}/lambda/lambda.zip")
  environment {
    variables = local.lambda_env_variables
  }
  depends_on = [
    aws_lambda_layer_version.lambda_layer,
  ]
}

# IAM
resource "aws_iam_role" "test_framework" {
  name = "${var.app_name}_${var.env_type}_test_framework"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": [
          "s3.amazonaws.com",
          "codedeploy.amazonaws.com",
          "codebuild.amazonaws.com",
          "lambda.amazonaws.com"
        ]
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "role-lambda-execution" {
  role       = aws_iam_role.test_framework.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaRole"
}

resource "aws_iam_role_policy_attachment" "role-lambda-ssm" {
  role       = aws_iam_role.test_framework.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess"
}

resource "aws_iam_role_policy_attachment" "role-cloudwatch" {
  role       = aws_iam_role.test_framework.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchFullAccess"
}

resource "aws_iam_role_policy_attachment" "role-codedeploy" {
  role       = aws_iam_role.test_framework.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployFullAccess"
}

resource "aws_iam_role_policy_attachment" "role-codebuild" {
  role       = aws_iam_role.test_framework.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess"
}

resource "aws_iam_role_policy_attachment" "role-s3" {
  role       = aws_iam_role.test_framework.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_role_policy_attachment" "role-ec2" {
  role       = aws_iam_role.test_framework.name
  policy_arn = "arn:aws:iam::aws:policy/ElasticLoadBalancingReadOnly"
}

resource "aws_codebuild_project" "tests_reports" {
  name          = "${local.codebuild_name}"
  description   = "Build spec for ${local.codebuild_name}"
  build_timeout = "120"
  service_role  = aws_iam_role.codebuild_role.arn

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
    buildspec = templatefile("${path.module}/templates/test_buildspec.yml.tpl", 
  {  app_name = var.app_name, env_type = var.env_type })
  }

    tags = tomap({
                Name="codebuild-${local.codebuild_name}",
                environment="${var.app_name}-${var.env_type}",
                created_by="terraform"
    })
}

resource "aws_iam_role" "codebuild_role" {
  name = "role-${local.codebuild_name}"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume_role_policy.json
}

resource "aws_iam_role_policy" "codebuild_policy" {
  name = "policy-${local.codebuild_name}"
  role = aws_iam_role.codebuild_role.id
  policy = data.aws_iam_policy_document.codebuild_role_policy.json
}

module "integration_runner" {
  source = "../integration-runner"
  app_name = var.app_name
  env_type = var.env_type
  role     = aws_iam_role.test_framework.arn
  postman_collections = var.postman_collections
  environment_variables = local.lambda_env_variables
}

module "stress_runner" {
  source = "../stress-runner"
  app_name = var.app_name
  env_type = var.env_type
  role     = aws_iam_role.test_framework.arn
  jmx_file_path = var.jmx_file_path
  environment_variables = local.lambda_env_variables
}