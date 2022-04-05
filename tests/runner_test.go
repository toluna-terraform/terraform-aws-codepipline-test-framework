package test

import (
	"fmt"
	"log"
	"net/url"
	"strings"
	"testing"

	aws "github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/codebuild"
	"github.com/aws/aws-sdk-go/service/iam"
	"github.com/aws/aws-sdk-go/service/lambda"
	aws_terratest "github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/random"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
	tolunacommons "github.com/toluna-terraform/terraform-test-library/modules/commons"
	tolunacoverage "github.com/toluna-terraform/terraform-test-library/modules/coverage"
	tolunas3aws "github.com/toluna-terraform/terraform-test-library/modules/toluna_aws"
)

var expectedAppName = fmt.Sprintf("terratest-test-framework-%s", random.UniqueId())
var expectedEnvType = fmt.Sprintf("terratest-env-type-%s", random.UniqueId())
var expectedAppEnvs = fmt.Sprintf("terratest-app-envs-%s", random.UniqueId())
var expectedFuncName = fmt.Sprintf("%s-test-framework", "my-app-non-prod")

func configureTerraformOptions(t *testing.T) *terraform.Options {

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		// The path to where our Terraform code is located
		TerraformDir: "../examples/test_framework",

		// Variables to pass to our Terraform code using -var options
		Vars: map[string]interface{}{
			"app_name": expectedAppName,
			"app_envs": expectedAppEnvs,
			"env_type": expectedEnvType,
			"postman_collections": `[
				{
				  collection = "my-app.postman_collection.json"
				  environment = "postman_environment.json"
				}
				]`,
		},
	})

	return terraformOptions

}

var moduleName = tolunacommons.GetModName()
var region = "us-east-1"
var bucket = "my-app-non-prod-postman-tests"

func TestSetup(t *testing.T) {
	terraform.InitAndApply(t, configureTerraformOptions(t))
	log.Println("Running Terraform init")
	tolunacoverage.WriteCovergeFiles(t, configureTerraformOptions(t), moduleName)
}

func TestBucketExists(t *testing.T) {
	log.Println("Checking for test bucket")
	tolunacoverage.MarkAsCovered("aws_s3_bucket.postman_bucket", moduleName)
	err := aws_terratest.AssertS3BucketExistsE(t, region, bucket)
	assert.Nil(t, err, "Bucket not found")
}

func TestBucketACLExists(t *testing.T) {
	log.Println("Checking for test bucket acl ")
	tolunacoverage.MarkAsCovered("aws_s3_bucket_acl.postman_bucket", moduleName)
	result := tolunas3aws.S3GetBucketACLs(t, region, bucket)
	assert.NotNil(t, *result.Owner.DisplayName, "Owner not found")
	assert.Equal(t, *result.Grants[0].Permission, "FULL_CONTROL", "ACL not granted")
}

func TestBucketVersioningExists(t *testing.T) {
	log.Println("Checking for test bucket versioning")
	tolunacoverage.MarkAsCovered("aws_s3_bucket_versioning.postman_bucket", moduleName)
	err := aws_terratest.AssertS3BucketVersioningExistsE(t, region, bucket)
	assert.Nil(t, err, "Bucket version not found")
}

func TestBucketPublicAccessBlock(t *testing.T) {
	log.Println("Checking for test bucket public access block")
	tolunacoverage.MarkAsCovered("aws_s3_bucket_public_access_block.postman_bucket", moduleName)
	log.Println("Checking for test bucket acl ")
	tolunacoverage.MarkAsCovered("aws_s3_bucket_acl.postman_bucket", moduleName)
	result := tolunas3aws.S3GetPublicAccessBlock(t, region, bucket)
	assert.True(t, *result.PublicAccessBlockConfiguration.BlockPublicAcls, "BlockPublicAcls = False")
	assert.True(t, *result.PublicAccessBlockConfiguration.BlockPublicPolicy, "BlockPublicPolicy = False")
	assert.True(t, *result.PublicAccessBlockConfiguration.IgnorePublicAcls, "IgnorePublicAcls = False")
	assert.True(t, *result.PublicAccessBlockConfiguration.RestrictPublicBuckets, "RestrictPublicBuckets = False")
}

func TestBucketPolicy(t *testing.T) {
	log.Println("Checking for test bucket policy ")
	tolunacoverage.MarkAsCovered("aws_s3_bucket_policy.postman_bucket", moduleName)
	result := tolunas3aws.S3GetBucketPolicy(t, region, bucket)
	assert.Equal(t, result.Effect, "Allow", "Wrong Effect in policy")
	assert.True(t, strings.HasSuffix(result.Resource, bucket), "Wrong Resource in policy")
	assert.True(t, strings.HasSuffix(result.Principal, "my-app_non-prod_test_framework"), "Wrong Principal in policy")
	assert.Equal(t, result.Action, "s3:*", "Wrong Action in policy")
}

