var minimatch = require('minimatch');

exports.match = function (path, glob) {
  var v = false;

  if (-1 < glob.indexOf('*')) {
    v = minimatch(path, glob);
  } else {
    v = -1 < path.indexOf(glob);
  }
  
  if (!v) {
    // console.log("glob mismatch: expected '" + glob + "', actual '" + path + "'");
  }
  
  return v;
};
