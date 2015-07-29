var esprima = require('esprima');
var escodegen = require('escodegen');
var util = require('util');

var parseCode = (function(){
	var isArray = util.isArray;
	var isObject = function(obj){
		return obj !== null && {}.toString.call(obj) === '[object Object]';
	};
	var foreach = function(obj, callback){
		if(isArray(obj)){
			for(var i = 0; i < obj.length; i++){
				callback(i, obj[i]);
			}
		}
		else if(isObject(obj)){
			for(var k in obj){
				if(obj.hasOwnProperty(k)){
					callback(k, obj[k]);
				}
			}
		}
	};
	//检查数组有效
	var checkArray = function(obj){
		if(obj && isArray(obj)){
			return obj.length;
		}
		else{
			return 0;
		}
	};
	//检查define工厂是不是函数
	var isDefineFactoryFunction = function(expression){
		return (expression.type === 'FunctionExpression' && checkArray(expression.params) && expression.params[0].name === 'require' && expression.body);
	};
	//检查define工厂是不是对象
	var isDefineFactoryObject = function(expression){
		return (expression.type === 'ObjectExpression');
	};
	//检查define工厂有效
	var isDefineFactory = function(expression){
		return isDefineFactoryFunction(expression) || isDefineFactoryObject(expression);
	};
	//转换依赖数组语法结构内容为普通字符串数组
	var depToArray = function(deps){
		var result = [];
		foreach(deps, function(i, value){
			result.push(value.value);
		});
		return result;
	};
	//扫描全部依赖
	var scanRequire = function(obj){
		var result = [];
		var keys = {};
		var scan = function(obj){
			if(isObject(obj)){
				//扫描到require
				if(obj.type === 'CallExpression' && obj.callee && obj.callee.name === 'require' && checkArray(obj.arguments) === 1 && obj.arguments[0].type === 'Literal'){
					var key = obj.arguments[0].value;
					//去重
					if(key && (!keys[key])){
						keys[key] = true;
						result.push({
							//只读
							key: {
								get: function(){
									return key;
								}
							},
							value: {
								get: function(){
									return obj.arguments[0].value;
								},
								set: function(value){
									obj.arguments[0].value = value;
								}
							}
						});
					}
				}
			}
			foreach(obj, function(key, value){
				scan(value);
			});
			return obj
		};
		scan(obj);
		return result;
	};
	//扫描define
	var scanDefine = function(obj){
		var result = [];
		var scan = function(obj){
			//扫描到define
			if(isObject(obj)){
				if(obj.type === 'CallExpression' && obj.callee && obj.callee.name === 'define' && obj.arguments && obj.arguments.length && obj.arguments.length <= 2){
					//补全SeaJS的define参数
					//define(function(){});
					if(checkArray(obj.arguments) === 1 && isDefineFactory(obj.arguments[0])){
						obj.arguments.unshift({
							type: 'ArrayExpression',
							elements: []
						});
						obj.arguments.unshift({
							type: 'Literal',
							value: ''
						});
					}
					//define([],function(){});
					if(checkArray(obj.arguments) === 2 && obj.arguments[0].type === 'ArrayExpression' && isDefineFactory(obj.arguments[1])){
						obj.arguments.unshift({
							type: 'Literal',
							value: ''
						});
					}
					//define(id,function(){});
					if(checkArray(obj.arguments) === 2 && obj.arguments[0].type === 'Literal' && isDefineFactory(obj.arguments[1])){
						obj.arguments.splice(1, 0, {
							type: 'ArrayExpression',
							elements: []
						});
					}
					//返回define
					if(checkArray(obj.arguments) === 3 && obj.arguments[0].type === 'Literal' && obj.arguments[1].type === 'ArrayExpression' && isDefineFactory(obj.arguments[2])){
						var require = {};
						//如果工厂是函数，继续扫描里面的require
						if(isDefineFactoryFunction(obj.arguments[2])){
							//扫描require
							require = scanRequire(obj.arguments[2]);
							//生成插入依赖的方法
							var append = function(depId){
								var dep = {
									type: 'Literal',
									value: depId + ''
								};
								obj.arguments[1].elements.push(dep);
								//返回修改插入对象的方法
								return {
									value: {
										set: function(value){
											dep.value = value;
										},
										get: function(){
											return dep.value;
										}
									}
								}
							};
							//遍历添加依赖，并绑定依赖名，在修改require名称的同时，也修改define中的名称
							foreach(require, function(i, obj){
								var dep = append(obj.value.get());
								var objValueSet = obj.value.set;
								var depValueSet = dep.value.set;
								obj.value.set = function(value){
									objValueSet(value);
									depValueSet(value);
								};
							});
						}
						var key = obj.arguments[0].value;
						result.push({
							//只读
							key: {
								get: function(){
									return key;
								}
							},
							id: {
								get: function(){
									return obj.arguments[0].value;
								},
								set: function(value){
									obj.arguments[0].value = value;
								}
							},
							dep: {
								get: function(){
									return depToArray(obj.arguments[1].elements);
								}
							},
							require: require
						});
					}
				}
			}
			foreach(obj, function(key, value){
				scan(value);
			});
			return obj;
		};
		scan(obj);
		return result;
	};
	//扫描语法树就是先开始扫描define
	var scanAST = function(AST){
		return scanDefine(AST);
	};

	return function(code){
		//生成语法树
		var AST = esprima.parse(code);
		return {
			define: scanAST(AST),
			generate: function(){
				return escodegen.generate(AST);
			}
		}
	};
})();

module.exports = parseCode;