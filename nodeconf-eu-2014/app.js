var connect = require('connect');
var static = require('connect-static');

var app = connect();
static({
  dir: __dirname + '/dist'
}, function(err, middleware) {
  if (err)
    throw err;
  app.use(middleware);
})

module.exports = require('spdy').createServer({
  plain: true,
  ssl: false
}, app);
