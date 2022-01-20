data "aws_s3_bucket" "codepipeline_bucket" {
  bucket = var.s3_bucket
}

data "aws_iam_policy_document" "codebuild_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com",]
        }
    }
}

data "aws_iam_policy_document" "codebuild_role_policy" {
  statement {
    actions   = [
          "s3:*",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "ssm:*",
          "codebuild:*"
        ]
    resources = [
          "${data.aws_s3_bucket.codepipeline_bucket.arn}",
          "${data.aws_s3_bucket.codepipeline_bucket.arn}/*"
        ]
  }
  statement {
    actions   = [
          "logs:*",
          "ssm:*",
          "s3:*"
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

data "aws_iam_policy_document" "codepipeline_role_policy" {
  statement {
    actions = [
          "s3:*",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "ssm:*",
          "codebuild:*"
    ]
    resources = ["*"]
  }
}