func TestTerraformInvokeRunnerLambda(t *testing.T) {
	log.Println("invoking test-runner Lambda")
	tolunacoverage.MarkAsCovered("aws_lambda_function.test_framework", moduleName)
	var invocationType aws_terratest.InvocationTypeOption = aws_terratest.InvocationTypeRequestResponse
	input := &aws_terratest.LambdaOptions{
		InvocationType: &invocationType,
		Payload:        ExampleFunctionPayload{DeploymentId: "d-XXXXXXXXX", LifecycleEventHookExecutionId: "hi!"},
	}
	out, err := aws_terratest.InvokeFunctionWithParamsE(t, region, expectedFuncName, input)
	assert.Contains(t, string(out.Payload), "DeploymentDoesNotExistException")
	assert.Equal(t, err.Error(), "Unhandled")
}

func TestTerraformRunnerLambdaLayer(t *testing.T) {
	log.Println("Verify test-runner Lambda layer")
	tolunacoverage.MarkAsCovered("aws_lambda_layer_version.lambda_layer", moduleName)
	sess, err := aws_terratest.NewAuthenticatedSession(region)
	svc := lambda.New(sess)
	input := &lambda.GetLayerVersionInput{
		LayerName:     aws.String("postman"),
		VersionNumber: aws.Int64(1),
	}
	result, err := svc.GetLayerVersion(input)
	if err != nil {
		assert.Nil(t, err, "Failed to get layer")
	}
	assert.True(t, strings.HasSuffix(*result.LayerArn, "layer:postman"), "Wrong Layer ARN returned")
	assert.True(t, strings.HasSuffix(*result.LayerVersionArn, "layer:postman:1"), "Wrong Version ARN returned")
}

func TestTerraformIAMGetRoleTestFrameWork(t *testing.T) {
	log.Println("Verify aws_iam_role.test_framework")
	tolunacoverage.MarkAsCovered("aws_iam_role.test_framework", moduleName)
	sess, err := aws_terratest.NewAuthenticatedSession(region)
	svc := iam.New(sess)
	input := &iam.GetRoleInput{
		RoleName: aws.String("my-app_non-prod_test_framework"),
	}
	result, err := svc.GetRole(input)
	if err != nil {
		assert.Nil(t, err, "Failed to get Role")
	}
	assert.True(t, strings.HasSuffix(*result.Role.Arn, "my-app_non-prod_test_framework"), "Wrong role ARN returned")
}

func TestTerraformIAMGetRoleCodebuild(t *testing.T) {
	log.Println("Verify aws_iam_role.aws_iam_role.codebuild_role")
	tolunacoverage.MarkAsCovered("aws_iam_role.codebuild_role", moduleName)
	sess, err := aws_terratest.NewAuthenticatedSession(region)
	svc := iam.New(sess)
	input := &iam.GetRoleInput{
		RoleName: aws.String("role-my-app-non-prod-codebuild-publish-reports-my-app-non-prod"),
	}
	result, err := svc.GetRole(input)
	if err != nil {
		assert.Nil(t, err, "Failed to get Role")
	}
	assert.True(t, strings.HasSuffix(*result.Role.Arn, "role-my-app-non-prod-codebuild-publish-reports-my-app-non-prod"), "Wrong role ARN returned")
}

func TestAttachedPoliciesTestFrameworkRole(t *testing.T) {
	log.Println("Verify policies for test framework role ")
	tolunacoverage.MarkAsCovered("aws_iam_role_policy_attachment.role-cloudwatch", moduleName)
	tolunacoverage.MarkAsCovered("aws_iam_role_policy_attachment.role-codebuild", moduleName)
	tolunacoverage.MarkAsCovered("aws_iam_role_policy_attachment.role-codedeploy", moduleName)
	tolunacoverage.MarkAsCovered("aws_iam_role_policy_attachment.role-ec2", moduleName)
	tolunacoverage.MarkAsCovered("aws_iam_role_policy_attachment.role-lambda-execution", moduleName)
	tolunacoverage.MarkAsCovered("aws_iam_role_policy_attachment.role-lambda-ssm", moduleName)
	tolunacoverage.MarkAsCovered("aws_iam_role_policy_attachment.role-s3", moduleName)
	sess, err := aws_terratest.NewAuthenticatedSession(region)
	svc := iam.New(sess)
	input := &iam.ListAttachedRolePoliciesInput{
		RoleName: aws.String("my-app_non-prod_test_framework"),
	}
	result, err := svc.ListAttachedRolePolicies(input)
	if err != nil {
		assert.Nil(t, err, "Failed to get Role")
	}
	policyList := []string{}
	pname := []string{"AWSLambdaBasicExecutionRole", "AmazonSSMReadOnlyAccess", "CloudWatchFullAccess", "AWSCodeDeployFullAccess", "AWSCodeBuildDeveloperAccess", "AmazonS3FullAccess", "ElasticLoadBalancingReadOnly"}
	for _, policyName := range result.AttachedPolicies {
		log.Printf("Verify policy %s for test framework role is attached", *policyName.PolicyName)
		policyList = append(policyList, *policyName.PolicyName)
		assert.True(t, tolunacommons.ListContains(pname, *policyName.PolicyName), fmt.Sprintf("Policy name %s not attached", *policyName.PolicyName))
	}
	for _, policyName := range pname {
		assert.True(t, tolunacommons.ListContains(policyList, policyName), fmt.Sprintf("Policy name %s should not attached", policyName))
	}
}

