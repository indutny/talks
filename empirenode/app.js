var connect = require('connect');
var static = require('connect-static');

var app = connect();
static({
  dir: __dirname + '/dist'
}, function(err, middleware) {
  if (err)
    throw err;
  app.use(middleware);
});

module.exports = require('http').createServer(app);

if (process.env.LOCAL_SLIDES)
  module.exports.listen(8000);
