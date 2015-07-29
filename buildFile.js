var fs = require('graceful-fs');
var path = require('path');
var url = require('url');
var async = require('async');
var parseCode = require('./parseCode');

var DEP = function(){
	var requried = {};
	var code = [];

	return {
		isRequried: function(dep){
			return !!requried[dep];
		},
		addRequrie: function(dep){
			requried[dep] = true;
		},
		addCode: function(text){
			code.push(text);
		},
		getCode: function(){
			return code.join('\n');
		}
	};
};

var buildSeajsFile = function(fileOpt, globalOpt, callback){
	async.waterfall([
		//读取代码
		function(callback){
			fs.readFile(fileOpt.src, {encoding: 'utf-8'}, function(err, code){
				if(!err){
					callback(false, fileOpt, globalOpt, code);
				}
				else{
					callback(err, null);
				}
			});
		},
		//分析代码依赖
		function(fileOpt, globalOpt, code, callback){
			var parsedCode = parseCode(code);
			async.each(parsedCode.define, function(d, callback){
				//如果传入了ID，则覆盖匿名
				if(d.key.get() === '' && fileOpt.id){
					d.id.set(fileOpt.id);
				}
				var myId = d.id.get();
				//下面开始遍历依赖
				async.each(d.require, function(r, callback){
					var key = r.key.get();
					//---处理依赖ID名称START---
					//不处理http开头的依赖ID
					if(/^https?:\/\//.test(key) || /^\/\//.test(key)){
						callback(false);
						return;
					}
					var depId = key;
					//处理别名
					if(globalOpt.param.alias && globalOpt.param.alias[depId]){
						depId = globalOpt.param.alias[depId];
					}
					//去掉JS后缀
					depId = depId.replace(/\.js$/, '');
					//处理ID相对路径
					var depResolvedId;
					//如果依赖项ID以.开头，则需要处理成绝对路径
					if(/^\./.test(depId)){
						depResolvedId = decodeURIComponent(url.resolve(myId || '', depId));
						//但是如果父ID本身就是相对路径，那么依赖项ID还是相对路径
						if(!myId || /^\./.test(myId)){
							depResolvedId = './' + depResolvedId;
						}
					}
					else{
						depResolvedId = depId;
					}
					//修改依赖项名称
					r.value.set(depResolvedId);
					//---处理依赖ID名称END---
					//---处理依赖路径Start---
					//分析依赖文件路径
					var depFilePath = depId;
					//处理base
					//原始ID是相对路径或者http的，不加base
					if(globalOpt.param.base && !/^\./.test(key)){
						depFilePath = path.join(globalOpt.param.base, depFilePath);
					}
					//处理文件相对路径
					depFilePath = path.resolve(path.dirname(fileOpt.src), depFilePath);
					//---处理依赖路径END---
					//递归处理后续依赖
					if(!globalOpt.dep.isRequried(depResolvedId)){
						globalOpt.dep.addRequrie(depResolvedId);
						//带有{}的路径,里面填充的是seajs.config.vars,这是运行时依赖.不通过这个来解析路径, 保留即可
						if(!/\{[^/]+}/.test(depFilePath) && !((globalOpt.param.except) && (globalOpt.param.except.indexOf(depId) >= 0))){
							//递归处理: 读code 取依赖, 检测, 构建模块
							//排除列表
							buildSeajsFile({
								id: depResolvedId,
								src: depFilePath + '.js'
							}, globalOpt, function(){
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
					callback(err);
				});
			}, function(err){
				//当前文件的各项依赖都处理完毕后，生成新代码，插入代码列表
				//console.log(fileOpt.id);
				var code = parsedCode.generate();
				//console.log(code.substr(0,200));
				globalOpt.dep.addCode(code);
				callback(err);
			});
		}
	], function(){
		callback(false);
	});
};

module.exports = function(param, src, id, callback){
	var D = DEP();
	buildSeajsFile({
		id: id,
		src: src
	}, {
		dep: D,
		param: param || {}
	}, function(){
		var code = D.getCode();
		callback(code);
	});
};