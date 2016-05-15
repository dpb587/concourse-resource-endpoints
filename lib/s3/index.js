var concourse = require('../utils/concourse');
var globMatch = require('../utils/glob').match;

exports.handleNotificationLambda = function (event, context, callback) {
  var config = require('../utils/config')(event['config']);

  concourse.filterAndNotifyChecks(
    config.atc,
    concourse.filterMapChecks(
      config.checks,
      exports.filterEvent,
      {
        bucket: event.Records[0].s3.bucket.name,
        key: decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '))
      }
    ),
    callback
  );
};

exports.filterEvent = function (resourceConfig, event) {
  if (event.bucket != resourceConfig.bucket) {
    // console.log("bucket mismatch: expected '" + resourceConfig.bucket + "', actual '" + event.bucket + "'");
    
    return false;
  } else if (!resourceConfig.path) {
    // console.log("key mismatch: expected '" + resourceConfig.path + "', actual '" + event.key + "'");
    
    return true;
  }
  
  return globMatch(event.key, resourceConfig.path);
};