func TestRolePoliciesCodeBuildRole(t *testing.T) {
	tolunacoverage.MarkAsCovered("aws_iam_role_policy.codebuild_policy", moduleName)
	log.Println("Verify policies for codebuild role ")
	sess, err := aws_terratest.NewAuthenticatedSession(region)
	svc := iam.New(sess)
	input := &iam.GetRolePolicyInput{
		RoleName:   aws.String("role-my-app-non-prod-codebuild-publish-reports-my-app-non-prod"),
		PolicyName: aws.String("policy-codebuild-publish-reports-my-app-non-prod"),
	}
	result, err := svc.GetRolePolicy(input)
	if err != nil {
		assert.Nil(t, err, "Failed to get Policy")
	}
	encodedValue := *result.PolicyDocument
	decodedValue, err := url.QueryUnescape(encodedValue)
	if err != nil {
		assert.Nil(t, err, "Failed to get Policy")
	}
	expectedPolicy := strings.ReplaceAll(`{
	"Version":"2012-10-17",
	"Statement":[
		{
			"Sid":"",
			"Effect":"Allow",
			"Action":[
				"ssm:*",
				"s3:*",
				"logs:*",
				"codebuild:*"
			],
			"Resource":"*"
		}
		]
	}`, "\t", "")
	decodedPolicy := strings.ReplaceAll(decodedValue, " ", "")
	assert.Equal(t, expectedPolicy, decodedPolicy, fmt.Sprintf("Policy document %s does not match expected document", expectedPolicy))
}

func TestCodeBuildTestReportsProject(t *testing.T) {
	tolunacoverage.MarkAsCovered("aws_codebuild_project.tests_reports", moduleName)
	log.Println("Verify codebuild project is created")
	sess, err := aws_terratest.NewAuthenticatedSession(region)
	svc := codebuild.New(sess)
	input := &codebuild.ListProjectsInput{}
	result, err := svc.ListProjects(input)
	if err != nil {
		assert.Nil(t, err, "Failed to get Policy")
	}
	projectFound := false
	for _, projectName := range result.Projects {
		if *projectName == "codebuild-publish-reports-my-app-non-prod" {
			projectFound = true
		}
	}
	assert.True(t, projectFound, fmt.Sprintf("Project %s not created", "codebuild-publish-reports-my-app-non-prod"))
}

func TestCodeBuildTestReportsGroups(t *testing.T) {
	log.Println("Verify codebuild report groups are created")
	tolunacoverage.MarkAsCovered("aws_codebuild_report_group.CodeCoverageReport['my-env']", moduleName)
	tolunacoverage.MarkAsCovered("aws_codebuild_report_group.IntegrationTestReport['my-env']", moduleName)
	tolunacoverage.MarkAsCovered("aws_codebuild_report_group.TestReport['my-env']", moduleName)
	sess, err := aws_terratest.NewAuthenticatedSession(region)
	if err != nil {
		assert.Nil(t, err, "Failed to get Report group")
	}
	svc := codebuild.New(sess)
	input := &codebuild.ListReportGroupsInput{}
	result, err := svc.ListReportGroups(input)
	reportList := []string{"my-app-my-env-CodeCoverageReport", "my-app-my-env-IntegrationTestReport", "my-app-my-env-TestReport"}

	for _, reportGroupName := range result.ReportGroups {
		groupName := strings.Split(*reportGroupName, "/")
		if strings.HasPrefix(groupName[1], "my-app") {
			assert.True(t, tolunacommons.ListContains(reportList, groupName[1]), fmt.Sprintf("Report group %s not created", groupName[1]))
		}
	}
}

func TestCleanUp(t *testing.T) {
	log.Println("Running Terraform Destroy")
	terraform.Destroy(t, configureTerraformOptions(t))
}

type ExampleFunctionPayload struct {
	DeploymentId                  string
	LifecycleEventHookExecutionId string
}
