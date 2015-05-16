#gulp-seajs-combine

gulp-seajs-combine is a plugin of gulp forked from [gulp-seajs](https://github.com/teamrun/gulp-seajs) to build seajs modules.

### Install

    npm install gulp-seajs-combine

### Usage

    var seajs = require('gulp-seajs-combine');
    
    seajs(mainId, options);

###Options

- base
- alias
- except: the modules that do not combine

###Example

    gulp.task('seajs', function(){
        return gulp.src(['./src/page/homepage/index.js'], {base: './src'})
            .pipe(seajs(null, {
                base: '../../mods/',
                alias: {
                    zepto: 'zepto/core'
                },
                except: [
                    'zepto/index'
                ]
            }))
            .pipe(uglify({
                mangle: {except: ['require']}
            }))
            .pipe(gulp.dest('./build'));
    });
    
    gulp.task('seajs', function(){
        return gulp.src(['./src/mods/zepto/index.js'], {base: './src'})
            .pipe(seajs('zepto/index', {
                base: '../../mods/',
                alias: {
                    zepto: 'zepto/core'
                }
            }))
            .pipe(uglify({
                mangle: {except: ['require']}
            }))
            .pipe(gulp.dest('./build'));
    });
    
about more knowledge about seajs modules and Naming Conventions, visit [seajs docs](http://seajs.org/docs/#docs)