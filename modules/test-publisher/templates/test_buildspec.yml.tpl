version: 0.2


phases:
  pre_build:
      commands:
        - USER=$(echo $(aws ssm get-parameter --name /app/bb_user --with-decryption) | python3 -c "import sys, json; print(json.load(sys.stdin)['Parameter']['Value'])")
        - PASS=$(echo $(aws ssm get-parameter --name /app/bb_pass --with-decryption) | python3 -c "import sys, json; print(json.load(sys.stdin)['Parameter']['Value'])")
        - REPORT_URL="https://console.aws.amazon.com/codesuite/codebuild/testReports/reportGroups/codebuild-publish-reports-$APP_NAME-$ENV_TYPE-integration-test-reports-$ENV_NAME"
  build:
    commands:
      - echo "publishing $ENV_NAME integration test reports"
      - URL="https://api.bitbucket.org/2.0/repositories/tolunaengineering/$APP_NAME/commit/$COMMIT_ID/statuses/build/" && curl --request POST --url $URL -u "$USER:$PASS" --header "Accept:application/json" --header "Content-Type:application/json" --data "{\"key\":\"$APP_NAME Integration tests\",\"state\":\"$TEST_STATUS\",\"description\":\"$DESCRIPTION\",\"URL\":\"$URL\"}"

reports:
  integration-test-reports-$ENV_NAME:
    files:
      - 'report.xml'
    file-format: JunitXml    