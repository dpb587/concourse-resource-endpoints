# concourse-resource-endpoints

Some endpoints to help immediately notify [Concourse](http://concourse.ci/) about resource changes instead of relying on `check` polling. This allows for smaller worker footprints, fewer running containers, and more efficient triggering of jobs. The target environment is with [AWS Lambda](https://aws.amazon.com/lambda/) and [API Gateway](https://aws.amazon.com/api-gateway/) and allows external resource events to immediately trigger Concourse to check for new versions of the resource.

If you're interested in using this, it's best if you have already...

 * cloned this repository (and run `npm install`) to a temporary directory where you can package it up
 * created an API Gateway if you want to receive webhooks
 * created an IAM role for your lambda functions to execute in your VPC
 * loaded your `AWS_*` environment credential variables
 * set the following local variables...

        $ FLY_TARGET=default
        $ lambda_bucket=acmecorp-aws-lambda-us-east-1
        $ lambda_iam_role=arn:aws:iam::123456789012:role/aws-lambda-vpc-a1b2c3d4
        $ lambda_ec2_subnets=subnet-a1b2c3d4,subnet-b1c2d3e4,subnet-c1d2e3f4
        $ lambda_ec2_securitygroups=sg-a1b2c3d4

Rather than dynamically querying pipelines at each event invocation, the relevant pipeline resource information is pre-generated and stored in `etc/config.json`. Most types provide a `generator.sh` script which will query a Concourse target and generate it for you with minimal manual editing.


## Resource Types

A few of the resource types are supported...


### git

For the [git](https://github.com/concourse/git-resource) resources.


#### GitHub Webhook

**Receive GitHub's webhook for repository `push` events and notify Concourse.**

Generate a configuration file for your Concourse target and update `@todo` values...

    $ mkdir etc
    $ ./lib/git/generator.sh "$FLY_TARGET" > etc/config.json
    $ vim etc/config.json

Zip the directory and upload to S3...

    $ lambda_version=$( date -u +%Y%m%d%H%M%S )
    $ zip -r ../lambda-$lambda_version.zip *
    $ aws s3api put-object \
      --bucket=$lambda_bucket \
      --key=ci-$FLY_TARGET/lambda-$lambda_version.zip \
      --body "$PWD/../lambda-$lambda_version.zip"

Register the Lambda function...

    $ aws lambda create-function \
      --function-name "ci-$FLY_TARGET-git-github" \
      --runtime nodejs4.3 \
      --role $lambda_iam_role \
      --handler index.git_github_handleWebhook \
      --code S3Bucket=$lambda_bucket,S3Key=ci-$FLY_TARGET/lambda-$lambda_version.zip \
      --timeout 20 \
      --memory-size 128 \
      --vpc-config SubnetIds=$lambda_ec2_subnets,SecurityGroupIds=$lambda_ec2_securitygroups

Register an API Gateway endpoint for the created Lambda function. Update the Method Execution to include headers for `X-GitHub-Event` and `X-Hub-Signature`. Also update the Integration Request to include a Body Mapping Template for `application/json` with the following template...

    {
      "event": "$util.escapeJavaScript($input.params().header.get('X-GitHub-Event'))",
      "signature": "$util.escapeJavaScript($input.params().header.get('X-Hub-Signature'))",
      "body": "$util.escapeJavaScript($input.body)"
    }

Deploy the API. Then configure [GitHub](https://github.com/) with a webhook with the generated URL and the configured secret...

 0. Go to **Settings**
 0. Go to **Webhooks & services**
 0. Click **Add webhook**
 0. Set **Payload URL** to **https://...snip...**
 0. Set **Secret** to **@todo**
 0. Click **Add webhook**

If you need to update the configuration or function...

    $ aws lambda update-function-code \
      --function-name "ci-$FLY_TARGET-git-github" \
      --s3-bucket $lambda_bucket \
      --s3-key ci-$FLY_TARGET/lambda-$lambda_version.zip


### s3

For the [s3](https://github.com/concourse/s3-resource) and [semver[s3]](https://github.com/concourse/semver-resource) resources.

#### S3 Notification

**Receive notifications whenever objects are created in buckets and notify Concourse.**

Generate a configuration file for your Concourse target and update `@todo` values...

    $ mkdir etc
    $ ./lib/s3/generator.sh "$FLY_TARGET" > etc/config.json
    $ vim etc/config.json

Zip the directory and upload to S3...

    $ lambda_version=$( date -u +%Y%m%d%H%M%S )
    $ zip -r ../lambda-$lambda_version.zip *
    $ aws s3api put-object \
      --bucket=$lambda_bucket \
      --key=ci-$FLY_TARGET/lambda-$lambda_version.zip \
      --body "$PWD/../lambda-$lambda_version.zip"

Register the Lambda function...

    $ aws lambda create-function \
      --function-name "ci-$FLY_TARGET-s3" \
      --runtime nodejs4.3 \
      --role $lambda_iam_role \
      --handler index.s3.handleNotificationLambda \
      --code S3Bucket=$lambda_bucket,S3Key=ci-$FLY_TARGET/lambda-$lambda_version.zip \
      --timeout 20 \
      --memory-size 128 \
      --vpc-config SubnetIds=$lambda_ec2_subnets,SecurityGroupIds=$lambda_ec2_securitygroups

Add a new Event for the S3 Bucket...

 0. Expand **Events**
 0. Set **Name**
 0. Set **Events** to **ObjectCreated (All)**
 0. Set **Send To** to **Lambda function**
 0. Choose the created **Lambda function**
 0. Click **Save**

If you need to update the configuration or function...

    $ aws lambda update-function-code \
      --function-name "ci-$FLY_TARGET-s3" \
      --s3-bucket $lambda_bucket \
      --s3-key ci-$FLY_TARGET/lambda-$lambda_version.zip


## Notes

Configuration files for resources contain a reference to the ATC, resource-specific configuration, and a list of checks. Checks should be a simplified list of relevant resources with filters needed to further identify relevancy...

    {
      "atc": {
        "url": "https://ci.example.com",
        "headers": {
          "authorization": "Basic Y29uY291cnNlOmNvbmNvdXJzZQ=="
        }
      },
      "checks": [
        {
          "check": "{pipeline-name}/{resource-name}",
          "filter": {
            "uri": "https://github.com/example/test",
            "branch": "master"
          }
        }
      ]
    }

Some limitations...

 * cannot be used with ATCs configured with OAuth
 * lambda code embeds a cached list of pipeline resources. When they change, the function needs to be updated
 * the matching of `paths` and `ignore_paths` source settings of `git` resources has some edge cases


## License

[MIT License](./LICENSE)
