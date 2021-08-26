const db = require('../models')
const push = require('./push')
const terms = require('./terms')
const users = require('./users')
const notifications = require('./notifications')
const configHelper = require('./configHelper')
const jwt = require('jsonwebtoken')
const { regenerateCodes } = require('./crowds')
const uploadHelper = require('./uploadHelper')
const commonHelper = require('./commonHelper')

const lightProfile = 'username points tutor premium firstName lastName deviceID'

// notes:
// level thresholds stored on app and level calculated on front-end
exports.searchUsers = (req, res) => {
  const blockList = req.user.blocked.concat(req.user.blockedBy)

  db.User.find(
    {
      _id: {
        $ne: req.token._id, // don't show yourself
        $nin: blockList, // don't show blocked users or those blocking you
      },
      $text: { $search: req.body.input },
    },
    {
      score: {
        $meta: 'textScore',
      },
      _id: 1,
      username: 1,
      firstName: 1,
      lastName: 1,
      school: 1,
      learningSubject: 1,
      points: 1,
      tutor: 1,
      premium: 1,
    }
  )
    .lean()
    .sort({ score: { $meta: 'textScore' } })
    .limit(50)
    .then((users) => {
      return res.send({ users })
    })
    .catch((err) => res.send(err))
}

function getChats(req) {
  console.log('req',req.user);
  console.log('gjgdjg');
  // don't return chats that are group: false and contain req.token._id and anyone in blocked or blockedBy list
  const blockList = req.user.blocked.concat(req.user.blockedBy)

  return db.Chat.find(
    {
      // at least one message
      'messages.0': { $exists: true },

      // either a group, and you're in users
      $or: [
        {
          group: true,
          users: req.token._id,
        },

        // or not a group, and you're in users, but there aren't any users in your blocked or blockedBy
        {
          group: false,
          users: {
            $in: [req.token._id],
            $nin: blockList,
          },
        },
      ],
    },
    {
      users: 1,
      read: 1,
      messages: { $slice: 1 }, // first message as preview
      group: 1,
    }
  )
    .lean()
    .sort({ 'messages.0': -1 })
    .populate('users usersLeft', lightProfile)
    .then((chats) => console.log('chats',chats))
    .catch((err) => err)
}

exports.fetchChats = (req, res) => {
  console.log('hfgfjg');
  getChats(req)
    .then((chats) => res.send({ chats }))
    .catch((err) => res.send(err))
}

// when making a request for a specific chat, marks property "read"
exports.getChat = (req, res) => {
  const { _id, recipient } = req.body
  // console.log('_id',_id);
  // console.log('recipient',recipient);
  // console.log('hdjfjf');

  // if recipient passed in, and you're blocking or blocked by them, reject
  if (recipient) {
    const blockList = req.user.blocked.concat(req.user.blockedBy)
    console.log('blockList',blockList);

    if (blockList.find((item) => item.toString() === recipient)) {
      return res.send({ error: 'blocked' })
    }
  }

  const params = {}

  // if _id passed in, get chat with this _id
  if (_id) {
    params._id = _id
  }
  // if recipient passed in, fetch or create chat with user and this recipient only, and not group chat
  else if (recipient) {
    params.users = {
      $size: 2,
      $all: [req.token._id, recipient],
    }
    params.group = false
  }
  // must pass in either _id or recipient
  else {
    return res.send({ error: 'missing_parameters' })
  }

  db.Chat.findOne(params)
    .populate('users usersLeft', lightProfile)
    .then((chat) => {
      if (!chat) {
        // if passed in a specific chat _id and not found, return error
        if (_id) {
          return res.send({ error: 'not_found' })
        }

        // if chat with recipient not found, find recipient...
        return db.User.findOne({ _id: recipient })
          .lean()
          .then((userRecipient) => {
            // recipient not found
            if (!userRecipient) {
              return res.send({ error: 'recipient_not_found' })
            }

            // recipient found - create chat
            return db.Chat.create({
              users: [req.token._id, recipient],
              messages: [],
              read: { [req.token._id]: true, [recipient]: true },
              group: false,
            })
              .then((chat) => {
                // look up, populate and return this new chat
                // no push notifications for "silently" created chat
                return db.Chat.findOne({ _id: chat._id })
                  .lean()
                  .populate('users', lightProfile)
                  .then((chat) => res.send({ chat }))
                  .catch((err) => res.send(err))
              })
              .catch((err) => res.send(err))
          })
          .catch((err) => res.send(err))
      }

      // chat found - if user token doesn't have a space in "read" object, reject
      if (chat.read[req.token._id] === undefined) {
        return res.send({ error: 'unauthorized' })
      }

      // if group chat, requires premium to view
      if (chat.group && !req.user.premium) {
        return res.send({ error: 'requires_premium' })
      }

      // first, mark this chat as read. read is a mixed type field, so update it in a special way
      chat.read[req.token._id] = true
      chat.markModified('read')

      // save and send chat
      chat
        .save()
        .then((chat) => res.send({ chat }))
        .catch((err) => res.send(err))
    })
    .catch((err) => {
      res.send(err)
    })
}

