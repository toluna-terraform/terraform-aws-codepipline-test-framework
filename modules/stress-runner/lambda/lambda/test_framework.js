const AWS = require('aws-sdk');
const cb = new AWS.CodeBuild({ apiVersion: '2016-10-06', region: 'us-east-1' });

let deploymentId;
let combinedRunner;
let hookId;
let lb_dns_name;
let environment;
let report_group;

exports.handler = async function (event, context, callback) {
  console.log('event', event);
  deploymentId = event.DeploymentId;
  combinedRunner = event.Combined;
  hookId = event.hookId;
  lb_dns_name = event.lb_name;
  environment = event.environment;
  report_group = event.report_group

  if (deploymentId) {
    console.log(`After stress tests are complete, this will update the CodeDeploy deployment ${deploymentId}.`);
  } else if (combinedRunner) {
    console.log(`After stress tests are complete, this will return a pass/fail to the combined runner: ${combinedRunner}`);
  } else {
    console.log('No DeploymentId found in event, this will execute the stress tests and then exit.');
  }

  // store the error so that we can update codedeploy lifecycle if there are any errors including errors from downloading files
  let error;
  try {
    console.log('starting stress tests ...');
    if (!error) {
          runStressTests(lb_dns_name, environment, deploymentId).catch(err => {
            error = err;
          });
    }
  }
  catch (e) {
    //update the test manage with error
    updateTestManager(deploymentId, combinedRunner, event, true);
  }
  if (error) {
    //update the test manage with error
    updateTestManager(deploymentId, combinedRunner, event, true);
  }
};

function runStressTests(environment, deploymentId) {
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
  };
  cb.startBuild(cbParams, function (err, data) {
    if (err) {
      throw err;
    }
    console.log(`Started codebuild-stress-runner-${process.env.APP_NAME}-${process.env.ENV_TYPE}. ${data.Location}`);
  });
}

