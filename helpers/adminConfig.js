// note: generic saving fields should return an object with { success: true, body: xxxx }
const Papa = require('papaparse')
const moment = require('moment')
const db = require('../models')
const token = require('../routes/token')
const users = require('./users')

exports.adminSignIn = (req, res) => {
  db.User.findOne({
    $or: [{ email: req.body.email }, { username: req.body.email }],
  })
    .then((user) => {
      if (!user) {
        return res.send({ notFound: true })
      }

      // check password
      user.comparePassword(req.body.password, (err, isMatch) => {
        if (err) {
          return res.send(err)
        }
        if (!isMatch) {
          return res.send({ unauthorized: true })
        }

        if (user.type !== 'admin' && !user.organiser) {
          return res.send({ unauthorized: true })
        }

        return res.send({
          token: token.getToken(user),
          user: users.trimUser(user),
        })
      })
    })
    .catch((error) => res.send(error))
}

const configFields = [
  'subjects',
  'learningLevels',
  'schools',
  'levelThresholds',
  'pointRewards',
  'requireAcEmail',
  'message',
]

// generates config object if none found
exports.updateConfig = (req, res) => {
  db.Config.findOne({ name: 'config' })
    .then((config) => {
      // if no config, create it
      if (!config) {
        db.Config.create({
          name: 'config',
          subjects: req.body.subjects,
          learningLevels: req.body.learningLevels,
          schools: req.body.schools,
          levelThresholds: req.body.levelThresholds,
          pointRewards: req.body.pointRewards,
          requireAcEmail: req.body.requireAcEmail,
          message: req.body.message,
        })
          .then((result) => res.send(result))
          .catch((error) => res.send(error))
      }
      // otherwise, update provided fields
      else {
        // set fixed upper and lower levelThresholds
        if (req.body.levelThresholds) {
          req.body.levelThresholds[0] = 0
          req.body.levelThresholds[1] = 0
          req.body.levelThresholds[6] = 9999999
        }

        if (req.body.message) {
          req.body.message.date = new Date().toISOString()
        }

        for (let i = 0; i < configFields.length; i++) {
          if (req.body[configFields[i]] !== undefined) {
            config[configFields[i]] = req.body[configFields[i]]
          }
        }
        config
          .save()
          .then((savedConfig) => res.send({ success: true, body: savedConfig }))
          .catch((error) => res.send(error))
      }
    })
    .catch((error) => res.send(error))
}

exports.banCrowd = (req, res) => {
  console.log('params',req.params);
  const { crowdName, type } = req.params

  if (type === 'ban' || type === 'unban') {
    const action = {}

    if (type === 'ban') {
      action.banned = true
      action.users = []
      action.subscriptions = []
    } else {
      action.banned = false
    }

    db.Crowd.findOneAndUpdate({ name: crowdName, official: false }, action)
      .then((crowd) => {
        if (!crowd) {
          return res.send({ notFound: true })
        }

        if (type === 'unban') {
          return res.send({ success: true })
        }

        db.User.updateMany(
          { _id: { $in: crowd.users } },
          {
            $pull: {
              subjects: crowdName,
              subscriptions: crowdName,
            },
          }
        )
          .then(() => {
            res.send({ success: true })
          })
          .catch((err) => res.send(err))
      })
      .catch((err) => res.send(err))
  } else if (type === 'remove') {
    db.Crowd.findOne({ name: crowdName })
      .then((crowd) => {
        if (!crowd) {
          return res.send({ notFound: true })
        }

        db.User.updateMany(
          { _id: { $in: crowd.users } },
          {
            $pull: {
              subjects: crowdName,
              subscriptions: crowdName,
            },
          }
        )
          .then(() => {
            db.Crowd.deleteOne({ name: crowdName })
              .then(() => {
                res.send({ success: true })
              })
              .catch((err) => res.send(err))
          })
          .catch((err) => res.send(err))
      })
      .catch((err) => res.send(err))
  }
}

exports.getSubscribedEmails = (req, res) => {
  db.User.find(
    {
      consentEmails: true,
    },
    {
      _id: 0,
      email: 1,
    }
  )
    .lean()
    .then((users) => {
      const result = Papa.unparse(users)

      res.set({
        'Content-Type': 'application/force-download',
        'Content-disposition': 'attachment; filename=emails.csv',
      })

      return res.send(result)
    })
    .catch((err) => res.send(err))
}

exports.getPremiumEmails = (req, res) => {
  db.User.find(
    {
      premium: true,
    },
    {
      _id: 0,
      email: 1,
      consentEmails: 1,
      premiumAutoRenewing: 1,
      premiumExpiry: 1,
    }
  )
    .lean()
    .sort({ consentEmails: -1, premiumAutoRenewing: 1, premiumExpiry: 1 })
    .then((users) => {
      users.forEach((user) => {
        user.premiumExpiry = moment(user.premiumExpiry).format('Do MMM YY')
      })

      // use this to define headers and force an empty line at the top
      users.unshift({
        email: '',
        consentEmails: '',
        premiumAutoRenewing: '',
        premiumExpiry: '',
      })

      const result = Papa.unparse(users)

      res.set({
        'Content-Type': 'application/force-download',
        'Content-disposition': 'attachment; filename=premium_emails.csv',
      })

      return res.send(result)
    })
    .catch((err) => res.send(err))
}

// store a code as a document in configs. { name: "https", note: "zzz" } - (make sure fields are in schema)
// update this in mLab, then show it as a wildcard for /.well-known/acme-challenge/xxx
// now when we want a new HTTPS certificate, we can update mLab and verify it without changing the source code
exports.displayAcmeCode = (req, res) => {
  db.Config.findOne({ name: req.params.label })
    .then((result) => {
      res.send(result.note)
    })
    .catch((error) => res.send(error))
}
