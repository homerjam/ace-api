const gulp = require('gulp');
const apidoc = require('gulp-apidoc');

gulp.task('apidoc', (done) => {
  apidoc({
    src: './routes/',
    dest: './docs/api/',
    config: './',
  }, done);
});
