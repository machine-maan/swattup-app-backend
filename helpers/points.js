const db = require('../models')
const push = require('./push')
const crowds = require('./crowds')

// keys object comes out buggy from mongoose so manually define it
const keys = ['0', '1', '2', '3', '4', '5', '6']

// always generate level and username, and send with user information.
// profile image can then be found from S3 template URL using user ID
exports.getLevelData = (points, thresholds, levelOnly) => {
  let level

  // start at highest level and go down - if we're over the points threshold, this is our level
  for (let i = keys.length - 1; i >= 0; i--) {
    if (points >= thresholds[keys[i]]) {
      level = keys[i]
      break
    }
  }

  const data = {
    level: Number(level),
  }

  if (!levelOnly) {
    data.pointsNeeded = thresholds[Number(level) + 1] - points
    data.levelPoints = points - thresholds[level]
  }

  return data
}

exports.fetchLightProfiles = (userList, config, names) => {
  const fields = { _id: 1, username: 1, points: 1, tutor: 1, premium: 1 }

  if (names) {
    fields.firstName = 1
    fields.lastName = 1
  }

  return db.User.find({ _id: { $in: userList } }, fields)
    .lean()
    .then((users) => {
      for (let i = 0; i < users.length; i++) {
        users[i].level = exports.getLevelData(
          users[i].points,
          config.levelThresholds,
          true
        ).level
      }

      return users
    })
    .catch((error) => {
      throw Error(error)
    })
}

// NOTE: async = (req, res) breaks on AWS EB set-up - do not use
// exports.runTest = async (req, res) => {
//     // add all users to a crowd
//     // const crowdName = "SwattUp Hangout"

//     // let users

//     // try {
//     //     users = await db.User.find()
//     // } catch(error) {
//     //     return console.log(error)
//     // }

//     // console.log('users.length =', users.length)

//     // users.forEach(user => {
//     //     console.log('user.email =', user.email)

//     //     if(user.subjects.includes(crowdName)) {
//     //         console.log(`already in SwattUp Hangout (${user.email})`)
//     //     } else {
//     //         const updates = {
//     //             $addToSet: {
//     //                 subjects: crowdName,
//     //                 subscriptions: crowdName
//     //             },
//     //             $push: {
//     //                 content: {
//     //                     subject: crowdName,
//     //                     answers: [],
//     //                     questions: [],
//     //                     saved: [],
//     //                     comments: []
//     //                 }
//     //             }
//     //         }

//     //         db.User.findOneAndUpdate(
//     //             { _id: user._id },
//     //             updates,
//     //             { new: true }
//     //         )
//     //         .then(userNew => {
//     //             console.log(userNew)

//     //             crowds.subscribeToCrowds(user._id, [crowdName])

//     //             crowds.addUserToCrowds([crowdName], user._id)
//     //         })
//     //         .catch(err => console.log(err))
//     //     }
//     // })

//     // db.User.findOneAndUpdate({
//     //     email: "x"
//     // }, {
//     //     validated: true
//     // }, {
//     //     new: true
//     // })
//     // .then(user => res.send({ user }))
//     // .catch(err => res.send(err))

//     // db.User.updateMany({}, { validated: true })
//     // .then(result => res.send({ result }))
//     // .catch(err => res.send(err))

//     // db.User.find({ email: "xxx })
//     // .then(user => res.send({ user }))
//     // .catch(err => res.send({ err }))

//     // db.User.find()
//     // .then(users => {
//     //     for(let i=0; i<users.length; i++) {
//     //         const user = users[i]

//     //         db.User.findOneAndUpdate({
//     //             _id: user._id
//     //         }, {
//     //             followersSubscribed: user.followers,
//     //             followingSubscribed: user.following
//     //         }, {
//     //             new: true
//     //         })
//     //         .then(user => console.log(user))
//     //         .catch(err => console.log(err))
//     //     }
//     // })
//     // .catch(err => res.send(err))

//     // db.User.updateMany({
//     //     followingSubscribed: [],
//     //     followersSubscribed: []
//     // })
//     // .then(result => console.log('result', result))
//     // .catch(err => res.send(err))

//     // db.User.find({
//     //     deviceID: "07af8a18-8e17-4fc3-91bc-70ad663d3a4c"
//     //     // username: "danfour"
//     // }, { deviceID: 1, username: 1 })
//     // .then(result => res.send(result))
//     // db.User.updateMany({
//     //     deviceID: "07af8a18-8e17-4fc3-91bc-70ad663d3a4c"
//     // }, {
//     //     deviceID: ""
//     // }, {
//     //     new: true
//     // })
//     // .then(result => res.send(result))
//     // .catch(err => res.send(err))

//     // db.User.updateMany({
//     //     organiser: true
//     // }, {
//     //     organisationLimit: 100
//     // })
//     // .then(result => res.send(result))
//     // .catch(err => res.send(err))

//     // db.Config.findOne({ name: "config" })
//     // .then(config => {
//     //     res.send(config)
//     // })
//     // .catch(error => res.send(error))
// }

// after adding points, call this with the new total points and how much points you just gave. it will check if a level threshold was crossed and if so, generate a new notification
exports.checkLevelUp = (user, pointReward, thresholds) => {
  const newTotal = user.points

  const currentLevel = exports.getLevelData(newTotal, thresholds, true).level

  const oldTotal = newTotal - pointReward

  if (oldTotal < thresholds[currentLevel]) {
    const notification = {
      form: 'newLevel',
      why: currentLevel,
      date: new Date(),
    }

    db.User.findOneAndUpdate(
      { _id: user._id },
      { $addToSet: { notifications: notification } }
    )
      .then(() => {
        push.send(
          user._id,
          `You've gone ${colors[currentLevel]}! Congratulations on reaching level ${currentLevel}.`
        )
      })
      .catch((err) => console.log(err))
  }
}

const colors = {
  2: 'green',
  3: 'blue',
  4: 'purple',
  5: 'gold',
}
