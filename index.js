var PLUGIN_NAME = 'gulp-inject-cdn'
,   fs = require('fs')
,   gutil = require('gulp-util')
,   replace = require('gulp-replace')
,   semver = require('semver')
,   cdns = [
      require('google-cdn-data'),
      require('cdnjs-cdn-data'),
      require('jsdelivr-cdn-data')
    ]
;

function log(message) {
  gutil.log(gutil.colors.magenta(PLUGIN_NAME), message);
}

function warn(message) {
  log(gutil.colors.yellow('WARNING') + ' ' + message);
}

function err(message) {
  log(gutil.colors.red('ERROR') + ' ' + message);
}

function makeCdnUrls(deps) {
  var result = [];
  for (var package in deps.dependencies) {
    if (!deps.dependencies.hasOwnProperty(package)) continue;
    var spec = deps.dependencies[package]
    ,   base = spec.replace(/^[^0-9]*/, '')
    ,   cdn = null
    ,   max = null
    ;
    for (var j = 0; j < cdns.length; j++) {
      var info = cdns[j][package];
      if (!info) continue;
      var version = semver.maxSatisfying(info.versions, spec);
      if (!max || version && semver.compare(version, max) > 0) {
        cdn = info
        max = version || info.versions.slice().sort(semver.rcompare)[0];
      }
    }
    if (!cdn) {
      err('package "' + package + '" not found.');
      continue;
    } else if (!semver.satisfies(max, spec)) {
      warn('package "' + package + '" version "' + base + '" not in index.');
      max = base;
    }
    result.push(cdn.url(max));
  }
  return result;
}

function makeReplacement(urls, options) {
  var result = []
  ,   prefix = options && options.prefix || '<script src="'
  ,   suffix = options && options.suffix || '"></script>'
  ;
  for (var i = 0; i < urls.length; i++) {
    var url = urls[i]
    ,   m = options && options.nomin && (/^(.*)\.min(\.[^\.]+)$/).exec(url)
    ;
    if (m) {
      url = m[1] + m[2];
    }
    if (options && options.scheme && (/^\/\//).test(url)) {
      url = options.scheme + ':' + url;
    }
    result.push(prefix);
    result.push(url);
    result.push(suffix);
    result.push('\n');
  }
  result.pop();
  return result.join('');
}

module.exports = function (depfile, options) {
  var deps = JSON.parse(fs.readFileSync(depfile))
  ,   pattern = options && options.pattern ||
        (/<!-- *gulp-inject-cdn *-->/)
  ,   urls = makeCdnUrls(deps)
  ,   replacement = makeReplacement(urls, options)
  ;
  return replace(pattern, replacement);
};
