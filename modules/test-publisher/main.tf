locals{
    codebuild_name        = "codebuild-publish-reports-${var.app_name}-${var.env_type}" 
    codepipeline_name     = "codepipeline-publish-reports-${var.app_name}-${var.env_type}"
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

resource "aws_iam_role_policy" "codepipeline_policy" {
  name = "policy-${local.codebuild_name}"
  role = aws_iam_role.codebuild_role.id
  policy = data.aws_iam_policy_document.codepipeline_role_policy.json
}
