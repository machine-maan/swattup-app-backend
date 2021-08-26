const db = require('../models')
const https = require('https')
const usersHelper = require('./users')

const oneSignalKey = 'xxx'
const oneSignalAppID = 'xxx'

// note: if a user doesn't sign out properly, and doesn't sign in anywhere else, their deviceID may be shared with another user who then signs in on that device. then, "silent" pushes may be received, and mess with the notification counter for another user. very rare so leaving for now
exports.send = (
  users,
  message,
  usernames,
  type = 'notification',
  reference,
  silent
) => {
  // if given just one user, make it into an array
  if (!users) {
    return
  }

  if (users.constructor !== Array) {
    users = [users]
  }

  db.User.find(
    {
      [usernames ? 'username' : '_id']: { $in: users },
    },
    {
      deviceID: 1,
      username: 1,
      notifications: 1,
    }
  )
    .lean()
    .then((users) => {
      // send custom notification for each user, setting badge count to their unnread notifications
      users.forEach((user) => {
        if (user.deviceID && user.deviceID !== 'false') {
          // deviceIDs.push(user.deviceID) : null)
          // #dev to-do: count unread chats and combine this with unread notifications count
          const badgeCount = usersHelper.countUnreadNotifications(user)

          console.log('badgeCount', badgeCount)

          // create message
          const data = {
            app_id: oneSignalAppID,
            android_group: 'general',
            content_available: silent ? true : undefined,

            headings: silent
              ? undefined
              : type === 'message'
              ? { en: message }
              : { en: message + '.' },

            contents: silent
              ? undefined
              : type === 'message'
              ? { en: 'unread messages on SwattUp.' }
              : { en: 'new notifications on SwattUp.' },

            // reference is optional, currently refers to a chat _id to refresh or blocking user (to close chat)
            data: { type, reference },
            include_player_ids: [user.deviceID],
            ios_badgeType: 'SetTo', // "SetTo", "Increase"
            ios_badgeCount: badgeCount, // unread count to increase by/set
          }

          // destination of request
          var options = {
            host: 'onesignal.com',
            port: 443,
            path: '/api/v1/notifications',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              Authorization: oneSignalKey,
            },
          }

          console.log('options =', options)

          // create and send off
          const req = https.request(options, function (res) {
            res.on('data', function (data) {
              console.log('Response:')
              console.log(JSON.parse(data))
            })
          })

          req.on('error', function (e) {
            console.log('ERROR:')
            console.log(e)
          })

          req.write(JSON.stringify(data))
          req.end()
        }
      })
    })
    .catch((error) => console.log(error))
}
