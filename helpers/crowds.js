const randomstring = require('randomstring')
const db = require('../models')
const users = require('./users')

exports.addUserToCrowds = (crowds, userID) => {
  db.Crowd.updateMany(
    { name: { $in: crowds }, organisation: false }, // non-organisations only
    { $addToSet: { users: userID } }
  )
    .then((result) => console.log(result))
    .catch((err) => console.log(err))
}

exports.subscribe = (req, res) => {
  console.log('test');
  const pushOrPull = req.params.action === 'add' ? '$addToSet' : '$pull'
  db.Crowd.findOneAndUpdate(
    { name: req.params.crowd },
    { [pushOrPull]: { subscriptions: req.token._id } },
    { upsert: true }
  )
    .then((crowd) => {
      // if subscribing to an organisation and not a user/leader, reject
      if (
        req.params.action === 'add' &&
        crowd.organisation &&
        !crowd.users
          .concat(crowd.leaders)
          .find((item) => item === req.token._id)
      ) {
        return res.send({ unauthorized: true })
      }

      db.User.findOneAndUpdate(
        { _id: req.token._id },
        { [pushOrPull]: { subscriptions: req.params.crowd } },
        { new: true }
      )
        .then((user) => 
        res.send({ subscriptions: user.subscriptions }))
        .catch((error) => res.send(error))
    })
    .catch((error) => res.send(error))
}

// used when updating subjects to remove crowds. subscriptions already updated on user doc so just crowd docs
exports.batchUnsubscribe = (userID, crowds) => {
  db.Crowd.updateMany(
    { name: { $in: crowds } },
    { $pull: { subscriptions: userID.toString() } } // turn objectId to string in cases like these
  )
    .then((result) => console.log(result))
    .catch((error) => console.log(error))
}

