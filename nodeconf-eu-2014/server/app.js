var express = require('express');
var http = require('http');
var https = require('https');
var fs = require('fs');
var bodyParser = require('body-parser');

var app = express();
module.exports = https.createServer({
  ciphers: 'AES256-SHA:AES128-SHA',
  key: fs.readFileSync('/Users/indutny/Documents/Keys/nodeconf/key.pem'),
  cert: fs.readFileSync('/Users/indutny/Documents/Keys/nodeconf/cert.pem')
}, app);

app.post('/api/post', function(req, res) {
  req.on('data', function() {
    // Who cares?
  });

  req.on('end', function() {
    res.json({
      ok: true
    });
  });
});

app.use(express.static(__dirname + '/public'));

module.exports.listen(443);
