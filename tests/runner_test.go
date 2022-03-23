package test

import (
	"fmt"
	"testing"

	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/random"
	"github.com/gruntwork-io/terratest/modules/terraform"
	test_structure "github.com/gruntwork-io/terratest/modules/test-structure"
	"github.com/stretchr/testify/assert"
)

var expectedAppName = fmt.Sprintf("terratest-test-framework-%s", random.UniqueId())
var expectedEnvType = fmt.Sprintf("terratest-env-type-%s", random.UniqueId())
var expectedAppEnvs = fmt.Sprintf("terratest-app-envs-%s", random.UniqueId())

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

// An example of how to test the Terraform module in examples/terraform-aws-ecs-example using Terratest.
func TestSetup(t *testing.T) {
	t.Parallel()
	t.Name()
	// Pick a random AWS region to test in. This helps ensure your code works in all regions.
	// Construct the terraform options with default retryable errors to handle the most common retryable errors in
	// terraform testing.

	// At the end of the test, run `terraform destroy` to clean up any resources that were created
	defer test_structure.RunTestStage(t, "destroy", func() {
		terraformOptions := configureTerraformOptions(t)
		terraform.Destroy(t, terraformOptions)
	})

	// This will run `terraform init` and `terraform apply` and fail the test if there are any errors
	test_structure.RunTestStage(t, "setup", func() {
		terraformOptions := configureTerraformOptions(t)
		terraform.InitAndApply(t, terraformOptions)
	})

	test_structure.RunTestStage(t, "validate", func() {
		terraformOptions := configureTerraformOptions(t)
		testBucketExists(t, terraformOptions)
	})
	test_structure.RunTestStage(t, "validate", func() {
		terraformOptions := configureTerraformOptions(t)
		testAssertFail(t, terraformOptions)
	})

}

func testBucketExists(t *testing.T, terraformOptions *terraform.Options) {
	aws.AssertS3BucketExistsE(t, "us-east-1", "test-poc-postman-tests")
}

func testAssertFail(t *testing.T, terraformOptions *terraform.Options) {
	assert.Equal(t, "1", "2")
}
