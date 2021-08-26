const db = require('../models')
const crowds = require('./crowds')
const users = require('./users')

const userLimit = 20

const fieldsObject = {
  _id: 1,
  username: 1,
  firstName: 1,
  lastName: 1,
  email: 1,
  points: 1,
  joinDate: 1,
  learningLevel: 1,
  school: 1,
  tutor: 1,
  premium: 1,
  premiumExpiry: 1,
  premiumAutoRenewing: 1,
  organiser: 1,
  organisationLimit: 1,
  banned: 1,
  bannedCrowdCreator: 1,
}

const welcomeMessage =
  "Welcome to SwattUp! We hope you'll enjoy teaching with us."

exports.adminCreateUser = (req, res) => {
  // make sure email or username isn't taken
  db.User.findOne({
    $or: [{ email: req.body.email }, { username: req.body.username }],
  })
    .then((user) => {
      if (user) {
        if (user.email === req.body.email) {
          return res.send({ errorMessage: 'Email taken!' })
        } else if (user.username === req.body.username) {
          return res.send({ errorMessage: 'Username taken!' })
        } else {
          return res.send({ errorMessage: 'Email or username taken!' })
        }
      }

      // populate content collection and create user
      const subjects = ['SwattUp Support', 'SwattUp Hangout']
      const content = []

      subjects.forEach((subject) => {
        content.push({
          subject: subject,
          questions: [],
          answers: [],
          comments: [],
          saved: [],
        })
      })

      db.Config.findOne({ name: 'config' })
        .then((config) => {
          db.User.create({
            email: req.body.email,
            username: req.body.username,

            password: req.body.password,
            passwordDate: new Date().toString(),

            validated: true,

            type: 'user',

            firstName: req.body.firstName,
            lastName: req.body.lastName,

            learningLevel: req.body.learningLevel || 'Tutor',

            subjects: subjects,

            subscriptions: [],

            content: content,

            joinDate: new Date().toISOString(),

            points: config.pointRewards.signUp,

            notifications: [
              {
                form: 'custom',
                message: welcomeMessage,
                date: new Date(),
                points: config.pointRewards.signUp,
              },
            ],

            blocked: [],
            blockedBy: [],
          })
            .then((user) => {
              crowds.addUserToCrowds(user.subjects, user._id)

              return res.send({ success: true, user: user })
            })
            .catch((error) => res.send(error))
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

exports.adminFetchUserHistory = (req, res) => {
  db.User.findOne({ _id: req.params._id }, { notifications: 1 })
    .lean()
    .then((user) => {
      res.send({ user })
    })
    .catch((err) => res.send(err))
}

exports.adminFindUser = (req, res) => {
  db.User.findOne(
    {
      $or: [{ email: req.params.email }, { username: req.params.email }],
    },
    fieldsObject
  )
    .lean()
    .then((user) => {
      res.send({ users: [user] }) // return as item in array to match fetchUsers
    })
    .catch((err) => res.send(err))
}

exports.adminFetchUsers = (req, res) => {
  const { sort, skip } = req.params

  const queryObject =
    sort === 'Tutors'
      ? { $or: [{ learningLevel: 'Tutor' }, { tutor: true }] }
      : sort === 'Organisers'
      ? { organiser: true }
      : sort === 'Premium'
      ? { premium: true }
      : {}

  const sortObject = sort === 'Points' ? { points: -1 } : { joinDate: -1 }

  db.User.find(queryObject, fieldsObject)
    .lean()
    .sort(sortObject)
    .skip(Number(skip) || 0)
    .limit(userLimit)
    .then((users) => res.send({ users }))
    .catch((err) => res.send(err))
}

const fields = [
  'organiser',
  'organisationLimit',
  'bannedCrowdCreator',
  'banned',
  'points',
  'tutor',
]

exports.adminUpdateUser = (req, res) => {
  db.User.findOne({ _id: req.params._id }).then((user) => {
    for (let i = 0; i < fields.length; i++) {
      if (req.body[fields[i]] !== undefined) {
        user[fields[i]] = req.body[fields[i]]
      }
    }

    // if banning a user, also update their passwordDate to invalidate their token
    if (req.body.banned === true) {
      user.passwordDate = new Date().toString()
    }

    user
      .save()
      .then((savedUser) => {
        const returnUser = {}

        // copy select fields from savedUser to returnUser
        Object.keys(fieldsObject).forEach((field) => {
          returnUser[field] = savedUser[field]
        })

        res.send({ success: true, user: returnUser })
      })
      .catch((err) => res.send(err))
  })
}

// average 1-ups per answer/average speed refers to ANSWERS TO QUESTIONS POSTED BY MEMBERS from a school/level etc
// (not to ANSWERS POSTED BY MEMBERS themselves)
exports.getStats = (req, res) => {
  // this route: university and learning level
  // for crowds: skip user find and go straight to db.Question.find({ crowd: x })
  const { field, value } = req.params

  if (field === 'crowd') {
    db.Crowd.findOne(
      { name: value },
      {
        official: 1,
        organisation: 1,
        banned: 1,
        creator: 1,
        date: 1,
        users: 1,
        subscriptions: 1,
      }
    )
      .lean()
      .then((crowd) => {
        db.Question.find(
          { subject: value },
          { _id: 1, date: 1, 'answers.date': 1, 'answers.ups': 1 }
        )
          .lean()
          .then((questions) => {
            db.User.findOne(
              { _id: crowd.creator },
              { firstName: 1, lastName: 1, username: 1 }
            )
              .then((user) => {
                res.send({ crowd, questions, user })
              })
              .catch((err) => res.send(err))
          })
          .catch((err) => res.send(err))
      })
      .catch((err) => res.send(err))
  } else {
    db.User.find(
      { [field]: value },
      { _id: 1, points: 1, 'content.questions': 1, 'content.answers': 1 }
    )
      .lean()
      .then((users) => {
        const userIDs = users.map((item) => item._id) // create array of user ID's out of users array

        db.Question.find(
          { userID: { $in: userIDs } },
          { _id: 1, date: 1, 'answers.date': 1, 'answers.ups': 1 }
        )
          .lean()
          .then((questions) => {
            res.send({ users, questions })
          })
          .catch((err) => res.send(err))
      })
      .catch((err) => res.send(err))
  }
}
