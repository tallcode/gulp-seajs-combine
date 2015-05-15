var esprima = require('esprima');
var util = require('util');

var parseCode = (function(){
	var isArray = util.isArray;
	var isObject = function(obj){
		return obj!==null && {}.toString.call(obj) === '[object Object]';
	};
	var scanAST =  (function(){
		var _callback;
		var scan = function(obj){
			if(isObject(obj)){
				//返回require
				if(obj.type==='CallExpression' && obj.callee && obj.callee.name==='require' && obj.arguments && obj.arguments.length && obj.arguments.length === 1 && obj.arguments[0].type==='Literal'){
					_callback({
						type:'require',
						key:obj.arguments[0].value,
						value:{
							getValue:function(){return obj.arguments[0].value;},
							setValue:function(value){obj.arguments[0].value = value;}
						}
					});
				}
				if(obj.type==='CallExpression' && obj.callee && obj.callee.name==='define' && obj.arguments && obj.arguments.length && obj.arguments.length <= 2 ){
					/* 补全SeaJS的define参数 */
					if(obj.arguments.length === 1 && (obj.arguments[0].type === 'FunctionExpression'||obj.arguments[0].type === 'ObjectExpression')){
						obj.arguments.unshift({
							type: 'ArrayExpression',
							elements: []
						});
						obj.arguments.unshift({
							type: 'Literal',
							value: ''
						});
					}
					if(obj.arguments.length === 2 && obj.arguments[0].type === 'ArrayExpression' && (obj.arguments[1].type === 'FunctionExpression'||obj.arguments[1].type === 'ObjectExpression')){
						obj.arguments.unshift({
							type: 'Literal',
							value: ''
						});
					}
					if(obj.arguments.length === 2 && obj.arguments[0].type === 'Literal' && (obj.arguments[1].type === 'FunctionExpression'||obj.arguments[1].type === 'ObjectExpression')){
						obj.arguments.splice(1, 0, {
							type: 'ArrayExpression',
							elements: []
						});
					}
					//返回define
					if(obj.arguments.length === 3 && obj.arguments[0].type === 'Literal' && obj.arguments[1].type === 'ArrayExpression' && (obj.arguments[2].type === 'FunctionExpression'||obj.arguments[2].type === 'ObjectExpression')){
						_callback({
							type:'define',
							key:obj.arguments[0].value,
							value:{
								getId:function(){return obj.arguments[0].value;},
								setId:function(value){obj.arguments[0].value = value;},
								appendDep:function(dep){
									obj.arguments[1].elements.push({
										type: 'Literal',
										value: dep + ''
									});
								},
								getDeps:function(){
									return obj.arguments[1].elements;
								}
							}
						});
					}
				}
				for(var k in obj){
					if(obj.hasOwnProperty(k)) {
						scan(obj[k]);
					}
				}
			}
			if(isArray(obj)){
				for(var i = 0;i<obj.length;i++){
					scan(obj[i]);
				}
			}
			return obj
		};
		return function(AST, callback){
			_callback = callback;
			scan(AST);
		}
	})();

	return function(code){
		var MAP = {require:{},define:{}};
		var AST = esprima.parse(code);
		scanAST(AST, function(result){
			if(result.type === 'define' && result.key === ''){
				result.key = '__NO_ID__'
			}
			MAP[result.type][result.key] = result.value;
		});
		return {
			AST:AST,
			require:MAP['require'],
			define:MAP['define']
		}
	};
})();

module.exports = parseCode;