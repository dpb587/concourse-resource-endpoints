exports.filterMapChecks = function (checks, filter, event) {
  return checks
    .filter(function (check) {
      return filter(check.filter, event);
    })
    .map(function (check) {
      return check.check;
    })
    ;
};

exports.filterAndNotifyChecks = function (atc, checks, callback) {  
  var http = require("http");
  var atcUrl = require("url").parse(atc.url);
  var atcHeaders = atc.headers;

  var checksWaiting = 0;
  var checksSuccess = [];
  var checksFailure = [];
  
  function sendCallback() {
    var result = {
      "status": "ok",
      "message": "resources notified",
      "checks": {
        "success": checksSuccess,
        "failure": checksFailure
      }
    };
    
    console.log('result ' + JSON.stringify(result));
    
    return callback(null, result);
  }
  
  checks.forEach(function (check) {
    var checkSplit = check.split("/");

    var req = http.request(
      {
        protocol: atcUrl.protocol,
        hostname: atcUrl.hostname,
        port: atcUrl.port,
        method: "POST",
        path: "/api/v1/pipelines/" + checkSplit[0] + "/resources/" + checkSplit[1] + "/check",
        headers: atcHeaders
      },
      function (res) {
        res.on("data", function () {});
        res.on("end", function () {
          console.log("concourse " + check + ' -> HTTP ' + res.statusCode);

          checksWaiting -= 1;

          if (200 == res.statusCode) {
            checksSuccess.push(check);
          } else {
            checksFailure.push(check);
          }
          
          if (0 == checksWaiting) {
            sendCallback();
          }
        });
      }
    );

    req.end("{}");

    checksWaiting += 1;
  });
  
  if (0 == checksWaiting) {
    return sendCallback();
  }
};
