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
  lambda_env_variables = {
    ALB_WAIT_TIME          = var.alb_wait_time
    S3_BUCKET              = local.using_local_files ? aws_s3_bucket.postman_bucket.bucket : null
    POSTMAN_COLLECTIONS    = jsonencode(var.postman_collections)
    APP_NAME               = var.app_name
    env_type               = var.env_type
    TEST_ENV_VAR_OVERRIDES = jsonencode(var.test_env_var_overrides)
  }
  lambda_function_name = "${var.app_name}-postman-tests"
  using_vpc_config     = length(var.vpc_subnet_ids) > 0
}

resource "aws_s3_bucket" "postman_bucket" {
  force_destroy = true
  bucket        = "${var.app_name}-${var.env_type}-postman-tests"
  acl           = "private"
  versioning {
    enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "postman_bucket" {
  bucket = aws_s3_bucket.postman_bucket.id
  block_public_acls   = true
  block_public_policy = true
  ignore_public_acls  = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "postman_bucket" {
  bucket = aws_s3_bucket.postman_bucket.id
  policy = data.aws_iam_policy_document.postman_bucket.json
}

resource "null_resource" "layer_zip" {
  triggers = {
    always_run = "${timestamp()}"
  }
  provisioner "local-exec" {
    when = create
    command = <<-EOT
      mkdir -p ${path.module}/lambda/dist/nodejs
      cp ${path.module}/lambda/*.json ${path.module}/lambda/dist/nodejs
      cd ${path.module}/lambda/dist/nodejs
      npm install
    EOT
  }
}

data "archive_file" "layer_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/dist"
  output_path = "${path.module}/layer.zip"
  depends_on = [null_resource.layer_zip]
}

resource "aws_lambda_layer_version" "lambda_layer" {
  filename   = "${path.module}/layer.zip"
  layer_name = "postman"
  compatible_runtimes = ["nodejs12.x"]
  source_code_hash = "${data.archive_file.layer_zip.output_base64sha256}"
}

data "archive_file" "lambda_zip" {
 type        = "zip"
  source_dir  = "${path.module}/lambda/"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "test_framework" {
  filename      = "${path.module}/lambda.zip"
  function_name = "${var.app_name}-${var.env_type}-test-framework"
  role          = aws_iam_role.test_framework.arn
  handler       = "test_framework.handler"
  runtime       = "nodejs12.x"
  layers = [aws_lambda_layer_version.lambda_layer.arn]
  timeout       = 180
  source_code_hash = "${data.archive_file.lambda_zip.output_base64sha256}"
  environment {
    variables = local.lambda_env_variables
  }
}

resource "null_resource" "remove_zip" {
  triggers = {
    always_run = "${timestamp()}"
  }
  provisioner "local-exec" {
    when = create
    command = <<-EOT
      rm -f ${path.module}/*.zip
      rm -rf ${path.module}/lambda/dist
      EOT
  }
  depends_on = [aws_lambda_function.test_framework]
}

# IAM
resource "aws_iam_role" "test_framework" {
  name = "test_framework"

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
    role       = "${aws_iam_role.test_framework.name}"
    policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "role-lambda-ssm" {
    role       = "${aws_iam_role.test_framework.name}"
    policy_arn = "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess"
}

resource "aws_iam_role_policy_attachment" "role-cloudwatch" {
    role       = "${aws_iam_role.test_framework.name}"
    policy_arn = "arn:aws:iam::aws:policy/CloudWatchFullAccess"
}

resource "aws_iam_role_policy_attachment" "role-codedeploy" {
    role       = "${aws_iam_role.test_framework.name}"
    policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployFullAccess"
}

resource "aws_iam_role_policy_attachment" "role-codebuild" {
    role       = "${aws_iam_role.test_framework.name}"
    policy_arn = "arn:aws:iam::aws:policy/AWSCodeBuildDeveloperAccess"
}

resource "aws_iam_role_policy_attachment" "role-s3" {
    role       = "${aws_iam_role.test_framework.name}"
    policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}