var es = require('event-stream');
var buildFile = require('./buildFile');

module.exports = function(mainID, param){
	var doBuild = function(file, callback){
		/*File Path*/
		var srcPath = String(file.path);
		buildFile(param, srcPath, mainID, function(data){
			/*Overwrite*/
			file.contents = new Buffer(data);
			/*Next*/
			callback(null, file);
		});
	};
	return es.map(doBuild);
};