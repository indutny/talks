// Require Node modules in the browser thanks to Browserify: http://browserify.org
var bespoke = require('bespoke'),
    voltaire = require('bespoke-theme-voltaire'),
    keys = require('bespoke-keys'),
    touch = require('bespoke-touch'),
    bullets = require('bespoke-bullets'),
    scale = require('bespoke-scale'),
    hash = require('bespoke-hash'),
    progress = require('bespoke-progress');

// Bespoke.js
bespoke.from('article', [
  voltaire(),
  keys(),
  touch(),
  bullets('li, .bullet'),
  scale(),
  hash(),
  progress()
]);

// Prism syntax highlighting
// This is actually loaded from "bower_components" thanks to
// debowerify: https://github.com/eugeneware/debowerify
require('prism');
