const fetch = require('node-fetch')
const fs = require('fs').promises
const filesys = require('fs')
const os = require('os')
const { sep } = require('path')
const newman = require('newman')
const AWS = require('aws-sdk')
const path = require('path')
const codedeploy = new AWS.CodeDeploy({ apiVersion: '2014-10-06', region: 'us-east-1' })
const s3 = new AWS.S3({ apiVersion: '2014-10-06', region: 'us-east-1' })
const cd = new AWS.CodeDeploy({ apiVersion: '2014-10-06', region: 'us-east-1' })
const tmpDir = process.env.TMP_DIR || os.tmpdir()

exports.handler = async function (event, context) {
  console.log('event', event)
  const deploymentId = event.DeploymentId
  const combinedRunner = event.Combined
  if (deploymentId) {
    console.log(`After postman tests are complete, this will update the CodeDeploy deployment ${deploymentId}.`)
  } else if (combinedRunner) {
    console.log(`After postman tests are complete, this will return a pass/fail to the combined runner: ${combinedRunner}`)
  } else {
    console.log('No DeploymentId found in event, this will execute the postman tests and then exit.')
  }

  // Workaround for CodeDeploy bug.
  // Give the ALB 10 seconds to make sure the test TG has switched to the new code.
  
  const timer = sleep(parseInt(process.env.ALB_WAIT_TIME) * 1000)
  
  // store the error so that we can update codedeploy lifecycle if there are any errors including errors from downloading files
  let error
  try {
    const postmanCollections = process.env.POSTMAN_COLLECTIONS
    if (!postmanCollections) {
      error = new Error('Env variable POSTMAN_COLLECTIONS is required')
    } else {
      const postmanList = JSON.parse(postmanCollections)
      const promises = [timer]
      var params = {
    deploymentId: deploymentId /* required */
  };
    let env_name = await cd.getDeployment(params, function(err, data) {
    if (err) 
      { 
        console.log(err, err.stack); // an error occurred
      }
      else {
        console.log(data)
      }// successful response
      }).promise()
      const environment = env_name.deploymentInfo.applicationName.split("-").pop();
      for (const each of postmanList) {
        if (each.collection.includes('.json')) {
          promises.push(downloadFileFromBucket(environment,each.collection))
          each.collection = `${tmpDir}${sep}${path.basename(each.collection)}`
        } 
        if (each.environment) { // environment can be null
          if (each.environment.includes('.json')) {
            promises.push(downloadFileFromBucket(environment,each.environment))
            each.environment = `${tmpDir}${sep}${path.basename(each.environment)}`
          } 
        }
      }
      
      // make sure all files are downloaded and we wait for 10 seconds before executing postman tests
      await Promise.all(promises)

      console.log('starting postman tests ...')
      if (!error) {
        // no need to run tests if files weren't downloaded correctly
        for (const each of postmanList) {
          if (!error) {
            // don't run later collections if previous one errored out
            await runTest(each.collection, each.environment,environment,deploymentId).catch(err => {
              error = err
            })
          }
        }
      }
    }
    await updateRunner(deploymentId, combinedRunner, event, error)
  } catch (e) {
    await updateRunner(deploymentId, combinedRunner, event, true)
    throw e
  }
  if (error) throw error // Cause the lambda to "fail"
}

const uploadFile = (fileName,environment,deploymentId) => {
    // Read content from the file
    const fileContent = filesys.readFileSync(fileName);

    // Setting up S3 upload parameters
    const params = {
        Bucket: process.env.S3_BUCKET,
        Key: `reports/${environment}/report_${deploymentId}.html`, // File name you want to save as in S3
        Body: fileContent
    };

    // Uploading files to the bucket
    s3.upload(params, function(err, data) {
        if (err) {
            throw err;
        }
        console.log(`File uploaded successfully. ${data.Location}`);
    });
};

async function downloadFileFromBucket (env_name,key) {
  
  // Stripping relative path off of key.
  key = path.basename(key)
  const filename = `${tmpDir}${sep}${key}`
  key = `${env_name}/${key}`
  console.log(`env key is ::${key}`)
  console.log(`started download for ${key} from s3 bucket`)

  let data
  try {
    data = await s3.getObject({
      Bucket: process.env.S3_BUCKET,
      Key: key
    }).promise()
  } catch (err) {
    console.error(`error trying to get object from bucket: ${err}`)
    throw err
  }

  await fs.writeFile(filename, data.Body.toString())
  console.log(`downloaded ${filename}`)
  return filename
}

function newmanRun (options) {
  return new Promise((resolve, reject) => {
    newman.run(options, err => {
      err ? reject(err) : resolve()
    })
  })
}

async function runTest (postmanCollection, postmanEnvironment,environment,deploymentId) {
  try {
    console.log(`running postman test for ${postmanCollection}`)
    await newmanRun({
      collection: postmanCollection,
      environment: postmanEnvironment,
      reporters: ['cli','htmlextra'],
      reporter: {
        htmlextra: {
            export: '/tmp/report.html',
            browserTitle: `${environment} Tests report`,
            title: `${environment} Tests report`,
            titleSize: 4,
            showEnvironmentData: true,
            showGlobalData: true,
            skipSensitiveData: true,
            showMarkdownLinks: true,
            timezone: "Israel",
            }
        },
      abortOnFailure: true,
      envVar: generateEnvVars()
    })
    console.log('collection run complete!')
    uploadFile('/tmp/report.html',environment,deploymentId);
  } catch (err) {
    console.log(err)
    throw err
  }
}

async function updateRunner (deploymentId, combinedRunner, event, error) {
  if (deploymentId) {
    console.log('starting to update CodeDeploy lifecycle event hook status...')
    const params = {
      deploymentId: deploymentId,
      lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
      status: error ? 'Failed' : 'Succeeded'
    }
    try {
      const data = await codedeploy.putLifecycleEventHookExecutionStatus(params).promise()
      console.log(data)
    } catch (err) {
      console.log(err, err.stack)
      throw err
    }
  } else if (combinedRunner) {
    return {
      passed: !error
    }
  } else {
    console.log('No deployment ID found in the event. Skipping update to CodeDeploy lifecycle hook...')
  }
}

function generateEnvVars () {
  const envVarsArray = []
  const parsedVars = JSON.parse(process.env.TEST_ENV_VAR_OVERRIDES)
  if (Object.keys(parsedVars).length === 0) return envVarsArray
  for (const [key, value] of Object.entries(parsedVars)) {
    console.log(`[Env Override] Setting ${key} as ${value}`)
    envVarsArray.push({ key, value })
  }
  return envVarsArray
}

function sleep (ms) {
  console.log('started sleep timer')
  return new Promise(resolve => setTimeout(args => {
    console.log('ended sleep timer')
    resolve()
  }, ms))
}

