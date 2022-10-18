const AWS = require('aws-sdk');
const Consul = require('consul');
const cd = new AWS.CodeDeploy({ apiVersion: '2014-10-06', region: 'us-east-1' });
const cb = new AWS.CodeBuild({ apiVersion: '2016-10-06', region: 'us-east-1' });
const elbv2 = new AWS.ELBv2({ apiVersion: '2015-12-01' });
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
const apigw = new AWS.APIGateway({ apiVersion: '2015-07-09' });
const ssm = new AWS.SSM({ apiVersion: '2014-11-06', region: 'us-east-1' });

let deploymentId;
let lifecycleEventHookExecutionId;
let integration_report_group_arn;
let stress_report_group_arn;
let runIntegrationTests;
let runStressTests;
let deploymentType;
let app_config = {};
exports.handler = function (event, context, callback) {
  console.log('event', event);
  if (event.hasOwnProperty("DeploymentId")) {
    deploymentId = event.DeploymentId;
  }
  lifecycleEventHookExecutionId = event.LifecycleEventHookExecutionId;
  const combinedRunner = event.Combined;
  let IntegResults = event.IntegResults;
  let StressResults = event.StressResults;

  if (!runIntegrationTests) {
    IntegResults = true;
  }
  if (!runStressTests) {
    StressResults = true;
  }
  if (event.UpdateReport && event.StressResults) {
    updateRunner(deploymentId, combinedRunner, lifecycleEventHookExecutionId, event, false);
  } else if (event.UpdateReport && !event.StressResults) {
    updateRunner(deploymentId, combinedRunner, lifecycleEventHookExecutionId, event, true);
  } else {
    try {
      sleep(parseInt(process.env.ALB_WAIT_TIME, 300) * 1000).then(
        getDeploymentDetails()
          .then(
            function (value) {
              getReportGroupDetails(value).then(function (reportGroups) { app_config['REPORT_GROUPS'] = reportGroups });
              getLBDetails(value).then(function (result) { console.log(`SETTING LB_NAME::::${result}`);app_config['LB_NAME'] = result });
              getConsulAddress(value).then(
                function (value) {
                  getConsulToken(value).then(
                    function (value) {
                      getConsulConfig(value.address, value.token, value.deploy_details.environment).then(
                        function (configDetails) {
                          app_config['CONFIG_DETAILS'] = configDetails;
                          console.log(app_config);
                          if (app_config['CONFIG_DETAILS'].run_integration_tests) {
                            runIntegrationTest(app_config).then(
                              function (result) {
                                result = JSON.parse(result);
                                if (result.status === 'SUCCESSFUL' && app_config['CONFIG_DETAILS'].run_stress_tests) {
                                  console.log('Integration tests passed, now starting Stress tests');
                                  runStressTest(app_config);
                                } else if (result.status === 'SUCCESSFUL' && !app_config['CONFIG_DETAILS'].run_stress_tests) {
                                  console.log(`update deploy success:::${deploymentId}, ${combinedRunner}, ${lifecycleEventHookExecutionId},${event}, false`);
                                  updateRunner(deploymentId, combinedRunner, lifecycleEventHookExecutionId, event, false);
                                } else {
                                  console.log(`update deploy fail:::${deploymentId}, ${combinedRunner}, ${lifecycleEventHookExecutionId},${event}, false`);
                                  updateRunner(deploymentId, combinedRunner, lifecycleEventHookExecutionId, event, true);
                                }
                              }
                            );

                          }
                          else if (app_config['CONFIG_DETAILS'].run_stress_tests) {
                            //  runStressTest();
                            //parse result if failed, fail deploy
                            console.log("STRESS:::::");
                          }
                        }
                      );
                    }
                  );
                }
              );
            }
          ));
    } catch (error) {
      updateRunner(deploymentId, combinedRunner, lifecycleEventHookExecutionId, event, true);
      throw error;
    }
  }
};

async function runIntegrationTest(app_config) {
  var params = {
    FunctionName: `${process.env.APP_NAME}-${process.env.ENV_TYPE}-integration-runner`,
    InvocationType: "RequestResponse",
    Payload: JSON.stringify({ deploymentId: `${deploymentId}`, environment: `${app_config['CONFIG_DETAILS'].environment}`, report_group: `${app_config['REPORT_GROUPS'].integration_report_group_arn}`, lb_name: `${app_config['LB_NAME']}` })
  };
  return await new Promise((resolve, reject) => {
    setTimeout(function () {
      lambda.invoke(params, function (err, data) {
        if (err) {
          console.log(`integration tests failed with error:${err}`);
          reject(err, err.stack);
        }// an error occurred
        else {
          console.log(data);
          resolve(data.Payload);
        }
      });
    }, 1000);
  });
}

