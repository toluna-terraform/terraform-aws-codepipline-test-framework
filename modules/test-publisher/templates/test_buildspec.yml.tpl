version: 0.2


phases:
  pre_build:
      commands:
        - yum install -y yum-utils
        - yum-config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo
        - yum -y install terraform
        - yum install -y yum-utils consul
        - export CONSUL_PROJECT_ID=$(aws ssm get-parameter --name "/infra/$APP_NAME-$ENV_TYPE/consul_project_id" --with-decryption --query 'Parameter.Value' --output text)
        - export CONSUL_HTTP_TOKEN=$(aws ssm get-parameter --name "/infra/$APP_NAME-$ENV_TYPE/consul_http_token" --with-decryption --query 'Parameter.Value' --output text)
        - export CONSUL_HTTP_ADDR=https://consul-cluster-test.consul.$CONSUL_PROJECT_ID.aws.hashicorp.cloud
        - USER=$(echo $(aws ssm get-parameter --name /app/bb_user --with-decryption) | python3 -c "import sys, json; print(json.load(sys.stdin)['Parameter']['Value'])")
        - PASS=$(echo $(aws ssm get-parameter --name /app/bb_pass --with-decryption) | python3 -c "import sys, json; print(json.load(sys.stdin)['Parameter']['Value'])")
        - REPORT_URL="https://console.aws.amazon.com/codesuite/codebuild/testReports/reportGroups/codebuild-publish-reports-$APP_NAME-$ENV_TYPE-integration-test-reports-$ENV_NAME"
        - COMMIT_ID=$(consul kv get "infra/$APP_NAME-$ENV_NAME/commit_id")
  build:
    commands:
      - echo "publishing $ENV_NAME integration test reports"
      - URL="https://api.bitbucket.org/2.0/repositories/tolunaengineering/$APP_NAME/commit/$COMMIT_ID/statuses/build/"
      - curl --request POST --url $URL -u "$USER:$PASS" --header "Accept:application/json" --header "Content-Type:application/json" --data "{\"key\":\"$APP_NAME Integration tests\",\"state\":\"$TEST_STATUS\",\"description\":\"$DESCRIPTION\",\"url\":\"$REPORT_URL\"}"

reports:
  integration-test-reports-$ENV_NAME:
    files:
      - 'report.xml'
    file-format: JunitXml    