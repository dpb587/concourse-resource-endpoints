var fs = require('fs');

module.exports = function (override) {
  if (override) {
    return override;
  }

  try {
    var path = __dirname + "/../../etc/config.json";

    fs.accessSync(path);
    
    return JSON.parse(fs.readFileSync(path));
  } catch (e) {
    return {};
  }
};
