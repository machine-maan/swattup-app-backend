const db = require('../models')
const async = require('async')

exports.createGoal = (req, res) => {
  const goal = req.body.goal
  db.Goal.create({
    goal: goal,
  })
    .then(() => {
      res.send({
        success: true,
        message: 'goal data inserted!',
      })
    })
    .catch((error) => res.send({ success: false, message: 'goal not found!' }))
}

exports.editGoal = (req, res) => {
    console.log('jgdkgd');
  const id = req.body.id
  const myquery = { _id: id }
  const newvalues = { $set: { goal: req.body.goal } }    

  db.Goal.updateOne(myquery, newvalues,
    { upsert: true, new: true, setDefaultsOnInsert: true },
     function (err, res) {
    console.log('data update successfully')
  }).then((err,goal) => {    
    res.send({
      success: true,
      message: 'goal data updated!',
    })

  })
  .catch((error) => res.send({ success: false, message: 'goal not updated!' }))
}

exports.removeGoal = (req, res) => {
  const id = req.body.id
  const myquery = { _id: id }

  db.Goal.findOne({
    _id: id,
}, function (err, goal) {
    if (err) {
        res.send({ success: false, message: err });
        return;
    }
    if (!goal) {
        return res.send({ success:false,message: "Goal not found." });
    }
})
  db.Goal.deleteOne(myquery, function (err, res) {
    console.log('data delete successfully')
  })
  res
    .send({
      success: true,
      message: 'goal data deleted!',
    })
    .catch((error) =>
      res.send({ success: false, message: 'goal not deleted!' })
    )
}
