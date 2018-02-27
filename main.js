var express = require('express');
//J: used to simplify file paths, core module indicated by absence of './'
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var Session = require('./Routes/Session.js');
var Validator = require('./Routes/Validator.js');
var CnnPool = require('./Routes/CnnPool.js');
var async = require('async');
var app = express();

var argv = process.argv;

var port = (argv.indexOf("-p") > 0) ? argv[argv.length - 1] : 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());

app.use(cookieParser());

app.use(Session.router);

// Check general login.  If OK, add Validator to |req| and continue processing,
// otherwise respond immediately with 401 and noLogin error tag.
app.use(function(req, res, next) {
   console.log(req.path + " -- " + req.method);
   if (req.session || (req.method === 'POST' &&
      (req.path === '/Prss' || req.path === '/Ssns'))) {
      req.validator = new Validator(req, res);
      next();
   }
   else
      res.status(401).end();
});

app.use(CnnPool.router);

app.use('/Prss', require('./Routes/Account/Prss.js'));
app.use('/Ssns', require('./Routes/Account/Ssns.js'));
app.use('/Cnvs', require('./Routes/Conversation/Cnvs.js'));
app.use('/Msgs', require('./Routes/Conversation/Msgs.js'));

app.delete('/DB', function(req, res) {
  if (!req.session.isAdmin()) {
    res.status(403).end();
    req.cnn && req.cnn.release();
  }
  else {
   var cbs = ["Conversation", "Message", "Person"].map(function(tblName) {
      return function(cb) {
         req.cnn.query("delete from " + tblName, cb);
      };
   });

   cbs = cbs.concat(["Conversation", "Message", "Person"]
          .map(function(tblName) {
            return function(cb) {
               req.cnn.query("alter table " + tblName
                + " auto_increment = 1", cb);
            };
         }));

   // Callback to reinsert admin user
   cbs.push(function(cb) {
      req.cnn.query('INSERT INTO Person (firstName, lastName, email,' +
       ' password, whenRegistered, role) VALUES ' +
       '("Joe", "Admin", "adm@11.com","password", NOW(), 1);', cb);
   });

   // Callback to clear sessions, release connection and return result
   cbs.push(function(callback) {
      for (var session in Session.sessions)
         delete Session.sessions[session];
      callback();
   });

   async.series(cbs, function(err) {
      req.cnn.release();
      if (err)
         res.status(400).json(err);
      else
         res.status(401).end();
   });
 }

   /* Equivalent expanded code for instructional reference
      async.series([
         function(callback) {
            cnn.query('delete from Person`', callback);
         },
         function(callback) {
            cnn.query('delete from Conversation', callback);
         },
         function(callback) {
            cnn.query('delete from Message', callback);
         },
         function(callback) {
            cnn.query('alter table Perrson auto_increment = 1', callback);
         },
         function(callback) {
            cnn.query('alter table Conversation auto_increment = 1', callback);
         },
         function(callback) {
            cnn.query('alter table Message auto_increment = 1', callback);
         },
         function(callback) {
            cnn.query('INSERT INTO Person (firstName, lastName, email,' +
                ' password, whenRegistered, role) VALUES ' +
                '("Joe", "Admin", "adm@11.com","password", NOW(), 2);',
             callback);
         },
         function(callback) {
            for (var session in Session.sessions)
               delete Session.sessions[session];
            res.send();
         }
      ],
      function(err, status) {
         console.log(err);
      }
   );*/
});

// Handler of last resort.  Print a stacktrace to console and send a 500 res
app.use(function(req, res) {
   res.status(404).end();
   req.cnn.release();
});
/* DO I NEED THIS?
app.use(function(err, req, res, next) {
   res.status(400).json(err);
   req.cnn && req.cnn.release();
});
*/

app.listen(port, function () {
   console.log('App Listening on port ' + port);
});
