/*

NOT WORKING, JUST PRACTICING WRITING A SHORTER REPLACEMENT

router.put('/:id', function(req, res) {
  var vld = req.validator;
  var body = req.body;
  var updateObject = new Object();
  var isAdmin = req.session.isAdmin();

  async.waterfall([
  function(cb){
     if(isAdmin || vld.checkPrsOK(Number(req.params.id)))
       cb();
  },
  function(cb){
     if(vld.chain(!body.hasOwnProperty('email'), Tags.forbiddenField, "email")
      .chain(!body.hasOwnProperty('role'), Tags.badValue, "role")
      .chain(!body.hasOwnProperty('termsAccepted'),
       Tags.forbiddenField,"termsAccepted")
      .check(!body.hasOwnProperty('whenRegistered'),
       Tags.forbiddenField, "whenRegistered" cb))
        cb();
  }
  function(cb){
     if(body.oldPassword || body.password)
        passwordHandler(req, res, body, cb);
  },
  ])
}

function passwordHandler(req, res, body, cb){
    var vld = req.validator;


}
*/
