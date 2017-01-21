const gulp = require('gulp');
const livereload = require('gulp-livereload');
const apidoc = require('gulp-apidoc');
const serve = require('gulp-serve');
const opn = require('opn');

gulp.task('apidoc', () => {
  apidoc({
    src: './routes/',
    dest: './docs/api/',
    config: './',
  }, livereload.reload);
});

gulp.task('serve', serve({
  root: './docs/api/',
  port: 8080,
}));

gulp.task('watch', () => {
  livereload.listen();

  gulp.watch('./routes/*.js', ['apidoc']);

  opn('http://localhost:8080');
});

gulp.task('docs', ['serve', 'watch']);

