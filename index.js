var es = require('event-stream');
var buildTool = require('./build-file');

module.exports = function (mainID, param) {
	console
	var doBuild = function (file, callback) {
		/*File Path*/
		var srcPath = String(file.path);
		/*Overwrite*/
		file.contents = new Buffer(buildTool(param, srcPath, mainID));
		/*Next*/
		callback(null, file);
	};
	return es.map(doBuild);
};

