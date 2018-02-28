var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var async = require('async');

router.baseURL = '/Cnvs';

router.get('/:cnvId', function(req, res) {
   var vld = req.validator;

   if (vld.check(req.session, Tags.noLogin, null)) {
      req.cnn.chkQry('select * from Conversation where id = ?',
       [req.params.cnvId], function(err, cnvsArr, fields) {
         if (vld.check(!err && cnvsArr && cnvsArr.length, Tags.notFound, null))
            res.json(cnvsArr[0]);
         req.cnn.release();
      });
   }
});

router.get('/', function(req, res) {
   var vld = req.validator;

   if (vld.check(req.session, Tags.noLogin, null)) {
      req.cnn.chkQry('select * from Conversation', null,
      function(err, cnvs) {
         if (!err) {
            cnvs.forEach(function(cnvn) {
               cnvn.lastMessage = cnvn.lastMessage ?
                cnvn.lastMessage.getTime() : null;
            })
           res.json(cnvs);
         }
         req.cnn.release();
      });
  }
  else {
     req.cnn.release();
  }
});

router.post('/', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;

   async.waterfall([
   function(cb) {
     if (vld.check(Object.keys(body).length, Tags.missingField, "title", cb))
      cb(null);
   },
   function(cb) {
       for (var parameter in body) {
       vld.check(parameter && parameter.length > 0, Tags.missingField, "content", cb)
     }
     cb(null);
   },
   function(cb) {
     if (vld.chain(body.title && body.title.length < 80, Tags.badValue, "title")
      .check(body.title.length > 0, Tags.missingField, "title", cb))
      cb(null);
   },
   function(cb) {
      cnn.chkQry('select * from Conversation where title = ?', body.title, cb);
   },
   function(existingCnv, fields, cb) {
      if (vld.check(!existingCnv.length, Tags.dupTitle, null, cb)) {
         body.ownerId = req.session.id;
         cnn.chkQry("insert into Conversation set ?", body, cb);
       }
   },
   function(insRes, fields, cb) {
      res.location(router.baseURL + '/' + insRes.insertId).end();
      cb();
   }],
   function() {
      cnn.release();
   });
});

router.put('/:cnvId', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;
   var cnvId = req.params.cnvId;

   async.waterfall([
   function(cb) {
     if (vld.chain(body.title && body.title.length, Tags.badValue, "title")
        .chain(body.title && body.title.length < 80, Tags.badValue, "title")
        .check(Object.keys(body).length), Tags.missingField, null, cb)
        cb(null);
   },
   function(cb) {
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb) &&
       vld.checkPrsOK(cnvs[0].ownerId, cb))
         cnn.chkQry('select * from Conversation where id <> ? && title = ?',
          [cnvId, body.title], cb);
   },
   function(sameTtl, fields, cb) {
      if (vld.check(!sameTtl.length, Tags.dupTitle, null, cb))
         cnn.query("update Conversation set title = ? where id = ?",
          [body.title, cnvId], cb);

   },
   function(err, result, cb) {
     res.status(200).end();
     cb(err);
   }],
   function(err) {
      if (err)
         res.status(400).end();
      cnn.release();
   });
});

router.delete('/:cnvId', function(req, res) {
   var vld = req.validator;
   var cnvId = req.params.cnvId;
   var cnn = req.cnn;

   async.waterfall([
   function(cb) {
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb) &&
       vld.checkPrsOK(cnvs[0].ownerId, cb))
         cb(null);
   },
   function(cb) {
     cnn.chkQry('delete from Message where cnvId = ?', [cnvId],
      function(err, result) {
        cb(null);
      });
   },
   function(cb) {
     cnn.chkQry('delete from Conversation where id = ?', [cnvId],
      function(err, result) {
        if (!err || vld.check(result.affectedRows, Tags.notFound))
           res.status(200).end();
        cb(err)
     });
   }],
   function(err) {
      if (err) {
        console.log(err);
        res.status(400);
      }
      cnn.release();
    });
});

router.get('/:cnvId/Msgs', function(req, res) {
   var vld = req.validator;
   var cnvId = req.params.cnvId;
   var cnn = req.cnn;
   var query = 'select whenMade, email, content from Conversation c' +
    ' join Message m on m.cnvId = c.id join Person p on m.prsId = p.id where c.id = ?' +
    ' order by m.id ASC';
   var params = [cnvId];

   // And finally add a limit clause and parameter if indicated.
   if (req.query.num) {
      query += ' limit ?';
      params.push(req.query.num);
   }
   async.waterfall([
   function(cb) {  // Check for existence of conversation
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) { // Get indicated messages
      if (vld.check(cnvs.length, Tags.notFound, null, cb)) {
        if (req.query.num)
          cnn.chkQry(query, [cnvId, Number(req.query.num)], cb);
        else
          cnn.chkQry(query, params, cb);
       }
   },
   function(msgs, fields, cb) { // Return retrieved messages
      msgs.forEach(function(mssg) { //convert whenMade from
        mssg.whenMade = mssg.whenMade ?
         mssg.whenMade.getTime() : null;
      });
      if (req.query.dateTime)
        msgs = msgs.filter(function(mssg) {
          return mssg.whenMade < req.query.dateTime;
        });
      res.json(msgs);
      cb(null);
   }],
   function(err) {
      if (err)
        console.log(err)
      cnn.release();
   });
});

router.post('/:cnvId/Msgs', function(req, res) {
   var vld = req.validator;
   var cnn = req.cnn;
   var cnvId = req.params.cnvId;
   var body = req.body;
   var now;

   async.waterfall([//first check for members of objects
   function(cb) {
     if (vld.check(Object.keys(body).length, Tags.missingField, "content", cb))
      cb(null);
   },
   function(cb) {
     if (vld.check(body.hasOwnProperty("content") && body.content !== null &&
      body.content.length < 5000,
      Tags.missingField, "content", cb))
      cb(null);
   },
   function(cb) {
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb))
         cnn.chkQry('insert into Message set ?',
          [{cnvId: cnvId, prsId: req.session.id,
          whenMade: now = new Date(), content: req.body.content}], cb);
   },
   function(insRes, fields, cb) {
      res.location("/Msgs" + '/' + insRes.insertId).end();
      cnn.chkQry("update Conversation set lastMessage = ? where id = ?",
       [now, cnvId], cb);
   }],
   function(err) {
      cnn.release();
   });
});

module.exports = router;
