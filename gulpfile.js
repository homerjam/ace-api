const fs = require('fs');
const gulp = require('gulp');
const livereload = require('gulp-livereload');
const open = require('open');
const swaggerJSDoc = require('swagger-jsdoc');

const swagger = require('./docs/swagger');
const docsConfig = require('./docs/config');

gulp.task('reload', (done) => {
  livereload.reload();

  done();
});

gulp.task('docs:compile', (done) => {
  const swaggerSpec = swaggerJSDoc(docsConfig);

  fs.writeFileSync('./docs/api.json', JSON.stringify(swaggerSpec));

  done();
});

gulp.task('docs:watch', (done) => {
  livereload.listen();

  gulp.watch(docsConfig.apis, gulp.series('docs:compile', 'reload'));

  done();
});

gulp.task('docs:ui', (done) => {
  swagger((config) => {
    open(`http://localhost:${config.port}?url=/docs/api.json`);
  });

  done();
});

gulp.task('docs', gulp.parallel('docs:compile', 'docs:watch', 'docs:ui'));
