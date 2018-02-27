var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var async = require('async');
var mysql = require('mysql');

router.baseURL = '/Prss';

router.get('/', function(req, res) {
   var isUserAdmin = req.session.isAdmin();
   var email = req.query.email;
   var emptyArr = [];
   var cnn = req.cnn;

   if (isUserAdmin) {
     if (email) {
       cnn.query('select email from Person',
       function(err, result) {
         if (err) {
           cnn.destroy();
           res.status(500).json("Failed query");
         }
         else{
            for (var x = 0; x < result.length; x++) {
               if (result[x].email.indexOf(email) >= 0)
                  email = result[x].email;
            }
            cnn.query('select id, email from Person where email LIKE ?',
             [email], function(err, result) {
               if (err) {
                  cnn.destroy();
                  res.status(500).json("Failed query");
               }
               else{
                  res.status(200).json(result);
                  cnn & cnn.destroy();
               }
            });
         }
       });
     }
     else{
        cnn.query('select id, email from Person', function(err, result) {
         if (err) {
           cnn.destroy();
           res.status(500).json("Failed query");
         }
         else{
            res.status(200).json(result);
            cnn & cnn.destroy();
         }
       });
     }
   }
   else{
      if (email && req.session.email.indexOf(email) === 0) {
         email = req.session.email;
         cnn.query('select id, email from Person where email LIKE ?', [email],
         function(err, result) {
            if (err) {
               cnn.destroy();
               res.status(500).json("Failed query");
            }
            else {
               res.status(200).json(result);
               cnn & cnn.destroy();
            }
         });
      }
      else{
         res.status(200).json(emptyArr);
         cnn & cnn.destroy();
      }
   }
});

router.post('/', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var admin = req.session && req.session.isAdmin();
   var cnn = req.cnn;

   if (admin && !body.password)
      body.password = "*";
   body.whenRegistered = new Date();

   async.waterfall([
   function(cb) {
      if (vld.check(body.lastName, Tags.missingField, "lastName", cb))
         cb(null);
   },
   function(cb) {
      if (vld.hasFields(body, ["email", "password", "role"], cb) &&
       vld.chain(body.role === 0 || admin, Tags.noPermission)
       .chain(body.termsAccepted || admin, Tags.noTerms)
       .chain(body.email && !(body.email.length === 0),
        Tags.missingField, "email")
       .chain(body.lastName && !(body.lastName.length === 0),
        Tags.missingField, "lastName")
       .chain(!(body.password.length === 0), Tags.missingField, "password")
       .check(body.role >= 0, Tags.badValue, ["role"], cb)) {
         cnn.chkQry('select * from Person where email = ?', body.email, cb);
      }
   },
   function(existingPrss, fields, cb) {  // If no duplicates, insert new Person
      if (vld.check(!existingPrss.length, Tags.dupEmail, null, cb)) {
         body.termsAccepted = body.termsAccepted ? true : false;
         cnn.chkQry('insert into Person set ?', body, cb);
      }
   },
   function(result, fields, cb) { // Return location of inserted Person
      res.location(router.baseURL + '/' + result.insertId).end();
      cb();
   }],
   function(err) {  //had error log, removed
      cnn.release();
   });
});

router.get('/:id', function(req, res) {
   var vld = req.validator;

   if (vld.checkPrsOK(Number(req.params.id))) {
      req.cnn.query('select * from Person where id = ?', [req.params.id],
      function(err, prsArr) {
         if (vld.check(prsArr.length, Tags.notFound)) {
            prsArr[0].password && delete prsArr[0].password;
            res.json(prsArr);
          }
         req.cnn.release();
      });
   }
   else {
      req.cnn.release();
   }
});

function updateHandler(req, res, err, prsArr){
  if(err)
    res.status(400).json(err);
  else
    res.status(200).end();
  req.cnn.release();
}

router.put('/:id', function(req, res) {
  var vld = req.validator;
  var body = req.body;
  var updateObject = new Object();

  if (req.session.isAdmin()) {
    req.cnn.query('UPDATE Person set ? where id = ?', [body, Number(req.params.id)],
     updateHandler(req, res));
  }
  else if (vld.checkPrsOK(Number(req.params.id)) && Object.keys(body).length) {
    async.waterfall([
    function(cb) {
       if (vld.check(!body.hasOwnProperty('email'), Tags.forbiddenField,
        "email", cb))
          cb(null);
    },
    function(cb) {
       if (vld.check(!body.hasOwnProperty('role'), Tags.badValue,
        "role", cb))
          cb(null);
    },
    function(cb) {
       if (vld.check(!body.hasOwnProperty('termsAccepted'), Tags.forbiddenField,
        "termsAccepted", cb))
          cb(null);
    },
    function(cb) {
       if (vld.check(!body.hasOwnProperty('whenRegistered'), Tags.forbiddenField,
        "whenRegistered", cb))
          cb(null);
    },
    function(cb) {
       if (body.oldPassword || body.password) {
          if (vld.chain(body.password.length,
           Tags.badValue, "password")
           .check(body.oldPassword, Tags.noOldPwd, "oldPassword", cb))
             req.cnn.chkQry('select password from Person where id = ?',
              [Number(req.params.id)], cb);
      }
      else {
         cb(null, null, null);
      }
    },
    function(existingPrss, fields, cb) {
       if (existingPrss) {
          if (vld.check(existingPrss[0].password == JSON.stringify(body.oldPassword),
           Tags.oldPwdMismatch, null, cb))
             updateObject.password = body && body.password;
      }
      else
         cb(null);
    },
    function(cb) {
       if (body.firstName)
          updateObject.firstName = body.firstName;
       if (body.lastName)
          updateObject.lastName = body.lastName;
       req.cnn.query('UPDATE Person set ? where id = ?',
        [updateObject, Number(req.params.id)], updateHandler(req, res));
    }],
    function(err) {
       req.cnn && req.cnn.release();
    });
  }
  else if (vld.checkPrsOK(Number(req.params.id))) {
     res.status(200).end();
     req.cnn.release();
  }
  else{
     res && res.status(400).end();
     req.cnn.release();
  }
});

router.delete('/:id', function(req, res) {
   var vld = req.validator;

   if (vld.checkAdmin())
      req.cnn.query('DELETE from Person where id = ?', [req.params.id],
      function (err, result) {
         if (!err && vld.check(result.affectedRows, Tags.notFound))
            res.status(200).end();
         req.cnn.release();
      });
   else {
      req.cnn.release();
   }
});

module.exports = router;
