data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "codebuild_role_policy" {
  statement {
    actions   = [
      "logs:*",
      "ssm:*",
      "s3:*",
      "codebuild:*",
      "ec2:*"
        ]
    resources = ["*"]
  }
}

data "aws_ssm_parameter" "codepipeline_connection_arn" {
  name = "/infra/codepipeline/connection_arn"
}

data "aws_iam_policy_document" "tests_bucket" {
  statement {
    principals {
      type        = "AWS"
      identifiers = ["${aws_iam_role.test_framework.arn}"]
    }

    actions = [
      "s3:*"
    ]

    resources = [
      aws_s3_bucket.tests_bucket.arn,
      "${aws_s3_bucket.tests_bucket.arn}/*",
    ]
  }
}