package test

import (
	"bufio"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"strings"
	"testing"

	"github.com/acarl005/stripansi"
	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/random"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
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

func TestSetup(t *testing.T) {
	terraform.InitAndApply(t, configureTerraformOptions(t))
	fmt.Println("Running Terraform init")
	WriteStateJson(t, configureTerraformOptions(t))
}

func TestBucketExists(t *testing.T) {
	aws.AssertS3BucketExistsE(t, "us-east-1", "test-poc-postman-tests")
	fmt.Println("Checkig for test bucket")
}
func TestTerraformTestLambda(t *testing.T) {
	fmt.Println("invoking test-runner Lambda")
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
	fmt.Println("Running Terraform Destroy")
	terraform.Destroy(t, configureTerraformOptions(t))
}

type ExampleFunctionPayload struct {
	DeploymentId                  string
	LifecycleEventHookExecutionId string
}

func WriteStateJson(t *testing.T, c *terraform.Options) {
	log.Println("Writing Generated resources for coverage verification.")
	file := []byte(terraform.RunTerraformCommand(t, configureTerraformOptions(t), "state", "list"))
	_ = ioutil.WriteFile("resource_list.txt", file, 0644)
	resource_file, err := os.Open("resource_list.txt")
	if err != nil {
		log.Fatalf("failed opening file: %s", err)
	}
	scanner := bufio.NewScanner(resource_file)
	scanner.Split(bufio.ScanLines)
	var txtlines []string

	for scanner.Scan() {
		txtlines = append(txtlines, scanner.Text())
	}

	resource_file.Close()

	for _, eachline := range txtlines {
		if !strings.Contains(eachline, "data.") {
			if err != nil {
				log.Fatal(err)
			}
			resource := terraform.RunTerraformCommand(t, configureTerraformOptions(t), "state", "show", eachline)
			cleanMsg := stripansi.Strip(resource)
			f, err := os.OpenFile("resources.hcl",
				os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if err != nil {
				log.Println(err)
			}
			defer f.Close()
			if _, err := f.WriteString(cleanMsg + "\n"); err != nil {
				log.Println(err)
			}
		}

	}
	defer os.Remove("resource_list.txt")
	defer os.Remove("resources.hcl")
	terraform.HCLFileToJSONFile("resources.hcl", "resources.json")

}

func WriteConverge(s string) {
	if _, err := os.Stat("reports"); os.IsNotExist(err) {
		os.MkdirAll("reports", 0700) // Create your file
	}
	f, err := os.OpenFile("reports/cover.out",
		os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Println(err)
	}
	defer f.Close()
	line := fmt.Sprintf("%s\n", s)
	if _, err := f.WriteString(line); err != nil {
		log.Println(err)
	}
}
