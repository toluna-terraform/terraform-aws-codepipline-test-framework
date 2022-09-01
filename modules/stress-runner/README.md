<!-- BEGIN_TF_DOCS -->
## Requirements

No requirements.

## Providers

| Name | Version |
|------|---------|
| <a name="provider_aws"></a> [aws](#provider\_aws) | n/a |

## Modules

No modules.

## Resources

| Name | Type |
|------|------|
| [aws_codebuild_project.stress_runner](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_project) | resource |
| [aws_lambda_function.stress_runner](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function) | resource |
| [aws_lambda_layer_version.lambda_layer_stress](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_layer_version) | resource |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_app_name"></a> [app\_name](#input\_app\_name) | n/a | `string` | n/a | yes |
| <a name="input_env_type"></a> [env\_type](#input\_env\_type) | n/a | `string` | n/a | yes |
| <a name="input_environment_variables"></a> [environment\_variables](#input\_environment\_variables) | n/a | `map(string)` | `{}` | no |
| <a name="input_environment_variables_parameter_store"></a> [environment\_variables\_parameter\_store](#input\_environment\_variables\_parameter\_store) | n/a | `map(string)` | <pre>{<br>  "ADO_PASSWORD": "/app/ado_password",<br>  "ADO_USER": "/app/ado_user"<br>}</pre> | no |
| <a name="input_jmeter_version"></a> [jmeter\_version](#input\_jmeter\_version) | n/a | `string` | `"5.5"` | no |
| <a name="input_jmx_file_path"></a> [jmx\_file\_path](#input\_jmx\_file\_path) | n/a | `string` | `""` | no |
| <a name="input_privileged_mode"></a> [privileged\_mode](#input\_privileged\_mode) | set to true if building a docker | `bool` | `true` | no |
| <a name="input_role"></a> [role](#input\_role) | n/a | `string` | n/a | yes |
| <a name="input_stress_tests_bucket"></a> [stress\_tests\_bucket](#input\_stress\_tests\_bucket) | S3 Bucket name for the S3 Bucket this module will upload the jmx test file | `string` | `null` | no |
| <a name="input_threshold"></a> [threshold](#input\_threshold) | n/a | `number` | `0` | no |

## Outputs

No outputs.
<!-- END_TF_DOCS -->