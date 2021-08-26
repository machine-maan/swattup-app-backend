const randomstring = require('randomstring')
const db = require('../models')

exports.insertInterests = (req, res) => {
    db.CrowdsIntersts.create({
      crowdsId: req.body.crowdsId,
      interestName: req.body.interestName,
      createdAt: new Date().toISOString(),
    })
      .then((interst) => {
        res.status(200).send({
          success: true,
          statusCode: 200,
          message: "Interest inserted",
          responseData: interst,
        })
      })
      .catch((err) => {
        res.status(401).send({
          success: false,
          statusCode: 401,
          message: err,
        })
      })
  }

exports.getCrowds = (req, res) => {
  db.CrowdsIntersts.find()
    .then((interests) => {
      res.send({
        success: true,
        statusCode: 200,
        message: 'crowds interest get successfully',
        response_data: interests,
      })
    })
    .catch((err) => {
      res.send(err)
    })
}