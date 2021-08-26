const db = require('../models')

exports.fetchOrganisations = (req, res) => {
  db.Crowd.find({ organisation: true, creator: req.token._id })
    .lean()
    .sort({ lowercaseName: 1 })
    .then((organisations) => {
      res.send({ organisations })
    })
    .catch((err) => res.send(err))
}

exports.fetchOrganisation = (req, res) => {
  db.Crowd.findOne({ name: req.params.name, organisation: true })
    .lean()
    .then((crowd) => {
      if (crowd.creator !== req.token._id) {
        return res.send({ unauthorized: true })
      }

      // find all leaders
      db.User.find(
        { _id: { $in: crowd.leaders } },
        { _id: 1, username: 1, firstName: 1, lastName: 1 }
      )
        .lean()
        .then((leaders) => {
          // find all users
          db.User.find(
            { _id: { $in: crowd.users } },
            { _id: 1, username: 1, firstName: 1, lastName: 1 }
          )
            .lean()
            .then((users) => {
              crowd.leaders = leaders
              crowd.users = users

              return res.send({ organisation: crowd })
            })
            .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

exports.deleteOrganisation = (req, res) => {
  const name = req.params.name

  db.Crowd.findOne({ name: name, organisation: true })
    .then((crowd) => {
      if (!crowd) {
        return res.send({ notFound: true })
      }

      if (crowd.creator !== req.token._id && req.token.type !== 'admin') {
        return res.send({ unauthorized: true })
      }

      db.User.updateMany(
        { _id: { $in: crowd.users } },
        {
          $pull: {
            subscriptions: name,
            organisations: name,
          },
        }
      )
        .then(() => {
          db.Crowd.deleteOne({ name: name })
            .then(() => {
              res.send({ success: true })
            })
            .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

exports.removeMember = (req, res) => {
  const { name, userID } = req.params

  db.Crowd.findOneAndUpdate(
    {
      name: name,
      organisation: true,
      creator: req.token._id,
    },
    {
      $pull: {
        subscriptions: userID,
        users: userID,
        leaders: userID,
      },
    },
    {
      new: true,
    }
  )
    .then((crowd) => {
      if (!crowd) {
        return res.send({ unauthorized: true })
      }

      db.User.findOneAndUpdate(
        {
          _id: userID,
        },
        {
          $pull: {
            organisations: name,
            subscriptions: name,
          },
        }
      )
        .then(() => {
          res.send({ success: true })
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

function checkEmailLock(req, res, crowd) {
  // if there's an email lock
  if (crowd.emailLock || crowd.emailLockB) {
    // if there's an emailLock and it doesn't match, OR there's no emailLock (A) then check emailLockB
    if (
      (crowd.emailLock && !req.user.email.endsWith(crowd.emailLock)) ||
      !crowd.emailLock
    ) {
      // if there IS an emailLockB and it also doesn't fit, reject
      if (crowd.emailLockB) {
        if (!req.user.email.endsWith(crowd.emailLockB)) {
          console.log('email lock failed')
          return false
        }
      } else {
        // if no B and there was an A that failed, reject
        return false
      }
    }
  }

  return true
}

// if email lock doesn't match, undo the add
function emailLockFailed(req, res, crowd) {
  db.Crowd.findOneAndUpdate(
    {
      name: crowd.name,
      organisation: true,
    },
    {
      $pull: {
        users: req.token._id,
        leaders: req.token._id,
        subscriptions: req.token._id,
      },
    },
    {
      new: true,
    }
  )
    .then((crowd) => {
      // return e.g. "keele.ac.uk" or "keele.ac.uk or bristol.ac.uk" (if more than one email lock)
      let emailLockFailed

      if (crowd.emailLock && crowd.emailLockB) {
        emailLockFailed = crowd.emailLock + ' or ' + crowd.emailLockB
      } else if (crowd.emailLock) {
        emailLockFailed = crowd.emailLock
      } else if (crowd.emailLockB) {
        emailLockFailed = crowd.emailLockB
      }

      return res.send({ emailLockFailed })
    })
    .catch((err) => res.send(err))
}

exports.joinOrganisation = (req, res) => {
  const { code } = req.body

  // find an organisation where the code matches the invite code
  db.Crowd.findOneAndUpdate(
    {
      organisation: true,
      inviteCode: code,
    },
    {
      $addToSet: {
        users: req.token._id,
        subscriptions: req.token._id,
      },
    },
    { new: true }
  )
    .then((crowd) => {
      // not found - try with leader code
      if (!crowd) {
        db.Crowd.findOneAndUpdate(
          {
            organisation: true,
            leaderCode: code,
          },
          {
            $addToSet: {
              leaders: req.token._id,
              subscriptions: req.token._id,
            },
          },
          { new: true }
        )
          .then((crowd) => {
            if (!crowd) {
              return res.send({ noMatch: true })
            }

            if (checkEmailLock(req, res, crowd) === false) {
              return emailLockFailed(req, res, crowd)
            }

            // added to leaders. update user, adding name to organisations list
            db.User.findOneAndUpdate(
              { _id: req.token._id },
              {
                $addToSet: {
                  organisations: crowd.name,
                  subscriptions: crowd.name,
                },
              },
              { new: true }
            )
              .then((user) =>
                res.send({
                  user: {
                    organisations: user.organisations,
                    subscriptions: user.subscriptions,
                  },
                  organisation: crowd.name,
                })
              )
              .catch((err) => res.send(err))
          })
          .catch((err) => res.send(err))
      } else {
        if (checkEmailLock(req, res, crowd) === false) {
          return emailLockFailed(req, res, crowd)
        }

        // added to users. update user, adding name to organisations list
        db.User.findOneAndUpdate(
          { _id: req.token._id },
          {
            $addToSet: {
              organisations: crowd.name,
              subscriptions: crowd.name,
            },
          },
          { new: true }
        ).then((user) =>
          res.send({
            user: {
              organisations: user.organisations,
              subscriptions: user.subscriptions,
            },
            organisation: crowd.name,
          })
        )
      }
    })
    .catch((err) => res.send(err))
}

exports.leaveOrganisation = (req, res) => {
  db.Crowd.findOneAndUpdate(
    {
      organisation: true,
      name: req.params.name,
    },
    {
      $pull: {
        leaders: req.token._id,
        users: req.token._id,
        subscriptions: req.token._id,
      },
    },
    { new: true }
  )
    .then(() => {
      db.User.findOneAndUpdate(
        {
          _id: req.token._id,
        },
        {
          $pull: {
            organisations: req.params.name,
            subscriptions: req.params.name,
          },
        },
        {
          new: true,
        }
      )
        .then((user) =>
          res.send({
            user: {
              organisations: user.organisations,
              subscriptions: user.subscriptions,
            },
          })
        )
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

// reverse these into most recent first on front-end
exports.fetchFiles = (req, res) => {
  db.Crowd.findOne({
    name: req.params.name,
    organisation: true,
    $or: [{ users: req.token._id }, { leaders: req.token._id }],
  })
    .lean()
    .then((crowd) => {
      if (!crowd) {
        return res.send({ unauthorized: true })
      }

      return res.send({ files: crowd.files })
    })
    .catch((err) => res.send(err))
}

exports.changeEmailLock = (req, res) => {
  db.Crowd.findOneAndUpdate(
    {
      name: req.params.name,
      creator: req.token._id, // make sure token is creator's
    },
    {
      emailLock: req.body.emailLock,
      emailLockB: req.body.emailLockB,
    },
    {
      new: true,
    }
  )
    .then((crowd) => {
      if (!crowd) {
        return res.send({ unauthorized: true })
      }

      return res.send({ success: true, crowd })
    })
    .catch((err) => res.send(err))
}

exports.toggleAnonymous = (req, res) => {
  db.Crowd.findOneAndUpdate(
    {
      name: req.params.name,
      creator: req.token._id, // make sure token is creator's
    },
    {
      anonymous: req.body.anonymous,
    },
    {
      new: true,
    }
  )
    .then((crowd) => {
      if (!crowd) {
        return res.send({ unauthorized: true })
      }

      return res.send({ success: true, crowd })
    })
    .catch((err) => res.send(err))
}
