Integration tests framework [Terraform module](https://registry.terraform.io/modules/toluna-terraform/codepipline-test-framework/aws/latest)

### Description
This module supports running integration tests intended as a post installation hook of deploy stage using codepipeline,before shifting traffic from test to production, it is lambda based and uses postman collections combined with postman Cli(newman).
The output is then uploaded to S3 as junit and html reports and publish under codebuild with a unique report group.

\* **an environment equals in it's name to the Terraform workspace it runs under so when referring to an environment or workspace throughout this document their value is actually the same.**



The following resources will be created:
- Lambda
- Codebuild project
- Report group


## Usage
```hcl
module "test_reports" {
  source                                = "./modules/test-publisher"
  app_name                              = var.app_name
  env_type                              = var.env_type
  codebuild_name                        = "tests-reports-${var.app_name}"
  s3_bucket                             = "${var.app_name}-${var.env_type}-postman-tests"
  privileged_mode                       = true
  environment_variables_parameter_store = var.environment_variables_parameter_store
}
```

## Toggles
In your deploy appspec include the following condition to determinant if to run tests after deploy and before shifting traffic. 
```
    %{ if HOOKS }
    ,
    "Hooks": [
		{
			"BeforeAllowTraffic": "${APP_NAME}-${ENV_TYPE}-test-framework"
		}
	]
    %{ endif }
```

## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_terraform"></a> [terraform](#requirement\_terraform) | >= 1.0.0 |
| <a name="requirement_aws"></a> [aws](#requirement\_aws) | >= 3.59 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_aws"></a> [aws](#provider\_aws) | >= 3.59 |
| <a name="provider_null"></a> [null](#provider\_null) | >= 3.1.0 |

## Modules

| Name | Source | Version |
|------|--------|---------|
| <a name="test_framework"></a> [test framework](#module\_test_framework) | ../../ |  |

## Resources

| Name | Type |
|------|------|
| [null_resource](https://registry.terraform.io/providers/hashicorp/null/latest/docs/resources/resource) | resource |
| [aws_s3_bucket](https://registry.terraform.io/providers/hashicorp/aws_s3_bucket/latest/docs/resources/resource) | resource |
| [aws_s3_bucket_public_access_block](https://registry.terraform.io/providers/hashicorp/aws_s3_bucket_public_access_block/latest/docs/resources/resource) | resource |
| [aws_s3_bucket_policy](https://registry.terraform.io/providers/hashicorp/aws_s3_bucket_policy/latest/docs/resources/resource) | resource |
| [archive_file](https://registry.terraform.io/providers/hashicorp/archive_file/latest/docs/resources/resource) | resource |
| [aws_lambda_layer_version](https://registry.terraform.io/providers/hashicorp/aws_lambda_layer_version/latest/docs/resources/resource) | resource |
| [aws_lambda_function](https://registry.terraform.io/providers/hashicorp/aws_lambda_function/latest/docs/resources/resource) | resource |
| [aws_iam_role](https://registry.terraform.io/providers/hashicorp/aws_iam_role/latest/docs/resources/resource) | resource |
| [aws_iam_role_policy_attachment](https://registry.terraform.io/providers/hashicorp/aws_iam_role_policy_attachment/latest/docs/resources/resource) | resource |
| [aws_codebuild_project](https://registry.terraform.io/providers/hashicorp/aws_codebuild_project/latest/docs/resources/resource) | resource |


## Inputs

No inputs.

## Outputs
No outputs.

