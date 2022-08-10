data "aws_iam_policy_document" "stress_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
        }
    }
}

data "aws_iam_policy_document" "stress_role_policy" {
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

data "aws_ssm_parameter" "stress_connection_arn" {
  name = "/infra/codepipeline/connection_arn"
}

data "aws_iam_policy_document" "stress_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codepipeline.amazonaws.com", "codedeploy.amazonaws.com"]
    }
  }
}

