version: 0.2


phases:
  build:
    commands:
      - echo "publishing $ENV_NAME integration test reports"
reports:
  integration-test-reports-$ENV_NAME:
    files:
      - 'report.xml'
    file-format: JunitXml    