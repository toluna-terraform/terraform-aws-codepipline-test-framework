const AWS = require('aws-sdk');
const cd = new AWS.CodeDeploy({ apiVersion: '2014-10-06', region: 'us-east-1' });
const cb = new AWS.CodeBuild({ apiVersion: '2016-10-06', region: 'us-east-1' });
const elbv2 = new AWS.ELBv2({ apiVersion: '2015-12-01' });

let lb_dns_name;
let report_group_arn;
let environment;
let lb_env_name;

exports.handler = async function (event, context, callback) {
  console.log('event', event);
  const deploymentId = event.DeploymentId;
  const combinedRunner = event.Combined;

  // at end complete tests
  if (deploymentId) {
    console.log(`After stress tests are complete, this will update the CodeDeploy deployment ${deploymentId}.`);
  } else if (combinedRunner) {
    console.log(`After stress tests are complete, this will return a pass/fail to the combined runner: ${combinedRunner}`);
  } else {
    console.log('No DeploymentId found in event, this will execute the stress tests and then exit.');
  }

  // Workaround for CodeDeploy bug.
  // Give the ALB 10 seconds to make sure the test TG has switched to the new code.

  const timer = sleep(parseInt(process.env.ALB_WAIT_TIME) * 1000);

  // store the error so that we can update codedeploy lifecycle if there are any errors including errors from downloading files
  let error;
  try {
    var params = {
      deploymentId: deploymentId /* required */
    };
    let env_name = await cd.getDeployment(params, function (err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
      }
      else {
        console.log(data);
      }// successful response
    }).promise();
    if (env_name.deploymentInfo.deploymentConfigName.includes('CodeDeployDefault.ECS')) {
      lb_env_name = env_name.deploymentInfo.applicationName.replace("ecs-deploy-", "");
      environment = env_name.deploymentInfo.applicationName.replace("ecs-deploy-", "");
      environment = environment.replace("-green", "");
      environment = environment.replace("-blue", "");
    };
    if (env_name.deploymentInfo.deploymentConfigName.includes('CodeDeployDefault.Lambda')) {
      environment = env_name.deploymentInfo.applicationName.split("-")[1];
    };
    const deploy_status = env_name.deploymentInfo.status;

    if (deploy_status == "Failed") {
      return callback(null);
    }
    const lb_name = `${process.env.APP_NAME}-${lb_env_name}`
    var elb_params = {
      Names: [
        lb_name
      ],
    };
    let lb_data = await elbv2.describeLoadBalancers(elb_params, function (err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
      }
      else {
        console.log(data);
      }// successful response
    }).promise();
    lb_dns_name = `${lb_data.LoadBalancers[0].DNSName}`;
    var listReportParams = {

    };
    let reportGroup = await cb.listReportGroups(listReportParams, function (err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
      }
      else {
        console.log(data);
      }// successful response
    }).promise();
    var report_group_arns = Object.values(reportGroup.reportGroups);
    for (const [key, value] of Object.entries(report_group_arns)) {
      if (value.endsWith(`${environment}-StressTestReport`)) {
        console.log(`Selected Report Group ARN::::${value}`);
        report_group_arn = value;
      }
    }
    await Promise.all(promises);

    console.log('starting stress tests ...');
    if (!error) {
      // no need to run tests if files weren't downloaded correctly
      for (const each of postmanList) {
        if (!error) {
          // don't run later collections if previous one errored out
          runStressTests(lb_dns_name, environment, deploymentId).catch(err => {
            error = err;
          });
        }
      }
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
        value: `${report_group_arn}`,
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

    ],
  };
  cb.startBuild(cbParams, function (err, data) {
    if (err) {
      throw err;
    }
    console.log(`Started codebuild-stress-runner-${process.env.APP_NAME}-${process.env.ENV_TYPE}. ${data.Location}`);
  });
}

function sleep(ms) {
  console.log('started sleep timer');
  return new Promise(resolve => setTimeout(args => {
    console.log('ended sleep timer');
    resolve();
  }, ms));
}
