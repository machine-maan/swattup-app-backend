const schedule = require('node-schedule')

const billing = require('./billing')
const notifications = require('./notifications')
const users = require('./users')
const db = require('../models')

// when this is called, we validate the receipt and store it on the user model

// USER SIGNS UP TO PREMIUM IN APP - PROCESS_NEW CALLED. PURCHASE DATA STORED, ADDED TO MENTORING, QUESTION AND USER RETURNED
// USER LOGS IN / VERIFIES TOKEN - STORED PURCHASE DATA IS CHECKED. IF EXPIRED, PREMIUM REMOVED AND LEAVES SWATTUP MENTORING. OTHERWISE, AUTORENEWING STATE AND EXPIRY TIME UPDATED ON USER
// RESTORE PURCHASE: THIS USER CURRENTLY DOESN'T HAVE PURCHASE DATA STORED, BUT IS LINKED TO A PAYING ACCOUNT. SEND PURCHASE DATA TO PROCESS_NEW AS IF YOU'VE JUST SUBSCRIBED

const fetchPurchaseData = (req) => {
  return new Promise((resolve, reject) => {
    if (req.body.purchase) {
      return resolve(req.body.purchase)
    }

    return db.User.findOne({
      _id: req.token._id,
    })
      .lean()
      .then((user) => {
        if (!user.premiumPurchase) {
          return reject({ error: 'not_premium' })
        }

        return resolve(user.premiumPurchase)
      })
      .catch((err) => reject({ err }))
  })
}

const promoCodes = ['SWATTUPPROF123', 'SWATTUPPRO123']

exports.submitPromoCode = (req, res) => {
  console.log('code',req.params.code.toUpperCase());
  if (!promoCodes.includes(req.params.code.toUpperCase())) {
    return res.send({ success: false })
  }

  db.User.findOneAndUpdate(
    {
      _id: req.token._id,
    },
    {
      premium: true,
      premiumPromo: true,
      premiumExpiry: 4100000000000, // 2099
    },
    {
      new: true,
    }
  )
    .then((user) => {
      console.log('user =', user)

      return exports.joinSwattUpMentoring(req, res, user)
    })
    .catch((err) => res.send(err))
}

