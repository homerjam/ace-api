const fs = require('fs');
const gulp = require('gulp');
const livereload = require('gulp-livereload');
const opn = require('opn');
const swaggerJSDoc = require('swagger-jsdoc');

const swagger = require('./docs/swagger');
const docsConfig = require('./docs/config');

gulp.task('reload', () => {
  livereload.reload();
});

gulp.task('docs:compile', () => {
  const swaggerSpec = swaggerJSDoc(docsConfig);

  fs.writeFileSync('./docs/api.json', JSON.stringify(swaggerSpec));
});

gulp.task('docs:watch', () => {
  livereload.listen();

  gulp.watch(docsConfig.apis, ['docs:compile', 'reload']);
});

gulp.task('docs:ui', () => {
  swagger((config) => {
    opn(`http://localhost:${config.port}?url=/docs/api.json`);
  });
});

gulp.task('docs', ['docs:compile', 'docs:watch', 'docs:ui']);

