const AWS = require('aws-sdk');
const Consul = require('consul');
const cd = new AWS.CodeDeploy({ apiVersion: '2014-10-06', region: 'us-east-1' });
const cb = new AWS.CodeBuild({ apiVersion: '2016-10-06', region: 'us-east-1' });
const elbv2 = new AWS.ELBv2({ apiVersion: '2015-12-01' });
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
const ssm = new AWS.SSM({apiVersion: '2014-11-06',region: 'us-east-1'});

let lb_dns_name;
let integration_report_group_arn;
let stress_report_group_arn;
let environment;
let lb_env_name;
let runIntegrationTests;
let runStressTests;
let branch;
let repo;
exports.handler = async function (event, context, callback) {
  console.log('event', event);
  const deploymentId = event.DeploymentId;
  const lifecycleEventHookExecutionId = event.lifecycleEventHookExecutionId;
  const combinedRunner = event.Combined;
  const IntegResults = event.IntegResults;
  const StressResults = event.StressResults;

  app_configuration = getConsulConfig();
  runIntegrationTests = app_configuration.runIntegrationTests
  runStressTests = app_configuration.runStressTests
  branch = app_configuration.branch;
  repo = app_configuration.repo;
  if (!runIntegrationTests) {
    IntegResults = true
  }
  if (!runStressTests) {
    StressResults = true
  }
  if (event.UpdateReport) {
    if (IntegResults && StressResults) {
      await updateRunner(deploymentId, combinedRunner, event, false);
    }
    else {
      await updateRunner(deploymentId, combinedRunner, event, true);
    }
  } else {
    if (IntegResults && StressResults) {
      if (deploymentId) {
        console.log(`After tests are complete, this will update the CodeDeploy deployment ${deploymentId}.`);
      } else if (combinedRunner) {
        console.log(`After tests are complete, this will return a pass/fail to the combined runner: ${combinedRunner}`);
      } else {
        console.log('No DeploymentId found in event, this will execute the tests and then exit.');
      }
    }

    // Workaround for CodeDeploy bug.
    // Give the ALB 10 seconds to make sure the test TG has switched to the new code.

    const timer = sleep(parseInt(process.env.ALB_WAIT_TIME) * 1000);

    // store the error so that we can update codedeploy lifecycle if there are any errors including errors from downloading files
    let error;
    try {
      var params = {
        deploymentId: deploymentId,
        lifecycleEventHookExecutionId: lifecycleEventHookExecutionId /* required */
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
        }
      }).promise();
      lb_dns_name = `${lb_data.LoadBalancers[0].DNSName}`;
      lb_dns_name = lb_dns_name.concat(":4443");
      var listReportParams = {

      };
      let reportGroup = await cb.listReportGroups(listReportParams, function (err, data) {
        if (err) {
          console.log(err, err.stack); // an error occurred
        }
        else {
          console.log(data);
        }
      }).promise();
      var integration_report_group_arns = Object.values(reportGroup.reportGroups);
      for (const [key, value] of Object.entries(integration_report_group_arns)) {
        if (value.endsWith(`${environment}-IntegrationTestReport`)) {
          console.log(`Selected Report Group ARN::::${value}`);
          integration_report_group_arn = value;
        }
      }
      var stress_report_group_arns = Object.values(reportGroup.reportGroups);
      for (const [key, value] of Object.entries(stress_report_group_arns)) {
        if (value.endsWith(`${environment}-StressTestReport`)) {
          console.log(`Selected Report Group ARN::::${value}`);
          stress_report_group_arn = value;
        }
      }
      await Promise.all(promises);

      console.log('starting executing tests ...');
      if (!error) {
        if (runIntegrationTests) {
          runIntegrationTest()
          //parse result if failed, fail deploy
        } 
        if (runStressTests) {
          runStressTest()
          //parse result if failed, fail deploy
        }

      }

    } catch (e) {
      await updateRunner(deploymentId, combinedRunner, event, true);
      throw e;
    }
    if (error) throw error; // Cause the lambda to "fail"
  }
}

