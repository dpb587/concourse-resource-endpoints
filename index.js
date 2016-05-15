var git = require('./lib/git');
var s3 = require('./lib/s3');

exports.git_github_handleWebhook = git.github.handleWebhook;
exports.s3_handleNotificationLambda = s3.handleNotificationLambda;
