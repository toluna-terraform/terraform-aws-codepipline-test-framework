data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "codebuild_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com","codepipeline.amazonaws.com", "codedeploy.amazonaws.com"]
        }
    }
}

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