// for notification text
const getName = (user) => {
  if (user.firstName) {
    return `${user.firstName} (@${user.username})`
  } else {
    return `@${user.username}`
  }
}

exports.createGroupChat = (req, res) => {
  const { recipients } = req.body
  // if (!req.user.premium) {
  //   return res.send({ error: 'requires_premium' })
  // }

  // make sure all the recipients exist (also fails if duplicate recipient in req.body.recipients)
  db.User.find({ _id: { $in: recipients } })
    .lean()
    .then((users) => {
      console.log('users',users);
      // if (users.length !== recipients.length) {
      //   return res.send({ error: 'recipient_not_found_or_duplicate_recipient' })
      // }

      // group creator marked as read
      const read = {
        [req.token._id]: true,
      }
      

      // all recipient keys added as unread
      for (let i = 0; i < recipients.length; i++) {
        read[recipients[i]] = false
      }

      db.Chat.create({
        users: [req.token._id].concat(recipients),
        usersLeft: [],
        read: read,
        messages: [
          {
            date: new Date().toISOString(),
            author: req.token._id,
            // text: `@${req.user.username} created the session.`,
            system: true,
          },
        ],
        group: true,
      })
        .then((chat) => {
          notifications.chat(
            users,
            `${getName(req.user)} added you to a study session.`
          )

          // look up, populate and return this new chat
          db.Chat.findOne({ _id: chat._id })
            .lean()
            .populate('users', lightProfile)
            .then((chat) => res.send({ chat }))
            .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
    })
}

function markUnread(chat, req) {
  // mark all read keys as false
  Object.keys(chat.read).forEach((key) => {
    chat.read[key] = false
  })

  // mark user read
  chat.read[req.token._id] = true

  chat.markModified('read')

  return chat
}

// note: if adding a recipient that's already a member, won't be added more than once to "users" or "read", will just get system message again
exports.addToGroupChat = (req, res) => {
  const { _id, recipients } = req.body

  if (!req.user.premium) {
    return res.send({ error: 'requires_premium' })
  }

  // make sure all the recipients exist (also fails if duplicate recipient in req.body.recipients)
  db.User.find({ _id: { $in: recipients } })
    .lean()
    .then((users) => {
      if (users.length !== recipients.length) {
        return res.send({ error: 'recipient_not_found_or_duplicate_recipient' })
      }

      // find chat and add recipients (two stages to utilise mongoDB $addToSet and javascript unshift)
      db.Chat.findOneAndUpdate(
        {
          _id: _id,
          users: req.token._id, // make sure user is part of chat already
          group: true,
        },
        {
          $addToSet: {
            users: recipients,
          },
          $pull: {
            usersLeft: recipients,
          },
        },
        {
          new: true,
        }
      )
        .populate('users', lightProfile)
        .then((chat) => {
          if (!chat) {
            return res.send({ error: 'not_found_or_unauthorized' })
          }

          // add system messages for each new member
          for (let i = 0; i < users.length; i++) {
            chat.messages.unshift({
              date: new Date().toISOString(),
              author: req.token._id,
              text: `@${req.user.username} added @${users[i].username} to the session.`,
              system: true,
            })
          }

          // add "read" keys for new recipients
          for (let i = 0; i < recipients.length; i++) {
            chat.read[recipients[i]] = false
          }

          // mark all recipients but adder as unread
          chat = markUnread(chat, req)

          // save chat
          chat
            .save()
            .then((chat) => {
              notifications.chat(
                users,
                `${getName(req.user)} added you to a study session.`
              )

              return res.send({ chat })
            })
            .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

const reportChat = (user, chat, reason) => {
  // look up and populate users
  db.Chat.findOne({ _id: chat._id })
    .populate('users usersLeft', lightProfile + ' email')
    .then((chat) => {
      const userData = {}

      chat.users.concat(chat.usersLeft).forEach((user) => {
        userData[user._id] = user
      })

      let html = `
        @${user.username} (${user.firstName || '[no first name]'} ${
        user.lastName || '[no last name]'
      }) has reported a chat. Their email is ${
        user.email
      } if you'd like to get back. Images are stored securely so have to be looked up directly in S3 (swattup-private/images).
        <br/><br/>
        <b>Reason:</b> ${reason || 'no reason given.'}
        <br/><br/>
        <b>Members</b> (includes those who have left):<br/><br/>
        `

      Object.keys(userData).forEach((_id) => {
        const user = userData[_id]

        html += `@${user.username} - name: ${
          user.firstName || '[no first name]'
        } ${user.lastName || '[no last name]'} - email: ${user.email}<br/>`
      })

      html += `<br/>
        <b>Logs</b>
        <br/><br/>
        `

      chat.messages.reverse()

      chat.messages.forEach((message) => {
        html += `<b>${
          message.system ? 'System' : `@${userData[message.author].username}`
        }:</b> ${
          message.image ? `Image attached: ${message.image}` : message.text
        }<br/>`
      })

      const data = {
        from: 'SwattUp <noreply@swattup.com>',
        to: ['swattupreports@gmail.com'],
        // to: ["dc14312@my.bristol.ac.uk"], // #dev
        subject: `A chat has been reported`,
        html,
      }

      terms.mailgun.messages().send(data, (error, body) => {
        if (error || !body) {
          console.log('error =', error)
        }

        console.log('report sent')
      })
    })
    .catch((err) => console.log(err))
}

exports.leaveGroupChat = (req, res) => {
  // find chat and remove from "users". add to usersLeft so we still have their data to display previous messages
  db.Chat.findOneAndUpdate(
    {
      _id: req.body._id,
      users: req.token._id,
      group: true,
    },
    {
      $pull: {
        users: req.token._id,
      },
      $addToSet: {
        usersLeft: req.token._id,
      },
    },
    {
      new: true,
    }
  )
    .then((chat) => {
      if (!chat) {
        return res.send({ error: 'not_found_or_unauthorized' })
      }

      // add system message
      chat.messages.unshift({
        date: new Date().toISOString(),
        author: req.token._id,
        text: `@${req.user.username} left the session.`,
        system: true,
      })

      // delete from read keys
      delete chat.read[req.token._id]
      chat.markModified('read')

      // not marking as an 'unread' event for users
      chat
        .save()
        .then(() => {
          // email report
          if (req.body.report) {
            reportChat(req.user, chat, req.body.reportReason)
          }

          return res.send({ success: true })
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

exports.sendMessage = (req, res) => {
  console.log('hjdjgd');
  const { _id, recipient } = req.body
  // console.log('_id',_id);

  const params = {}

  // if a chat _id passed in, find with this
  if (_id) {
    params._id = _id
  }

  // deprecated: chat always found before sending message
  // if a recipient _id passed in, find a chat with exactly two users - the recipient and the user
  // else if(recipient) {
  //     params.users = { $size: 2, $all: [req.token._id, recipient] }
  //     params.group = false
  // }

  db.Chat.findOne(params)
    .populate('users usersLeft', lightProfile)
    .then((chat) => {
      // chat found
      if (chat) {
        // make sure user is in the chat users (mainly for _id searches)
        // if (chat.read[req.token._id] === undefined) {
        //   return res.send({ error: 'unauthorized' })
        // }

        // if group chat, message sender must be premium
        if (chat.group && !req.user.premium) {
          return res.send({ error: 'requires_premium' })
        }

        if (!chat.group) {
          // if direct messages, find the recipient and make sure they're not in your blocklist
          const blockList = req.user.blocked.concat(req.user.blockedBy)

          const recipient = chat.users.find(
            (user) => user._id.toString() !== req.token._id
          )

          if (
            blockList.find(
              (item) => item.toString() === recipient._id.toString()
            )
          ) {
            return res.send({ error: 'blocked' })
          }
        }

        // proceed to send message
        return processMessage(req, res, chat)
      }

      // chat not found
      // deprecated: if a recipient given, create the chat
      // if(recipient) {
      //     // find recipient
      //     db.User.findOne({ _id: recipient })
      //     .lean()
      //     .then(userRecipient => {
      //         if(!userRecipient) {
      //             return res.send({ error: "recipient_not_found" })
      //         }

      //         return db.Chat.create({
      //             users: [req.token._id, recipient],
      //             usersLeft: [],
      //             messages: [],
      //             read: { [req.token._id]: true, [recipient]: true }, // initiate as read
      //             group: false
      //         })
      //         .then(chat => {
      //             // look up, populate and return this new chat (NOT lean)
      //             return db.Chat.findOne({ _id: chat._id })
      //             .populate("users usersLeft", lightProfile)
      //             .then(chat => processMessage(req, res, chat))
      //             .catch(err => res.send(err))
      //         }).catch(error => res.send(error))
      //     }).catch(error => res.send(error))
      // }
      // if a chat _id given but chat not found, return error
      else {
        return res.send({ error: 'not_found' })
      }
    })
    .catch((err) => res.send(err))
}

function processMessage(req, res, chat) {
  // chat found or created - next step: create message object
  const body = {
    author: req.token._id,
    date: new Date().toISOString(),
  }

  if (req.body.image) {
    body.image = req.body.image
  } else if (req.body.text) {
    body.text = req.body.text
  } else {
    return res.send({ error: 'no_message_content' })
  }

  // add message to chat messages array
  chat.messages.unshift(body)
  chat = markUnread(chat, req)

  // save chat
  chat
    .save()
    .then((chat) => {
      const notifyUsers = chat.users.filter((item) => {
        // if group chat and user isn't premium, don't notify
        if (chat.group && !item.premium) {
          return false
        }

        // otherwise, notify as long as user isn't you
        return item._id.toString() !== req.user._id.toString()
      })

      notifications.chat(
        notifyUsers,
        `${getName(req.user)}: ${body.image ? 'Image attached.' : body.text}`,
        chat
      )

      // const message = req.body.text ? `${tools.display(sender)}: ${req.body.text}`
      // : `${tools.display(sender)} sent an image`

      // push.send(
      //     recipient.deviceID,
      //     recipient.notificationSettings.message,
      //     message,
      //     { type: "message", sender: sender._id }
      // )

      return res.send({ chat })
    })
    .catch((error) => {
      return res.send(error)
    })
}

exports.blockUser = (req, res) => {
  const pushOrPull = req.params.action === 'block' ? '$addToSet' : '$pull'

  db.User.findOneAndUpdate(
    {
      _id: req.params._id,
    },
    {
      [pushOrPull]: {
        blockedBy: req.token._id,
      },
    },
    {
      new: true,
    }
  )
    .then((blockedUser) => {
      if (!blockedUser) {
        return res.send({ error: 'user_not_found' })
      }

      db.User.findOneAndUpdate(
        {
          _id: req.token._id,
        },
        {
          [pushOrPull]: {
            blocked: req.params._id,
          },
        },
        {
          new: true,
        }
      ).then((user) => {
        // silent push notification so blocked user refreshes chats/closes chat modal if open
        notifications.block(blockedUser, req.user)

        // if reported
        if (req.body.report) {
          // find direct chat with this recipient
          db.Chat.findOne({
            users: {
              $size: 2,
              $all: [req.token._id, req.params._id],
            },
            group: false,
          })
            .lean()
            .then((chat) => {
              // send report
              reportChat(req.user, chat, req.body.reportReason)
            })
        }

        return res.send({
          user: users.trimUser(user),
          // blockedUser // #dev
        })
      })
    })
    .catch((err) => res.send(err))
}

exports.fetchBlockedUsers = (req, res) => {
  db.User.findOne(
    {
      _id: req.token._id,
    },
    {
      blocked: 1,
    }
  )
    .populate('blocked', lightProfile)
    .lean()
    .then((user) => {
      return res.send({ blockedData: user.blocked })
    })
    .catch((err) => res.send(err))
}

exports.uploadChatFiles = async (req, res) => {
    let formData = {
        type: req.body.type,
        status: req.body.status,
        receiverId: req.body.receiverId,
        senderId: req.body.senderId,
    };

    // let ext = null;
    // if (formData.type === 'image') {
    //     ext = ['jpg', 'jpeg', 'png', 'gif'];
    // } else if (formData.type === 'video') {
    //     ext = ['mov', 'mp4', 'mp3'];
    // }

    let chatFile = await uploadHelper.upload(
        req.files,
        'file',
        formData.type,
        './public/chat/',
        uploadHelper.CHAT_FILE_PATH,
    );

    if (chatFile.status) {
        formData.file = chatFile.file;
        if (formData.type == 'video') {
            formData.videoThumbnail = commonHelper.createThumbnailLink(chatFile.file, uploadHelper.CHAT_FILE_PATH)
        }

        res.status(200).send({
            status: true,
            statusCode: 200,
            message: 'Chat file uploaded successfully.',
            responseData: formData
        })
    } else {
        res.status(422).send({
            status: false,
            statusCode: 422,
            message: chatFile.message,
        })
    }
}