data "aws_s3_bucket" "codepipeline_bucket" {
  bucket = "${var.app_name}-${var.env_type}-postman-tests"
}

data "aws_iam_policy_document" "codebuild_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
        }
    }
}

data "aws_iam_policy_document" "codebuild_role_policy" {
  statement {
    actions   = [
          "logs:*",
          "ssm:*",
          "s3:*",
          "codebuild:*"
        ]
    resources = ["*"]
  }
}

data "aws_ssm_parameter" "codepipeline_connection_arn" {
  name = "/infra/codepipeline/connection_arn"
}

data "aws_iam_policy_document" "codepipeline_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codepipeline.amazonaws.com", "codedeploy.amazonaws.com"]
    }
  }
}

