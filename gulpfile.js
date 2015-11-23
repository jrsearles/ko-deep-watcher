var gulp = require("gulp");
var mocha = require("gulp-mocha");
var rename = require("gulp-rename");
var uglify = require("gulp-uglify");

gulp.task("test", function () {
	return gulp.src("./test/**/*.js")
		.pipe(mocha());
});

gulp.task("build", function () {
	return gulp.src("./index.js")
		.pipe(rename("ko-deep-watcher.js"))
		.pipe(gulp.dest("./dist/"))
		
		.pipe(uglify())
		.pipe(rename("ko-deep-watcher.min.js"))
		.pipe(gulp.dest("./dist/"));
});

gulp.task("default", ["test", "build"]);