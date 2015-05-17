var es = require('event-stream');
var buildFile = require('./buildFile');

module.exports = function(mainID, param){
	var doBuild = function(file, callback){
		var srcPath = String(file.path);
		buildFile(param, srcPath, mainID, function(data){
			file.contents = new Buffer(data);
			callback(null, file);
		});
	};
	return es.map(doBuild);
};