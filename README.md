<!-- BEGIN_TF_DOCS -->
Integration & Stress tests framework [Terraform module](https://registry.terraform.io/modules/toluna-terraform/codepipline-test-framework/aws/latest)

### Description
This module supports running integration & stress tests intended as a post installation hook of deploy stage using codepipeline,before shifting traffic from test to production, it is lambda based and uses postman collections for Integratin Tests and .jmx for Stress tests.

The output is then uploaded to S3 as junit and html reports and publish under codebuild with a unique report group.

Depending on the flags set in consul application configuration, integraton_tests and stress_tests may be performed or skipped. 

This framework works for differnt DeploymentTypes (ECS / SAM / AppMesh).


\* **an environment equals in it's name to the Terraform workspace it runs under so when referring to an environment or workspace throughout this document their value is actually the same.**



The following resources will be created:
- Lambda
- Codebuild project
- Report group


## Usage
```hcl
module "test_runner" {
  source = "./modules/integration-runner"
  app_name = var.app_name
  env_type = var.env_type
  postman_collections = var.postman_collections
  jmx_file_path = var.jmx_file_path
}
```

## Toggles
In your deploy appspec include the following condition to determinant if to run tests after deploy and before shifting traffic. 
```
    %{ if HOOKS }
    ,
    "Hooks": [
		{
			"BeforeAllowTraffic": "${APP_NAME}-${ENV_TYPE}-test-framework-manager"
		}
	]
    %{ endif }
```

## Requirements

No requirements.

## Providers

| Name | Version |
|------|---------|
| <a name="provider_aws"></a> [aws](#provider\_aws) | n/a |

## Modules

| Name | Source | Version |
|------|--------|---------|
| <a name="module_test_framework_manager"></a> [test\_framework\_manager](#module\_test\_framework\_manager) | ./modules/test-framework-manager | n/a |

## Resources

| Name | Type |
|------|------|
| [aws_codebuild_report_group.CodeCoverageReport](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_report_group) | resource |
| [aws_codebuild_report_group.IntegrationTestReport](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_report_group) | resource |
| [aws_codebuild_report_group.StreesTestReport](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_report_group) | resource |
| [aws_codebuild_report_group.TestReport](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_report_group) | resource |
| [aws_caller_identity.current](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/caller_identity) | data source |
| [aws_region.current](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/region) | data source |
| [aws_ssm_parameter.ado_password](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ssm_parameter) | data source |
| [aws_ssm_parameter.ado_user](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ssm_parameter) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_app_envs"></a> [app\_envs](#input\_app\_envs) | n/a | `any` | n/a | yes |
| <a name="input_app_name"></a> [app\_name](#input\_app\_name) | n/a | `string` | n/a | yes |
| <a name="input_env_type"></a> [env\_type](#input\_env\_type) | n/a | `string` | n/a | yes |
| <a name="input_environment_variables"></a> [environment\_variables](#input\_environment\_variables) | n/a | `map(string)` | `{}` | no |
| <a name="input_environment_variables_parameter_store"></a> [environment\_variables\_parameter\_store](#input\_environment\_variables\_parameter\_store) | n/a | `map(string)` | <pre>{<br>  "ADO_PASSWORD": "/app/ado_password",<br>  "ADO_USER": "/app/ado_user"<br>}</pre> | no |
| <a name="input_jmeter_version"></a> [jmeter\_version](#input\_jmeter\_version) | n/a | `string` | `"5.5"` | no |
| <a name="input_jmx_file_path"></a> [jmx\_file\_path](#input\_jmx\_file\_path) | n/a | `string` | `""` | no |
| <a name="input_postman_collections"></a> [postman\_collections](#input\_postman\_collections) | A list of postman collections (and environments) to run during the execution of the lambda function (in order). Collections and environments from the Postman API must be the collection/environment id | <pre>list(object({<br>    collection  = string<br>    environment = string<br>  }))</pre> | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_CodeCoverageReport"></a> [CodeCoverageReport](#output\_CodeCoverageReport) | n/a |
| <a name="output_IntegrationTestReport"></a> [IntegrationTestReport](#output\_IntegrationTestReport) | n/a |
| <a name="output_StressTestReport"></a> [StressTestReport](#output\_IntegrationTestReport) | n/a |
| <a name="output_TestReport"></a> [TestReport](#output\_TestReport) | n/a |
<!-- END_TF_DOCS -->