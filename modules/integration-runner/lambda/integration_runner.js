const fs = require('fs').promises;
const filesys = require('fs');
const os = require('os');
const { sep } = require('path');
const newman = require('newman');
const AWS = require('aws-sdk');
const path = require('path');
const AdmZip = require("adm-zip");
const s3 = new AWS.S3({ apiVersion: '2014-10-06', region: 'us-east-1' });
const cb = new AWS.CodeBuild({ apiVersion: '2016-10-06', region: 'us-east-1' });
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

const tmpDir = process.env.TMP_DIR || os.tmpdir();
let newmanRunFailed = false;
let test_status = "SUCCESSFUL";
let deploymentId;
let combinedRunner;
let hookId;
let lb_dns_name;
let environment;
let report_group;
let run_stress_tests;

exports.handler = function (event, context, callback) {
  console.log('event', event);
  deploymentId = event.deploymentId;
  combinedRunner = event.Combined;
  hookId = event.hookId;
  lb_dns_name = event.lb_name;
  environment = event.environment;
  report_group = event.report_group;
  run_stress_tests = event.runStressTest;

  if (deploymentId) {
    console.log(`After postman tests are complete, this will update the CodeDeploy deployment ${deploymentId}.`);
  } else if (combinedRunner) {
    console.log(`After postman tests are complete, this will return a pass/fail to the combined runner: ${combinedRunner}`);
  } else {
    console.log('No DeploymentId found in event, this will execute the postman tests and then exit.');
  }

  const timer = sleep(10000);
  // store the error so that we can update codedeploy lifecycle if there are any errors including errors from downloading files
  let error;
  try {
    const postmanCollections = process.env.POSTMAN_COLLECTIONS;
    if (!postmanCollections) {
      error = new Error('Env variable POSTMAN_COLLECTIONS is required');
      throw error;
    } else {
      const postmanList = JSON.parse(postmanCollections);
      const promises = [timer];
      //report_group_arns.forEach(item => console.log(item));
      for (const each of postmanList) {
        if (each.collection.includes('.json')) {
          promises.push(downloadFileFromBucket(environment, each.collection));
          each.collection = `${tmpDir}${sep}${path.basename(each.collection)}`;
        }
        if (each.environment) { // environment can be null
          if (each.environment.includes('.json')) {
            promises.push(downloadFileFromBucket(environment, each.environment));
            each.environment = `${tmpDir}${sep}${path.basename(each.environment)}`;
          }
        }
      }

      // make sure all files are downloaded and we wait for 10 seconds before executing postman tests
      Promise.all(promises);

      console.log('starting postman tests ...');
      if (!error) {
        // no need to run tests if files weren't downloaded correctly
        for (const each of postmanList) {
          if (!error) {
            // don't run later collections if previous one errored out
            runTest(each.collection, each.environment, environment, deploymentId).catch(err => {
              error = err;
            });
          }
        }
      }
      if (error) {
        throw error;
      }
    }
    if (!run_stress_tests) {
      updateTestManager(deploymentId, combinedRunner, event, error);
    }
  } catch (error) {
    //update the test manage with error
    console.log(error)
    updateTestManager(deploymentId, combinedRunner, event, true);
  }
};

async function uploadReports(environment, deploymentId) {
  let bucket_env_name = environment.split("-")[0];
  const zip = new AdmZip();
  const outputFile = `/tmp/${deploymentId}.zip`;
  zip.addLocalFolder(`/tmp/${deploymentId}`);
  zip.writeZip(outputFile);
  const fileContent = filesys.readFileSync(outputFile);
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: `reports/${bucket_env_name}/${deploymentId}.zip`, // File name you want to save as in S3
    Body: fileContent
  };

  // Uploading files to the bucket
  await s3.upload(params, function (err, data) {
    if (err) {
      throw err;
    }
    console.log(`File uploaded successfully. ${data.Location}`);
  });
  if (newmanRunFailed) {
    test_status = "FAILED";
  }
  const cbParams = {
    projectName: `codebuild-publish-reports-${process.env.APP_NAME}-${process.env.ENV_TYPE}`,
    privilegedModeOverride: true,
    environmentVariablesOverride: [
      {
        name: 'ENV_NAME',
        value: `${environment}`,
        type: 'PLAINTEXT'
      },
      {
        name: 'TEST_STATUS',
        value: `${test_status}`,
        type: 'PLAINTEXT'
      },
      {
        name: 'ENV_TYPE',
        value: `${process.env.ENV_TYPE}`,
        type: 'PLAINTEXT'
      },
      {
        name: 'APP_NAME',
        value: `${process.env.APP_NAME}`,
        type: 'PLAINTEXT'
      },
      {
        name: 'DESCRIPTION',
        value: `Build ${test_status} for project ${process.env.APP_NAME}-${environment}`,
        type: 'PLAINTEXT'
      },
      {
        name: 'REPORT_GROUP',
        value: `${report_group}`,
        type: 'PLAINTEXT'
      },

    ],
    sourceLocationOverride: `${process.env.S3_BUCKET}/reports/${environment}/${deploymentId}.zip`,
    sourceTypeOverride: 'S3'
  };
  await cb.startBuild(cbParams, function (err, data) {
    if (err) {
      throw err;
    }
    console.log(`File uploaded successfully. ${data.Location}`);
  });
}

