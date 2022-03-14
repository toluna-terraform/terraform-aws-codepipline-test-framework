version: 0.2

env:
  parameter-store:
    BB_USER: "/app/bb_user"  
    BB_PASS: "/app/bb_app_pass"
    CONSUL_PROJECT_ID: "/infra/${app_name}-${env_type}/consul_project_id"
    CONSUL_HTTP_TOKEN: "/infra/${app_name}-${env_type}/consul_http_token"

phases:
  pre_build:
      commands:
        - yum install -y yum-utils
        - yum-config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo
        - yum -y install terraform
        - yum install -y yum-utils consul
        - export CONSUL_HTTP_ADDR=https://consul-cluster-test.consul.$CONSUL_PROJECT_ID.aws.hashicorp.cloud
        - REPORT_URL="https://console.aws.amazon.com/codesuite/codebuild/testReports/reportGroups/$APP_NAME-$ENV_NAME-IntegrationTestReport"
        - COMMIT_ID=$(consul kv get "infra/$APP_NAME-$ENV_NAME/commit_id")
        - export BB_TOKEN=$(echo "$BB_USER:$BB_PASS" | base64)
  build:
    commands:
      - echo "publishing $ENV_NAME integration test reports"
      - URL="https://api.bitbucket.org/2.0/repositories/tolunaengineering/$APP_NAME/commit/$COMMIT_ID/statuses/build/"
      - curl --request POST --url $URL --header "Authorization:Basic $BB_TOKEN" --header "Accept:application/json" --header "Content-Type:application/json" --data "{\"key\":\"$APP_NAME Integration tests\",\"state\":\"$TEST_STATUS\",\"description\":\"$DESCRIPTION\",\"url\":\"$REPORT_URL\"}"
      
reports:
  $REPORT_GROUP:
    files:
      - 'report.xml'
    file-format: JunitXml    