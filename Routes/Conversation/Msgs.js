var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var ssnUtil = require('../Session.js');
var async = require('async');

router.baseURL = '/Msgs';

router.get('/:msgId', function(req, res) {
  var msgId = req.params.msgId;
  var cnn = req.cnn;
  var vld = req.validator;

  async.waterfall([
  function(cb) {
    var isAuthorized;
    for (var cookie in ssnUtil.sessions) {
      if (req.cookies[ssnUtil.cookieName] === cookie)
        isAuthorized = true;
    }
    if (vld.check(isAuthorized, Tags.noLogin, null, cb))
      cb(null);
  },
  function(cb) {
    cnn.chkQry('select * from Message where id = ?', [msgId], cb);
  },
  function(mssg, fields, cb) {
    if (vld.check(mssg.length, Tags.notFound, null, cb)) {
      res.status(200).json(mssg[0]);
      cb(null);
    }
  }],
  function(err) {
    cnn.release();
    if (err)
      console.log(err);
  });
});
module.exports = router;