function runStressTest(app_config) {
  var params = {
    FunctionName: `${process.env.APP_NAME}-${process.env.ENV_TYPE}-stress-runner`,
    InvocationType: "Event",
    Payload: JSON.stringify({ runIntegrationTests: runIntegrationTests, hookId: `${lifecycleEventHookExecutionId}`, deploymentId: `${deploymentId}`, environment: `${app_config['CONFIG_DETAILS'].environment}`, report_group: `${stress_report_group_arn}`, lb_name: `${app_config['LB_NAME']}`, port: "4443", trigger: `${process.env.APP_NAME}-${process.env.ENV_TYPE}-test-framework-manager` })
  };

  lambda.invoke(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });

}

async function updateRunner(deploymentId, combinedRunner, lifecycleEventHookExecutionId, event, error) {
  if (deploymentId) {
    console.log('starting to update lifecycle event hook status...');
    console.log(`Deployment Type:::${deploymentType}`);
    console.log(`Pipeline Type:::${app_config['CONFIG_DETAILS'].pipeline_type}`);
    return await new Promise((resolve, reject) => {
      setTimeout(function () {
        if (deploymentType == "ECS" || deploymentType == "SAM" && app_config['CONFIG_DETAILS'].pipeline_type == "dev") {
          const params = {
            deploymentId: deploymentId,
            lifecycleEventHookExecutionId: lifecycleEventHookExecutionId,
            status: error ? 'Failed' : 'Succeeded'
          };
          cd.putLifecycleEventHookExecutionStatus(params, function (err, data) {
            if (err) {
              console.log(err, err.stack); // an error occurred
              reject(err, err.stack);
            }
            resolve(data);
          });
        } else if (deploymentType == "SAM" && app_config['CONFIG_DETAILS'].pipeline_type != "dev") {
          if (error) {
            console.log('Updating Deploy Failed, Starting Rollback...');
            const params = {
              deploymentId: deploymentId,
              lifecycleEventHookExecutionId: lifecycleEventHookExecutionId,
              status: 'Failed'
            };
            cd.putLifecycleEventHookExecutionStatus(params, function (err, data) {
              if (err) {
                console.log(err, err.stack); // an error occurred
                reject(err, err.stack);
              }
              resolve(data);
            });
          }
          else {
          // call merge waiter function
            var params = {
              FunctionName: `${process.env.APP_NAME}-${process.env.ENV_TYPE}-merge-waiter`,
              InvocationType: "RequestResponse",
              Payload: JSON.stringify({ DeploymentId: `${deploymentId}`, LifecycleEventHookExecutionId: `${lifecycleEventHookExecutionId}`})
            };
  
            lambda.invoke(params, function (err, data) {
              if (err) {
                reject(err, err.stack);
              }// an error occurred
              else {
                console.log(data);
                resolve(data.Payload);
              }
            });
          }  
        }
      }, 1000);
    });
  } else if (combinedRunner) {
    return {
      passed: !error
    };
  } else {
    console.log('No deployment ID found in the event. Skipping update to CodeDeploy lifecycle hook...');
  }
}


async function getDeploymentDetails() {
  let lb_env_name, environment, deploy_type;
  var params = {
    deploymentId: deploymentId,
  };
  return await new Promise((resolve, reject) => {
    if (deploymentId) {
      setTimeout(function () {
        cd.getDeployment(params, function (err, data) {
          if (err) {
            console.log(err, err.stack); // an error occurred
            reject(err, err.stack);
          }
          else {
            console.log(data);
            let platform = data.deploymentInfo.computePlatform;
            if (platform === "ECS") {
              deploymentType = "ECS"
              lb_env_name = data.deploymentInfo.applicationName.replace("ecs-deploy-", "");
              environment = data.deploymentInfo.applicationName.replace("ecs-deploy-", "");
              environment = environment.replace("-green", "");
              environment = environment.replace("-blue", "");

              const deploy_status = data.deploymentInfo.status;
              if (deploy_status == "Failed") {
                reject(`deploy_status = ${deploy_status}`);
              }
              resolve({ "lb_env_name": lb_env_name, "environment": environment, "deploy_type": deploymentType });
            }
            if (platform === "Lambda") {
              deploymentType = "SAM"
              environment = data.deploymentInfo.applicationName.split('-')[2];
              resolve({ "lb_env_name": `${environment}.${process.env.APP_NAME}`, "environment": environment, "deploy_type": deploymentType });
            }
          }// successful response
        });
      }, 1000);
    } else {
      reject(`deploy_status = "No deployment ID Found"`);
    }

  });
}