exports.regenerateCodes = (req, res) => {
  return generateInviteCodes()
    .then((codes) => {
      if (!codes) {
        return
      }

      db.Crowd.findOneAndUpdate(
        {
          name: req.params.name,
          creator: req.token._id, // make sure token is creator's
        },
        {
          inviteCode: codes.inviteCode,
          leaderCode: codes.leaderCode,
        },
        { new: true }
      )
        .then((crowd) => {
          if (!crowd) {
            return res.send({ unauthorized: true })
          }

          return res.send({ success: true, crowd })
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

function generateInviteCodes() {
  return new Promise((resolve, reject) => {
    const inviteCode = randomstring.generate({
      length: 6,
      charset: 'alphabetic',
      capitalization: 'uppercase',
    })

    const leaderCode = randomstring.generate({
      length: 6,
      charset: 'alphabetic',
      capitalization: 'uppercase',
    })

    db.Crowd.findOne({ $or: [{ inviteCode }, { leaderCode }] })
      .then((crowd) => {
        if (crowd) {
          console.log('An invite code generated already exists - retrying.')
          resolve(generateInviteCodes())
        } else {
          console.log('Generated unique invite codes.')
          resolve({ inviteCode, leaderCode })
        }
      })
      .catch((err) => reject(err))
  })
}

// case of crowd should match everywhere else, e.g. when joining - exception here to prevent duplicate crowds
exports.createCrowd = (req, res) => {
  // console.log('abc');
  // authorization checks for official crowds and organisations
  if (req.params.type === 'official' && req.token.type !== 'admin') {    
    return res.send({ notAdmin: true })
  }

  if (req.params.type === 'organisation' && req.token.organiser !== true) {   
    return res.send({ notOrganiser: true })
  }

  if (
    req.params.type &&
    req.params.type !== 'official' &&
    req.params.type !== 'organisation'
  ) {
    return res.send({ invalidType: true })
  }

  // no type implies community crowd
  // #dev - strict limit
  // if(!req.params.type && !req.user.premium) {
  //     return res.send({ error: "requires_premium" })
  // }

  // if a normal crowd but user isn't validated, reject
  if (!req.params.type && !req.user.validated) {
    return res.send({ unauthorized: true })
  }

  // check to make sure crowd doesn't exist, isn't banned and user isn't banned from creating crowds
  db.Crowd.findOne({ lowercaseName: req.params.crowdName.toLowerCase() })
    .lean()
    .then((crowd) => {
      if (crowd) {
        if (crowd.banned) {
          return res.send({ bannedCrowd: true })
        }

        if (crowd.official) {
          return res.send({ officialCrowdExists: true })
        }

        return res.send({ communityCrowdExists: true }) // also covers organisations
      }

      if (req.user.bannedCrowdCreator) {
        return res.send({ bannedCrowdCreator: true })
      }

      const organisation =
        req.params.type === 'organisation' && req.token.organiser ? true : false

      if (organisation) {
        // make sure user hasn't exceeded their limit
        db.Crowd.find({ organisation: true, creator: req.token._id })
          .lean()
          .then((crowds) => {
            if (crowds.length >= req.user.organisationLimit) {
              return res.send({ limitReached: req.user.organisationLimit })
            }

            generateInviteCodes()
              .then((codes) => {
                createCrowd(req, res, true, codes)
              })
              .catch((err) => res.send(err))
          })
          .catch((err) => res.send(err))
      } else {
        createCrowd(req, res)
      }
    })
    .catch((err) => res.send(err))
}

function createCrowd(req, res, organisation = false, codes = {}) {
  const user = req.user

  // create crowd
  db.Crowd.create({
    name: req.params.crowdName,
    lowercaseName: req.params.crowdName.toLowerCase(),
    creator: req.token._id,
    banned: false,

    official:
      req.params.type === 'official' && req.token.type === 'admin'
        ? true
        : false,

    organisation: organisation,
    inviteCode: codes.inviteCode,
    leaderCode: codes.leaderCode,

    date: new Date().toISOString(),
    users: organisation ? [] : [user._id.toString()], // chuck the creator in (if a normal crowd)
    leaders: organisation ? [user._id.toString()] : undefined, // if organisation, chuck creator in leaders
    subscriptions: [user._id.toString()],
  })
    .then((crowd) => {
      let updates

      if (organisation) {
        // if organisation, add to organisation list
        updates = {
          $addToSet: {
            organisations: req.params.crowdName,
          },
        }
      } else {
        // if normal subject, add to user's crowds and populate content entry
        updates = {
          $addToSet: {
            subjects: req.params.crowdName,
          },
          $push: {
            content: {
              subject: req.params.crowdName,
              answers: [],
              questions: [],
              saved: [],
              comments: [],
            },
          },
        }
      }

      db.User.findOneAndUpdate({ _id: req.token._id }, updates, { new: true })
        .then((user) => res.send({ crowd: crowd, user: users.trimUser(user) }))
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

// exports.getCrowds = (req, res) => {
//   const response_arr = []
//   db.Crowd.find()
//     .lean()
//     // .populate([
//     //   {
//     //     path: 'userId',
//     //     select: 'email username firstName lastName ',
//     //   },
//     // ])
//     .exec((err, crowd_data) => {
//       res.send({
//         success: true,
//         message: 'couch profile data could get successfully!',
//         data: crowd_data,
//     })
//   })
// }

//get crowds api
// exports.getCrowds = (req, res) => {
//   db.CrowdInterest.find()
//     .then((interests) => {
//       res.send({
//         success: true,
//         interests,
//       })
//     })
//     .catch((err) => {
//       res.send(err)
//     })
// }

exports.subscribeToCrowds = (userID, crowds) => {
  console.log('crowds', crowds)

  if (crowds.length === 0) {
    return
  }

  db.Crowd.updateMany(
    { name: { $in: crowds } },
    {
      $addToSet: {
        subscriptions: userID.toString(),
      },
    }
  )
    .then((result) => {
      console.log('result', result)
    })
    .catch((err) => console.log(err))
}

// BELOW FUNCTIONS TO SUBSCRIBE USERS TO ALL THEIR CROWDS
// function fetchAllUsers() {
//     db.User.find()
//     .then(users => {
//         subscribeUser(users, 0)
//     })
//     .catch(err => console.log(err))
// }

// function subscribeUser(users, index) {
//     if(users[index]) {
//         console.log(`user ${index}`)

//         const user = users[index]

//         const subscriptions = user.subjects.concat(user.organisations)

//         console.log('subscriptions', subscriptions)

//         // add crowds to user subscriptions
//         db.User.findOneAndUpdate({
//             _id: user._id
//         }, {
//             subscriptions: subscriptions
//         })
//         .then(updatedUser => {
//             console.log(updatedUser)

//             // add users to crowd subscriptions
//             db.Crowd.updateMany({
//                 name: { $in: subscriptions }
//             }, {
//                 $addToSet: { subscriptions: user._id.toString() }
//             })
//             .then(result => {
//                 console.log('result', result)

//                 subscribeUser(users, index + 1)
//             })
//             .catch(err => console.log(err))
//         })
//         .catch(err => console.log(err))
//     }
//     else {
//         console.log(`finished - no user ${index}`)
//     }
// }

// fetchAllUsers() // <---- call this to subscribe users to all their crowds

//crowdinterst api
exports.getCrowds = (req, res) => {
  db.CrowdInterest.find()
    .then((interests) => {
      res.send({
        success: true,
        interests,
      })
    })
    .catch((err) => {
      res.send(err)
    })
}



