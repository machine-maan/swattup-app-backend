const db = require('../models')
const async = require('async')
const jwt = require('jsonwebtoken')


exports.getUserActivityLog = (req, res) => {
  const auth_token = req.token;
  const secret = '123456';
  jwt.verify(auth_token, secret, async (err, authData) => {
    if (err) {
      res.status(401).send({
        message: 'Invalid Auth Token',
        status: false,
        statusCode: 401,
      });
    } else {
      const response_arr = []
      const userId = req.params.userId;
      db.User.findOne({
        _id: userId,
      }, function (err, user) {
        if (!user) {
          return res.status(401).send({
            message: 'User not found',
            status: false,
            statusCode: 401,
          });
        }
        else{
          db.ActivityLog.find({userId:userId})
          .then((logData) => {
            res.status(200).send({
              message: 'Logs fetched successfully',
              status: true,
              statusCode: 200,
              reponseData:logData
            });
          })
          .catch((error) => {
            return res.status(401).send({
              message: ''+error,
              status: false,
              statusCode: 401,
            });
          })
        }
      })
      
    }
  });
  
}
