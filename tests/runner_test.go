package test

import (
	"fmt"
	"testing"

	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/random"
	"github.com/gruntwork-io/terratest/modules/terraform"
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
func TestTerraformTestFramework(t *testing.T) {
	t.Parallel()
	for _, testFuncs := range []struct {
		name  string
		tfunc func(*testing.T)
	}{
		{"Terraform Init", testSetup},
		{"Bucket Exists", testBucketExists},
		{"Test AssertFail", testAssertFail},
		{"Clean up", testCleanUp}} {
		t.Run(testFuncs.name, testFuncs.tfunc)
	}

}

func testSetup(t *testing.T) {
	terraform.InitAndApply(t, configureTerraformOptions(t))
}

func testCleanUp(t *testing.T) {
	terraform.Destroy(t, configureTerraformOptions(t))
}

func testBucketExists(t *testing.T) {
	aws.AssertS3BucketExistsE(t, "us-east-1", "test-poc-postman-tests")
}

func testAssertFail(t *testing.T) {
	assert.Equal(t, "1", "2")
}
