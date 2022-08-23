const AWS = require('aws-sdk');
const cb = new AWS.CodeBuild({ apiVersion: '2016-10-06', region: 'us-east-1' });
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

let deploymentId;
let combinedRunner;
let hookId;
let lb_dns_name;
let environment;
let report_group;
let repo;
let branch;

exports.handler = function (event, context, callback) {
  console.log('event', event);
  deploymentId = event.deploymentId;
  combinedRunner = event.Combined;
  hookId = event.hookId;
  lb_dns_name = event.lb_name;
  environment = event.environment;
  report_group = event.report_group;
  repo = event.repo;
  branch = event.branch;

  let error;
  try {
    console.log('starting stress tests ...');
    if (!error) {
      runStressTests(lb_dns_name, environment, deploymentId)
    }
  }
  catch {
    //update the test manage with error
    updateTestManager(false);
  }
};

function runStressTests(lb_dns_name, environment, deploymentId) {
  const cbParams = {
    projectName: `codebuild-stress-runner-${process.env.APP_NAME}-${process.env.ENV_TYPE}`,
    privilegedModeOverride: true,
    environmentVariablesOverride: [
      {
        name: 'LB_NAME',
        value: `${lb_dns_name}`,
        type: 'PLAINTEXT'
      },
      {
        name: 'REPORT_GROUP',
        value: `${report_group}`,
        type: 'PLAINTEXT'
      },
      {
        name: 'ENV_NAME',
        value: `${environment}`,
        type: 'PLAINTEXT'
      },
      {
        name: 'DEPLOYMENT_ID',
        value: `${deploymentId}`,
        type: 'PLAINTEXT'
      },
      {
        name: 'HOOK_ID',
        value: `${hookId}`,
        type: 'PLAINTEXT'
      },
    ],
    sourceVersion: `${branch}`,
    sourceTypeOverride: "BITBUCKET",
    sourceLocationOverride: `https://bitbucket.org/${repo}.git`
  };
  cb.startBuild(cbParams, function (err, data) {
    if (err) {
      throw err;
    }
    console.log(`Started codebuild-stress-runner-${process.env.APP_NAME}-${process.env.ENV_TYPE}`);
  });
}

function updateTestManager(result) {
  var params = {
    FunctionName: `${process.env.APP_NAME}-${process.env.ENV_TYPE}-test-framework-manager"`,
    InvocationType: "Event",
    Payload: JSON.stringify({ hookId: `${hookId}`, deploymentId: `${deploymentId}`, UpdateReport: true, IntegResults: result })
  };
  lambda.invoke(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}