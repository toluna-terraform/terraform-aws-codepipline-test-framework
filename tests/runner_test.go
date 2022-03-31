package test

import (
	"fmt"
	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/random"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
	"github.com/toluna-terraform/terraform-test-library/modules/commons"
	"github.com/toluna-terraform/terraform-test-library/modules/coverage"
	"log"
	"testing"
)

var expectedAppName = fmt.Sprintf("terratest-test-framework-%s", random.UniqueId())
var expectedEnvType = fmt.Sprintf("terratest-env-type-%s", random.UniqueId())
var expectedAppEnvs = fmt.Sprintf("terratest-app-envs-%s", random.UniqueId())
var expectedFuncName = fmt.Sprintf("%s-test-framework", "my_app-non-prod")

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
				  collection = "my_app.postman_collection.json"
				  environment = "postman_environment.json"
				}
				]`,
		},
	})

	return terraformOptions

}

var moduleName = commons.GetModName()

func TestSetup(t *testing.T) {
	terraform.InitAndApply(t, configureTerraformOptions(t))
	log.Println("Running Terraform init")
	coverage.WriteCovergeFiles(t, configureTerraformOptions(t), moduleName)
}

func TestBucketExists(t *testing.T) {
	log.Println("Checking for test bucket")
	coverage.MarkAsCovered("aws_s3_bucket.postman_bucket", moduleName)
	err := aws.AssertS3BucketExistsE(t, "us-east-1", "test-poc-postman-tests")
	assert.Nil(t, err, "Bucket not found")
}
func TestTerraformTestLambda(t *testing.T) {
	log.Println("invoking test-runner Lambda")
	coverage.MarkAsCovered("aws_lambda_function.test_framework", moduleName)
	var invocationType aws.InvocationTypeOption = aws.InvocationTypeRequestResponse
	input := &aws.LambdaOptions{
		InvocationType: &invocationType,
		Payload:        ExampleFunctionPayload{DeploymentId: "d-XXXXXXXXX", LifecycleEventHookExecutionId: "hi!"},
	}
	out, err := aws.InvokeFunctionWithParamsE(t, "us-east-1", expectedFuncName, input)
	assert.Contains(t, string(out.Payload), "DeploymentDoesNotExistException")
	assert.Equal(t, err.Error(), "Unhandled")
}

func TestCleanUp(t *testing.T) {
	log.Println("Running Terraform Destroy")
	terraform.Destroy(t, configureTerraformOptions(t))
}

type ExampleFunctionPayload struct {
	DeploymentId                  string
	LifecycleEventHookExecutionId string
}
