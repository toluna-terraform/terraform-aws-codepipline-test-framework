const AWS = require('aws-sdk');
const cb = new AWS.CodeBuild({ apiVersion: '2016-10-06', region: 'us-east-1' });
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

let deploymentId;
let combinedRunner;
let hookId;
let lb_dns_name;
let environment;
let report_group;

exports.handler = function (event, context, callback) {
  console.log('event', event);
  deploymentId = event.deploymentId;
  combinedRunner = event.Combined;
  hookId = event.hookId;
  lb_dns_name = event.lb_name;
  port = event.port;
  environment = event.environment;
  report_group = event.report_group;

  let error;
  try {
    console.log('starting stress tests ...');
    if (!error) {
      runStressTests(lb_dns_name, environment, deploymentId)
    }
  }
  catch (err) {
    //update the test manage with error
    var response = {
      statusCode: '400',
      errorType: 'string',
      errorMessage: `${err}`,
      status: 'FAILED'
    }
    callback(null, response);
    callback
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
        name: 'PORT',
        value: `${port}`,
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
    ]
  };
  cb.startBuild(cbParams, function (err, data) {
    if (err) {
      throw err;
    }
    console.log(`Started codebuild-stress-runner-${process.env.APP_NAME}-${process.env.ENV_TYPE}`);
  });
}
