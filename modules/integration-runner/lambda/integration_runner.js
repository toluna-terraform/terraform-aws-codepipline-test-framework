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
let lb_dns_name;
let environment;
let report_group;
let error;

exports.handler = function (event, context, callback) {
  console.log('event', event);
  deploymentId = event.deploymentId;
  lb_dns_name = event.lb_name;
  environment = event.environment;
  report_group = event.report_group;

  try {
    const postmanCollections = process.env.POSTMAN_COLLECTIONS;
    if (!postmanCollections) {
      error = new Error('Env variable POSTMAN_COLLECTIONS is required');
      throw error;
    } else {
      const postmanList = JSON.parse(postmanCollections);
      const promises = [];
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

      Promise.all(promises).then(
        (async function(){
          console.log('starting postman tests ...'); 
          for (const each of postmanList) {
              try {
                let result = await runTest(each.collection, each.environment, environment, deploymentId)  
                if (result) {
                  var response = {
                    statusCode: '400',
                    errorType: 'string',
                    errorMessage: `${result}`,
                    status: 'FAILED'
                  }
                  callback(null,response);
                }
              } catch (e) {
                console.error(e);
                return e
              }
          }
          var response = {
                    statusCode: '200',
                    errorType: 'string',
                    errorMessage: '',
                    status: 'SUCCESSFUL'
                  }
          callback(null,response);
        }
        )
      )
    }
  } catch (e) {
    var response = {
                    statusCode: '400',
                    errorType: 'string',
                    errorMessage: `${e}`,
                    status: 'FAILED'
                  }
                  callback(null,response);
    throw e;
  }
};

async function uploadReports(environment, deploymentId) {
  let bucket_env_name = environment;
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
    console.log(`Started publishing reports.`);
  });

}

async function downloadFileFromBucket(env_name, key) {
  
    return await new Promise((resolve, reject) => {
    setTimeout(function() {
  
  let bucket_env_name = env_name;
  // Stripping relative path off of key.
  key = path.basename(key);
  const filename = `${tmpDir}${sep}${key}`;
  key = `${bucket_env_name}/${key}`;
  console.log(`started download for ${key} from s3 bucket`);

  let data;
   s3.getObject({
      Bucket: process.env.S3_BUCKET,
      Key: key
    },function (err, data) {
        if (err){
          reject(err)
        }
        fs.writeFile(filename, data.Body.toString());
        console.log(`downloaded ${filename}`);
        resolve(filename);  
    })
    },1000);
  });
  
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
           reject("collection run encountered errors or test failures");
        }
      })
      .on('done', function (err, args) {
        if (err) {
          console.log(err);
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
      reporters: ['junit','htmlextra'],
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
        junit: {
          export: `/tmp/${deploymentId}/report.xml`,
        }
      },
      abortOnFailure: false,
      insecure: true,
      envVar: generateEnvVars()
    }, environment, deploymentId);
    console.log('collection run complete!');
    uploadReports(environment,deploymentId);
    if (newmanRunFailed) {
      console.log(`newManFaild::::${newmanRunFailed}`)
      throw new Error('collection run encountered errors or test failures');
    }
  } catch (err) {
    console.log(`ERROR:::${err}`);
    return Error(err);
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