async function downloadFileFromBucket(env_name, key) {
  let bucket_env_name = env_name.split("-")[0];
  // Stripping relative path off of key.
  key = path.basename(key);
  const filename = `${tmpDir}${sep}${key}`;
  key = `${bucket_env_name}/${key}`;
  console.log(`started download for ${key} from s3 bucket`);

  let data;
  try {
    data = await s3.getObject({
      Bucket: process.env.S3_BUCKET,
      Key: key
    }).promise();
  } catch (err) {
    console.error(`error trying to get object from bucket: ${err}`);
    throw err;
  }

  await fs.writeFile(filename, data.Body.toString());
  console.log(`downloaded ${filename}`);
  return filename;
}

function newmanRun(options, environment, deploymentId) {
  return new Promise((resolve, reject) => {
    newman.run(options)
      .on('beforeDone', (err, args) => {
        if (err) {
          reject(err);
        }
        else if (JSON.stringify(args.summary.error) || args.summary.run.failures.length) {
          newmanRunFailed = true;
        }
      })
      .on('done', function (err, args) {
        if (err) {
          reject(err);
        } else {
          console.log("collection done !!!");
          resolve();
        }
      });
  });
}

async function runTest(postmanCollection, postmanEnvironment, environment, deploymentId) {
  try {
    console.log(`running postman test for ${postmanCollection}`);
    await newmanRun({
      collection: postmanCollection,
      environment: postmanEnvironment,
      reporters: ['htmlextra', 'junitfull'],
      reporter: {
        htmlextra: {
          export: `/tmp/${deploymentId}/report.html`,
          browserTitle: `${process.env.APP_NAME} ${environment} Tests report`,
          title: `${process.env.APP_NAME} ${environment} Tests report`,
          titleSize: 4,
          showEnvironmentData: true,
          showGlobalData: true,
          skipSensitiveData: true,
          showMarkdownLinks: true,
          timezone: "Israel",
        },
        junitfull: {
          export: `/tmp/${deploymentId}/report.xml`,
        }
      },
      abortOnFailure: false,
      insecure: true,
      envVar: generateEnvVars()
    }, environment, deploymentId);
    console.log('collection run complete!');
    uploadReports(environment, deploymentId);
    if (newmanRunFailed) {
      throw new Error('collection run encountered errors or test failures');
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
}

function generateEnvVars() {
  const envVarsArray = [];
  const hostname = JSON.parse(`{ "host":"${lb_dns_name}"}`);
  const parsedEnvVars = JSON.parse(process.env.TEST_ENV_VAR_OVERRIDES);
  const parsedVars = Object.assign(hostname, parsedEnvVars);
  if (Object.keys(parsedVars).length === 0) return envVarsArray;
  for (const [key, value] of Object.entries(parsedVars)) {
    console.log(`[Env Override] Setting ${key} as ${value}`);
    envVarsArray.push({ key, value });
  }
  return envVarsArray;
}


function updateTestManager(error) {
  var params = {
    FunctionName: `${process.env.APP_NAME}-${process.env.ENV_TYPE}-test-framework-manager`,
    InvocationType: "Event",
    Payload: JSON.stringify({ hookId: `${hookId}`, deploymentId: `${deploymentId}`,UpdateReport: true, IntegResults: `${error}`})
  };
  lambda.invoke(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}

function sleep (ms) {
  console.log('started sleep timer');
  return new Promise(resolve => setTimeout(args => {
    console.log('ended sleep timer');
    resolve();
  }, ms));
}