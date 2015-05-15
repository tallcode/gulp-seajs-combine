var fs = require('graceful-fs');
var path = require('path');
var url = require('url');
var async = require('async');
var parseCode = require('./parseCode');
var escodegen = require('escodegen');

var DEP = function(){
	var requried = {};
	var code = [];

	return {
		isRequried :function(dep){
			return !!requried[dep];
		},
		addRequrie : function(dep){
			requried[dep] = true;
		},
		addCode : function(text){
			code.push(text);
		},
		getCode : function(){
			return code.join('\n');
		}
	};
};

var buildSeajsFile = function(fileOpt, globalOpt, callback){
	async.waterfall([
		//读取代码
		function(callback){
			fs.readFile(fileOpt.src, {encoding:'utf-8'},function(err, code){
				if(!err){
					callback(false, fileOpt, globalOpt, code);
				}
				else{
					callback(err,null);
				}
			});
		},
		//分析代码依赖
		function(fileOpt, globalOpt, code, callback){
			var parsedCode = parseCode(code);
			//代码入口（匹配的ID，或者匿名），找不到就直接返回
			if(!((fileOpt.id && parsedCode.define[fileOpt.id])||parsedCode.define['__NO_ID__'])){
				callback(true, null);
			}
			else {
				if (fileOpt.id && !parsedCode.define[fileOpt.id]) {
					parsedCode.define['__NO_ID__'].setId(fileOpt.id);
					parsedCode.define[fileOpt.id] = parsedCode.define['__NO_ID__'];
				}
				callback(false, fileOpt, globalOpt, parsedCode);
			}
		},
		function(fileOpt, globalOpt, parsedCode, callback){
			var keys = Object.keys(parsedCode.require);
			async.each(keys, function(key, callback){
				//不处理http开头的依赖
				if(/^https?:\/\//.test(key) || /^\/\//.test(key)) {
					callback(false);
				}
				var depId = key;
				//处理别名
				if (globalOpt.param.alias && globalOpt.param.alias[depId]) {
					depId = globalOpt.param.alias[depId];
				}
				/*去掉JS后缀*/
				if (path.extname(depId) === '.js') {
					depId = depId.substring(0, depId.lastIndexOf('.js'));
				}
				//处理ID相对路径
				var depResolvedId;
				if (/^\./.test(depId)) {
					depResolvedId = decodeURIComponent(url.resolve(fileOpt.id||'', depId));
					if(!fileOpt.id || /^\./.test(fileOpt.id)){
						depResolvedId = './' + depResolvedId;
					}
				}
				else {
					depResolvedId = depId;
				}
				//把require添加到define中
				parsedCode.define[fileOpt.id||'__NO_ID__'].appendDep(depResolvedId);
				//与define中的名称保持一致
				//console.log(fileOpt.id+','+key+','+depId);
				parsedCode.require[key].setValue(depResolvedId);
				//分析依赖文件路径
				var depFilePath = depId;
				//处理base
				//原始ID是相对路径或者http的，不加base
				if (globalOpt.param.base && !/^\./.test(key)) {
					depFilePath = path.join(globalOpt.param.base, depFilePath);
				}
				//处理文件相对路径
				depFilePath = path.resolve(path.dirname(fileOpt.src), depFilePath);
				if (!globalOpt.dep.isRequried(depResolvedId)) {
					globalOpt.dep.addRequrie(depResolvedId);
					//带有{}的路径,里面填充的是seajs.config.vars,这是运行时依赖.不通过这个来解析路径, 保留即可
					if (!/\{[^/]+}/.test(depFilePath) && !((globalOpt.param.except) && (globalOpt.param.except.indexOf(depId)>=0))) {
						//递归处理: 读code 取依赖, 检测, 构建模块
						//排除列表
						buildSeajsFile({
							id:depResolvedId,
							src:depFilePath + '.js'
						},globalOpt, function() {
							callback(false);
						});
					}
					else{
						callback(false);
					}
				}
				else{
					callback(false);
				}
			}, function(err){
				//console.log(fileOpt.id);
				var code = escodegen.generate(parsedCode.AST);
				//console.log(code.substr(0,200));
				globalOpt.dep.addCode(code);
				callback(err);
			})
		}
	],function(){
		callback(false);
	});
};


module.exports = function (param, src, id, callback) {
	var D = DEP();
	buildSeajsFile({
		id:id,
		src:src
	}, {
		dep:D,
		param:param||{}
	}, function(){
		var code = D.getCode();
		callback(code);
	});
};

