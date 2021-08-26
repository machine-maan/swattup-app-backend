const randomstring = require('randomstring')
const db = require('../models')

exports.getGoals = (req, res) => {
    db.CrowdGoals.find().then((goals) => {
      res.status(200).send({
        success: true,
        responseData: goals,
        statusCode: 200
      })
    })
  }
  
  exports.insertGoals = (req, res) => {
    db.CrowdGoals.create({
      crowdsId: req.body.crowdsId,
      goalsName: req.body.goalsName,
      createdAt: new Date().toISOString(),
    }).then((goals) => {
      res.send({
        success: true,
        responseData: goals,
        statusCode: 200
      })
    })
  }
  