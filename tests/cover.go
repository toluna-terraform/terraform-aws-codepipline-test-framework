package test

import "log"

func check_cover(s string) {
		switch {
case s == "aws_codebuild_report_group.CodeCoverageReport[\"my_env\"]":
		log.Println("check coverage")
case s == "aws_codebuild_report_group.IntegrationTestReport[\"my_env\"]":
		log.Println("check coverage")
case s == "aws_codebuild_report_group.TestReport[\"my_env\"]":
		log.Println("check coverage")
case s == "aws_codebuild_project.tests_reports":
		log.Println("check coverage")
case s == "aws_iam_role.codebuild_role":
		log.Println("check coverage")
case s == "aws_iam_role_policy.codebuild_policy":
		log.Println("check coverage")
case s == "aws_iam_role_policy.codepipeline_policy":
		log.Println("check coverage")
case s == "aws_iam_role.test_framework":
		log.Println("check coverage")
case s == "aws_iam_role_policy_attachment.role-cloudwatch":
		log.Println("check coverage")
case s == "aws_iam_role_policy_attachment.role-codebuild":
		log.Println("check coverage")
case s == "aws_iam_role_policy_attachment.role-codedeploy":
		log.Println("check coverage")
case s == "aws_iam_role_policy_attachment.role-ec2":
		log.Println("check coverage")
case s == "aws_iam_role_policy_attachment.role-lambda-execution":
		log.Println("check coverage")
case s == "aws_iam_role_policy_attachment.role-lambda-ssm":
		log.Println("check coverage")
case s == "aws_iam_role_policy_attachment.role-s3":
		log.Println("check coverage")
case s == "aws_lambda_function.test_framework":
		log.Println("check coverage")
case s == "aws_lambda_layer_version.lambda_layer":
		log.Println("check coverage")
case s == "aws_s3_bucket.postman_bucket":
		log.Println("check coverage")
case s == "aws_s3_bucket_acl.postman_bucket":
		log.Println("check coverage")
case s == "aws_s3_bucket_policy.postman_bucket":
		log.Println("check coverage")
case s == "aws_s3_bucket_public_access_block.postman_bucket":
		log.Println("check coverage")
case s == "aws_s3_bucket_versioning.postman_bucket":
		log.Println("check coverage")
	}
}