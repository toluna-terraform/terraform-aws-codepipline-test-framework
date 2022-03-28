package test

import (
	"bufio"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"strings"
	"testing"

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
	log.Println("Running Terraform init")
	WriteStateJson(t, configureTerraformOptions(t))
}

func TestBucketExists(t *testing.T) {
	log.Println("Checking for test bucket")
	//WriteConverge("aws_s3_bucket_policy.postman_bucket")
	err := aws.AssertS3BucketExistsE(t, "us-east-1", "test-poc-postman-tests")
	assert.Nil(t, err, "Bucket not found")
}
func TestTerraformTestLambda(t *testing.T) {
	log.Println("invoking test-runner Lambda")
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
	os.Remove("cover.go")
	f, err := os.OpenFile("cover.go",
		os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Println(err)
	}
	if _, err := f.WriteString("package test\n\nimport \"log\"\n\nfunc check_cover(s string) {\n\t\tswitch {\n"); err != nil {
		log.Println(err)
	}
	for _, eachline := range txtlines {
		if !strings.Contains(eachline, "data.") {
			if err != nil {
				log.Fatal(err)
			}
			eachline = strings.Replace(eachline, "\"", "\\\"", -1)
			resource_name := strings.Split(eachline, ".")
			rn := fmt.Sprintf("case s == \"%s.%s\":\n\t\tlog.Println(\"check coverage\")", resource_name[len(resource_name)-2], resource_name[len(resource_name)-1])
			if _, err := f.WriteString(rn + "\n"); err != nil {
				log.Println(err)
			}
		}
	}
	defer os.Remove("resource_list.txt")
	defer f.Close()
	if _, err := f.WriteString("\t}\n}"); err != nil {
		log.Println(err)
	}
}

func WriteConverge(s string) {
	/*
		get module name from file
		write cover.out
		find line number
		mode: set
		github.com/toluna-terraform/terraform-aws-codepipline-test-framework/cover.go:7.5,8.5 4 1
		github.com/toluna-terraform/terraform-aws-codepipline-test-framework/cover.go:8.5,9.5 4 0
	*/
}
