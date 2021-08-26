const randomstring = require('randomstring')
const db = require('../models')

exports.getSpecificCrowds = (req, res) => {
    const search_keyword = (req.body.interests)?req.body.interests:''
    const array = (search_keyword.split(','))?search_keyword.split(','):''
    console.log(array)
    db._Crowd
      .find(
        {
          _id: { $in: array },
        }
        // function (err, teamData) {
        //   console.log('teams name  ' + teamData)
        // }
      )
      .then((data) => {
        console.log(data)
        res.json({
          status: true,
          data,
        })
      })
      .catch((err) => {
        res.send(err)
      })
  }