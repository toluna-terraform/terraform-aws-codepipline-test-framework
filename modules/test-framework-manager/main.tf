locals {
  codebuild_name    = "codebuild-publish-reports-${var.app_name}-${var.env_type}"
  codepipeline_name = "codepipeline-publish-reports-${var.app_name}-${var.env_type}"
  lambda_env_variables = {
    APP_NAME               = var.app_name
    ENV_TYPE               = var.env_type
    DOMAIN                 = var.domain
    TEST_ENV_VAR_OVERRIDES = jsonencode(var.test_env_var_overrides)
  }
}

resource "aws_s3_bucket" "tests_bucket" {
  force_destroy = true
  bucket        = "${var.app_name}-${var.env_type}-tests"
}

resource "aws_s3_bucket_acl" "tests_bucket" {
  bucket = aws_s3_bucket.tests_bucket.id
  acl    = "private"
  depends_on = [
    aws_s3_bucket.tests_bucket
  ]
}

resource "aws_s3_bucket_versioning" "postests_buckettman_bucket" {
  bucket = aws_s3_bucket.tests_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
  depends_on = [
    aws_s3_bucket.tests_bucket
  ]
}

resource "aws_s3_bucket_public_access_block" "tests_bucket" {
  bucket                  = aws_s3_bucket.tests_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
  depends_on = [
    aws_s3_bucket.tests_bucket
  ]
}

resource "aws_s3_bucket_policy" "postman_bucket" {
  bucket = aws_s3_bucket.tests_bucket.id
  policy = data.aws_iam_policy_document.tests_bucket.json
  depends_on = [
    aws_s3_bucket.tests_bucket
  ]
}


resource "aws_lambda_layer_version" "lambda_layer" {
  filename            = "${path.module}/layer/layer.zip"
  layer_name          = "postman"
  compatible_runtimes = ["nodejs16.x"]
  source_code_hash    = filebase64sha256("${path.module}/layer/layer.zip")
}

# ---- prepare lambda zip file
data "archive_file" "test_framework_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/test_framework_manager.js"
  output_path = "${path.module}/lambda/lambda.zip"
}

resource "aws_lambda_function" "test_framework" {
  filename         = "${path.module}/lambda/lambda.zip"
  function_name    = "${var.app_name}-${var.env_type}-test-framework-manager"
  role             = aws_iam_role.test_framework.arn
  handler          = "test_framework_manager.handler"
  runtime          = "nodejs16.x"
  layers           = [aws_lambda_layer_version.lambda_layer.arn]
  timeout          = 900
  source_code_hash = filebase64sha256("${path.module}/lambda/lambda.zip")
  environment {
    variables = local.lambda_env_variables
  }
  depends_on = [
    aws_lambda_layer_version.lambda_layer,
    data.archive_file.test_framework_zip,
  ]
}

# IAM role
resource "aws_iam_role" "test_framework" {
  name = "lambda-role-${var.app_name}-${var.env_type}-test-framework"

  assume_role_policy = jsonencode(
    {
      "Version" : "2012-10-17",
      "Statement" : [
        {
          "Action" : "sts:AssumeRole",
          "Principal" : {
            "Service" : [
              "s3.amazonaws.com",
              "codedeploy.amazonaws.com",
              "codebuild.amazonaws.com",
              "codepipeline.amazonaws.com",
              "lambda.amazonaws.com",
              "apigateway.amazonaws.com",
              "states.amazonaws.com",
            ]
          },
          "Effect" : "Allow",
          "Sid" : ""
        }
      ]
  })
}

resource "aws_iam_role_policy" "inline_test_framework_policy" {
  name   = "inline-policy-test-framework"
  role   = aws_iam_role.test_framework.id
  policy = data.aws_iam_policy_document.inline_test_framework_policy_doc.json
}

resource "aws_iam_role_policy_attachment" "role-lambda-execution" {
  role       = aws_iam_role.test_framework.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

# resource "aws_iam_policy_attachment" "attach-sf-access" {
#   name = "attach-sf-access-${var.app_name}-${var.env_type}"
#   roles       = [ aws_iam_role.test_framework.name ]
#   policy_arn = "arn:aws:iam::aws:policy/AWSStepFunctionsFullAccess"
# }

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
    privileged_mode             = var.privileged_mode
  }

  logs_config {
    cloudwatch_logs {
      group_name  = "/${local.codebuild_name}/log-group"
      stream_name = "/${local.codebuild_name}/stream"
    }
  }

  source {
    type = "NO_SOURCE"
    buildspec = templatefile("${path.module}/templates/test_buildspec.yml.tpl",
    { app_name = var.app_name, env_type = var.env_type })
  }

  tags = tomap({
    Name        = "codebuild-${local.codebuild_name}",
    environment = "${var.app_name}-${var.env_type}",
    created_by  = "terraform"
  })
}

resource "aws_iam_role" "codebuild_role" {
  name               = "role-${local.codebuild_name}"
  assume_role_policy = aws_iam_role.test_framework.assume_role_policy
}

resource "aws_iam_role_policy" "codebuild_policy" {
  name   = "policy-${local.codebuild_name}"
  role   = aws_iam_role.codebuild_role.id
  policy = data.aws_iam_policy_document.codebuild_role_policy.json
}

module "integration_runner" {
  source                   = "../integration-runner"
  app_name                 = var.app_name
  env_type                 = var.env_type
  role                     = aws_iam_role.test_framework.arn
  integration_tests_bucket = aws_s3_bucket.tests_bucket.bucket
  postman_collections      = var.postman_collections
  environment_variables    = local.lambda_env_variables
  tribe_vpcs                = var.tribe_vpcs
}

module "stress_runner" {
  source                = "../stress-runner"
  app_name              = var.app_name
  env_type              = var.env_type
  threshold             = var.threshold
  role                  = aws_iam_role.test_framework.arn
  stress_tests_bucket   = aws_s3_bucket.tests_bucket.bucket
  jmx_file_path         = var.jmx_file_path
  environment_variables = local.lambda_env_variables
  tribe_vpcs             = var.tribe_vpcs
}
