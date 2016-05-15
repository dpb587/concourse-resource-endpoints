var concourse = require('../utils/concourse');
var globMatch = require('../utils/glob').match;

exports.handleWebhook = function (event, context, callback) {
  var config = require('../utils/config')(event['config']);

  if ('string' == typeof config.secret) {
    var expected = require("crypto").createHmac("sha1", config.secret).update(event.body).digest("hex");
    
    if (event.signature != ("sha1=" + expected)) {
      return callback("incorrect signature: " + expected);
    }
  }
  
  if ('push' != event.event) {
    return callback(
      null,
      {
        "status": "ok",
        "message": event.event + " event ignored",
        "checks": {
          "success": [],
          "failure": []
        }
      }
    );
  }

  var payload = JSON.parse(event.body);
  
  concourse.filterAndNotifyChecks(
    config.atc,
    concourse.filterMapChecks(
      config.checks,
      exports.filterPayload,
      payload
    ),
    callback
  );
};

exports.filterPayload = function (resourceConfig, event) {
  if (event.repository.url != resourceConfig.uri) {
    return false;
  } else if (('branch' in resourceConfig) && (event.ref != ("refs/heads/" + resourceConfig.branch))) {
    return false;
  }
  
  if (resourceConfig.paths || resourceConfig.ignore_paths) {
    var commitPaths = [];

    event.commits.forEach(function (commit) {
      commitPaths.concat(commit.added.concat(commit.removed.concat(commit.modified))).forEach(function (path) {
        if (-1 == commitPaths.indexOf(path)) {
          commitPaths.push(path);
        }
      });
    });
      
    if (resourceConfig.paths) {
      var matchedCommitPaths = [];
      
      resourceConfig.paths.forEach(function (path) {
        commitPaths.forEach(function (commitPath) {
          if (globMatch(commitPath, path)) {
            if (-1 == matchedCommitPaths.indexOf(commitPath)) {
              matchedCommitPaths.push(commitPath);
            }
          }
        });
      });
      
      commitPaths = matchedCommitPaths;
    }
      
    if (resourceConfig.ignore_paths) {
      resourceConfig.ignore_paths.forEach(function (path) {
        commitPaths = commitPaths.filter(function (commitPath) {
          return !globMatch(commitPath, path);
        });
      });
    }
      
    return 0 < commitPaths.length;
  }
    
  return true;
};