function runIntegrationTest() {
  var params = {
    FunctionName: `${process.env.APP_NAME}-${process.env.ENV_TYPE}-integration-runner"`,
    InvocationType: "RequestResponse",
    Payload: JSON.stringify({ runStressTest: runStressTests ,hookId: `${lifecycleEventHookExecutionId}`, deploymentId: `${deploymentId}`, report_group: `${integration_report_group_arn}`, lb_name: `${lb_dns_name.concat(":4443")}` })
  };
  lambda.invoke(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}

function runStressTest() {
  var params = {
    FunctionName: `${process.env.APP_NAME}-${process.env.ENV_TYPE}-stress-runner"`,
    InvocationType: "Event",
    Payload: JSON.stringify({ runIntegrationTests: runIntegrationTests ,hookId: `${lifecycleEventHookExecutionId}`, deploymentId: `${deploymentId}`,repo: `${repo}`, branch: `${branch}`, report_group: `${stress_report_group_arn}`, lb_name: `${lb_dns_name}` })
  };
  lambda.invoke(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}

async function updateRunner(deploymentId, combinedRunner, event, error) {
  if (deploymentId) {
    console.log('starting to update CodeDeploy lifecycle event hook status...');
    const params = {
      deploymentId: deploymentId,
      lifecycleEventHookExecutionId: lifecycleEventHookExecutionId,
      status: error ? 'Failed' : 'Succeeded'
    };
    try {
      const data = await cd.putLifecycleEventHookExecutionStatus(params).promise();
      console.log(data);
    } catch (err) {
      console.log(err, err.stack);
      throw err;
    }
  } else if (combinedRunner) {
    return {
      passed: !error
    };
  } else {
    console.log('No deployment ID found in the event. Skipping update to CodeDeploy lifecycle hook...');
  }
}

function getConsulConfig(){
  let CONSUL_ADDRESS;
  let CONSUL_TOKEN;
  let configMap = {};
  var params = {
    Name: '/infra/consul_http_token', /* required */
    WithDecryption: true
  };
  CONSUL_TOKEN = ssm.getParameter(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else    {
      response = JSON.parse(data)
      return data.Parameter.Value
    } 
  });
  var params = {
    Name: '/infra/consul_project_id', /* required */
    WithDecryption: true
  };
  CONSUL_ADDRESS = ssm.getParameter(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else    {
      response = JSON.parse(data)
      return data.Parameter.Value
    } 
  });

  const consul = new Consul({
    host: `consul-cluster-test.consul.${CONSUL_ADDRESS}.aws.hashicorp.cloud`,
    secure: true,
    port: 443,
    promisify: true,
    defaults : { token: `${CONSUL_TOKEN}` }
  });
  consul.kv.get('terraform/poc-ecs-dotnet/app-env.json', function(err, result) {
    if (err) throw err;
    if (result === undefined) throw new Error('key not found');
    app_json = JSON.parse(result.Value)
    
    if (app_json[`${process.env.ENV_NAME}`].run_stress_tests) {
      configMap['run_stress_tests'] = app_json[`${process.env.ENV_NAME}`].run_stress_tests
    } else {
      configMap['run_stress_tests'] = false
    }
    if (app_json[`${process.env.ENV_NAME}`].run_integration_tests) {
      configMap['run_integration_tests'] = app_json[`${process.env.ENV_NAME}`].run_integration_tests
    } else {
      configMap['run_integration_tests'] = false
    }
    configMap['branch'] = app_json[`${process.env.ENV_NAME}`].pipeline_branch
    configMap['repo'] = app_json[`${process.env.ENV_NAME}`].pipeline_repo
  });
  return configMap;
}


function sleep(ms) {
  console.log('started sleep timer');
  return new Promise(resolve => setTimeout(args => {
    console.log('ended sleep timer');
    resolve();
  }, ms));
}