exports.processNewSubscription = (req, res) => {
  console.log('processNewSubscription')

  // fetch purchase data either from req.body or user document (if none passed in, i.e. "rejoin swattup mentoring")
  fetchPurchaseData(req)
    .then((purchase) => {
      console.log('purchase =', purchase)

      billing
        .validatePremium(purchase)
        .then((premiumResult) => {
          // premiumResult = { autoRenewing, expiryTimeMillis, purchase: { receipt, productId [android-only]} or false
          console.log('premiumResult =', premiumResult)

          if (!premiumResult) {
            return res.send({ error: 'not_validated' })
          }

          db.User.findOneAndUpdate(
            {
              _id: req.token._id,
            },
            {
              premium: true,
              premiumAutoRenewing: premiumResult.autoRenewing,
              premiumExpiry: premiumResult.expiryTimeMillis,
              premiumPurchase: premiumResult.purchase,
            },
            {
              new: true,
            }
          )
            .then((user) => {
              console.log('user.premiumPurchase =', user.premiumPurchase)

              return exports.joinSwattUpMentoring(req, res, user)
            })
            .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

// called on every signIn and verifyToken
// if a user is premium, checks and updates their autoRenewing and expiry time status. if expired, removes their premium and removes them from mentoring. either way, returns the (updated) user.
exports.checkPremium = (user) => {
  return new Promise((resolve, reject) => {
    // #dev - force premium true
    // return db.User.findOneAndUpdate({
    //     _id: user._id,
    // }, {
    //     premium: true,
    //     premiumAutoRenewing: true,
    //     premiumExpiry: new Date().getTime() + 86400000
    // }, {
    //     new: true
    // })
    // .then(userB => resolve(userB))

    // if user isn't marked as premium, he's not - just return user as-is
    if (!user.premium) {
      return resolve(user)
    }

    // if premiumPromo on, will have been made premium and still will be
    if (user.premiumPromo) {
      return resolve(user)
    }

    // if he is marked as premium, check that the purchase token stored on his account is still valid
    billing
      .validatePremium(user.premiumPurchase)
      .then((premiumResult) => {
        // if still premium, all good
        if (premiumResult) {
          // if either autoRenewing or expiryTime has changed, update it on user
          if (
            premiumResult.autoRenewing !== user.premiumAutoRenewing ||
            Number(premiumResult.expiryTimeMillis) !== user.premiumExpiry
          ) {
            db.User.findOneAndUpdate(
              {
                _id: user._id,
              },
              {
                premiumAutoRenewing: premiumResult.autoRenewing,
                premiumExpiry: premiumResult.expiryTimeMillis,
              },
              {
                new: true,
              }
            ).then((userB) => {
              // return updated user
              return resolve(userB)
            })
          }
          // premium and no changes - just return existing user
          else {
            return resolve(user)
          }
        }

        // if not premium, clear his premium status and leave SwattUp mentoring
        else {
          db.User.findOneAndUpdate(
            {
              _id: user._id,
            },
            {
              premium: false,
            },
            {
              new: true,
            }
          ).then((userB) => {
            leaveSwattUpMentoring(userB).then((userC) => {
              return resolve(userC)
            })
          })
        }
      })
      .catch((err) => reject(err))
  })
}

// on release, use @swattup account
const mentoringBot = {
  _id: db.dev ? '5ade2db26842f679a2d80b48' : '5ba3d837c3a5c5582ab7ff37',
  username: 'swattup',
}

exports.joinSwattUpMentoring = (req, res, user) => {
  db.Crowd.findOneAndUpdate(
    {
      name: 'SwattUp Mentoring',
    },
    {
      $addToSet: {
        users: user._id.toString(),
        subscriptions: user._id.toString(),
      },
    },
    {
      new: true,
    }
  )
    .then((crowd) => {
      // update user, adding name to organisations and subscriptions list
      db.User.findOneAndUpdate(
        { _id: user._id },
        {
          $addToSet: {
            organisations: crowd.name,
            subscriptions: crowd.name,
          },
        },
        { new: true }
      ).then((user) => {
        console.log(`${user.username} added to SwattUp Mentoring`)
        console.log('checking for mentoring intro post')

        const additionalData = `mentoring_intro_@${user.username}`

        db.Question.findOne({
          subject: 'SwattUp Mentoring',
          additionalData,
        })
          .lean()
          .then((question) => {
            if (!question) {
              console.log('creating mentoring intro post')

              // post intro question
              db.Question.create({
                userID: mentoringBot._id,
                title: `Welcome, ${user.firstName || `@${user.username}`}`,
                body: `Welcome to SwattUp premium - why not introduce yourself? @${user.username}`,
                subject: 'SwattUp Mentoring',
                mentions: [user.username],
                date: new Date().toISOString(),
                answers: [],
                organisation: true,
                additionalData,
              }).then((questionNew) => {
                notifications.mention(
                  mentoringBot,
                  [user.username],
                  questionNew,
                  undefined,
                  undefined,
                  'force'
                )

                return res.send({
                  question: questionNew,
                  user: users.trimUser(user),
                })
              })
            } else {
              console.log('mentoring intro post already exists')
              console.log('question =', question)

              return res.send({ question, user })
            }
          })
      })
    })
    .catch((err) => res.send({ err }))
}

const leaveSwattUpMentoring = (user) => {
  return new Promise((resolve, reject) => {
    db.User.findOne({
      _id: user._id,
    })
      .then((userB) => {
        userB.organisations = userB.organisations.filter(
          (name) => name !== 'SwattUp Mentoring'
        )
        userB.subscriptions = userB.subscriptions.filter(
          (name) => name !== 'SwattUp Mentoring'
        )

        userB.save().then((userC) => {
          db.Crowd.findOneAndUpdate(
            {
              name: 'SwattUp Mentoring',
            },
            {
              $pull: {
                subscriptions: user._id.toString(),
                users: user._id.toString(),
              },
            },
            {
              new: true,
            }
          ).then((crowd) => {
            console.log('removed user from SwattUp Mentoring')
            console.log('crowd =', crowd)

            return resolve(userC)
          })
        })
      })
      .catch((err) => reject(err))
  })
}

// every 24 hours, reset everyone's question and answer limits (these limit only standard users, and non-organisation crowds)
exports.resetDailyCounts = () => {
  const rule = new schedule.RecurrenceRule()
  rule.hour = 0

  schedule.scheduleJob(rule, () => {
    console.log('resetting daily question and answer counts')

    db.User.updateMany(
      {},
      {
        questionsToday: 0,
        answersToday: 0,
      }
    )
      .then((result) => {
        console.log('resetDailyCounts result =', result)
      })
      .catch((err) => console.log('resetDailyCounts err =', err))
  })

  // #dev
  // db.User.findOneAndUpdate({
  //     username: "mostar"
  // }, {
  //     premium: true,
  //     $inc: { premiumExpiry: new Date().getTime() + 86400000 }
  // })
  // .then(mostar => console.log('mostar =', mostar))
  // .catch(err => console.log(err))
}