async function getLBDetails(deploy_details) {
  const lb_name = `${process.env.APP_NAME}-${deploy_details.lb_env_name}`;
  var elb_params = {
    Names: [
      lb_name
    ],
  };
  return await new Promise((resolve, reject) => {
    console.log(`Deployment Type::::${deploymentType}`)
    let lb_dns_name;
    if (deploymentType == "ECS") {
      elbv2.describeLoadBalancers(elb_params, function (err, data) {
        if (err) {
          console.log(err, err.stack); // an error occurred
          reject(err, err.stack);
        }
        else {
          // console.log(data);
          if (deploy_details.deploy_type == "ECS") {
            lb_dns_name = `${data.LoadBalancers[0].DNSName}:4443`;
          }
          console.log(`Setting test host to ${deploy_details.lb_dns_name}`)
          resolve(lb_dns_name);
        }// successful response
      })
    } else if (deploymentType == "SAM"){
        var params = {
        };
        apigw.getRestApis(params, function(err, data) {
          if (err) {
            console.log(err, err.stack); // an error occurred
            reject(err, err.stack);
          }
          else {
            data.items.forEach((item) => {
              console.log(`ITEM:::: ${item['name']}:::${item['id']}`)
              if (item['name'] == `${process.env.APP_NAME}-${deploy_details.environment}` ) {
                lb_dns_name = `${item['id']}.execute-api.us-east-1.amazonaws.com`
              }
            });
            console.log(`Setting test host to ${lb_dns_name}`)
            resolve(lb_dns_name);
          }
        });// successful response         // successful response
    } else {
      lb_dns_name = `${deploy_details.lb_env_name}.${process.env.DOMAIN}:443`;
      console.log(`Setting test host to ${deploy_details.lb_env_name}.${process.env.DOMAIN}:443`)
      resolve(lb_dns_name);
    }
  });
}

async function getReportGroupDetails(deploy_details) {
  var listReportParams = {

  };
  return await new Promise((resolve, reject) => {
    setTimeout(function () {
      cb.listReportGroups(listReportParams, function (err, data) {
        if (err) {
          console.log(err, err.stack); // an error occurred
          reject(err, err.stack);
        }
        else {
          var integration_report_group_arns = Object.values(data.reportGroups);
          for (const [key, name] of Object.entries(integration_report_group_arns)) {
            if (name.endsWith(`${process.env.APP_NAME}-${deploy_details.environment}-IntegrationTestReport`)) {
              console.log(`Selected Report Group ARN::::${name}`);
              integration_report_group_arn = name;
            }
          }
          var stress_report_group_arns = Object.values(data.reportGroups);
          for (const [key, name] of Object.entries(stress_report_group_arns)) {
            if (name.endsWith(`${process.env.APP_NAME}-${deploy_details.environment}-StressTestReport`)) {
              console.log(`Selected Report Group ARN::::${name}`);
              stress_report_group_arn = name;
            }
          }
          resolve({ "integration_report_group_arn": integration_report_group_arn, "stress_report_group_arn": stress_report_group_arn });
        }// successful response
      });
    }, 1000);
  });
}

async function getConsulToken(value) {
  var paramsToken = {
    Name: '/infra/consul_http_token', /* required */
    WithDecryption: true
  };
  return await new Promise((resolve, reject) => {
    setTimeout(function () {
      ssm.getParameter(paramsToken, function (err, data) {
        if (err) reject(err, err.stack); // an error occurred
        else {
          resolve({ "address": value.address, "token": data.Parameter.Value, "deploy_details": value.deploy_details });
        }
      });
    }, 1000);
  });
}

async function getConsulAddress(deploy_details) {
  var paramsAddr = {
    Name: '/infra/consul_project_id', /* required */
    WithDecryption: true
  };
  return await new Promise((resolve, reject) => {
    setTimeout(function () {
      ssm.getParameter(paramsAddr, function (err, data) {
        if (err) reject(err, err.stack); // an error occurred
        else {
          resolve({ "address": data.Parameter.Value, "deploy_details": deploy_details });
        }
      });
    }, 1000);
  });
}

async function getConsulConfig(CONSUL_ADDRESS, CONSUL_TOKEN, ENVIRONMENT) {
  const consul = new Consul({
    host: `consul-cluster-test.consul.${CONSUL_ADDRESS}.aws.hashicorp.cloud`,
    secure: true,
    port: 443,
    promisify: true,
    defaults: { token: `${CONSUL_TOKEN}` }
  });
  let configMap = {};
  return await new Promise((resolve, reject) => {
    setTimeout(function () {
      consul.kv.get(`terraform/${process.env.APP_NAME}/app-env.json`, function (err, result) {
        if (err) reject(err);
        else if (result === undefined) reject('key not found');
        let app_json = JSON.parse(result.Value);
        let selectedEnv = app_json[`${ENVIRONMENT}`];
        try {
          configMap['run_stress_tests'] = selectedEnv.run_stress_tests;
        } catch {
          configMap['run_stress_tests'] = false;
        }
        try {
          configMap['run_integration_tests'] = selectedEnv.run_integration_tests;
        } catch {
          configMap['run_integration_tests'] = false;
        }
        try {
          configMap['pipeline_type'] = selectedEnv.pipeline_type;
        } catch {
          configMap['pipeline_type'] = 'dev';
        }
        configMap['environment'] = ENVIRONMENT;
        resolve(configMap);
      });
    }, 1000);
  });
}


function sleep(ms) {
  console.log('started sleep timer');
  return new Promise(resolve => setTimeout(args => {
    console.log('ended sleep timer');
    resolve();
  }, ms));
}
