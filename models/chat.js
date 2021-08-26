const mongoose = require('mongoose')
const models = require('./')

const schema = new mongoose.Schema({
  group: Boolean, // group chat or not. group chats can have only 2 users (e.g. if users leave, or initially created with 2)
  users: [models.ref('User')],
  usersLeft: [models.ref('User')], // group-only store user data for users who left so they're not blank in the chat, and can't be re-added
  read: { type: mongoose.Schema.Types.Mixed, default: {} }, // whether they have read the chat. e.g. { "143": true, "165": false }

  messages: [
    {
      date: String,
      author: String,
      text: String,
      image: String,
      system: Boolean,
    },
  ],
})

const Chat = mongoose.model('Chat', schema)

module.exports = Chat
