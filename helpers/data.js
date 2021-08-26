const db = require('../models')
const hotSwatts = require('./hotSwatts')
const chats = require('./chats')

// manages the /data route - pass in an object requesting specific types of data, and we'll wrap promises with a fake res.send that resolve to collect and return the different types of data

const fetchHotSwatts = (req) => {
  return new Promise((resolve, reject) => {
    hotSwatts.generateHotSwatts(req, {
      send: (data) => {
        if (data.users) {
          return resolve(data.users)
        }

        return resolve([])
      },
    })
  })
}

const fetchChats = (req) => {
  return new Promise((resolve, reject) => {
    chats.fetchChats(req, {
      send: (data) => {
        if (data.chats) {
          return resolve(data.chats)
        }

        return resolve([])
      },
    })
  })
}

exports.requestData = (req, res) => {
  const { body } = req

  let hotSwatts
  let chats

  if (body.hotSwatts) {
    hotSwatts = fetchHotSwatts(req)
  }

  if (body.chats) {
    chats = fetchChats(req)
  }

  Promise.all([hotSwatts, chats])
    .then(([hotSwatts, chats]) => {
      return res.send({
        hotSwatts,
        chats,
      })
    })
    .catch((err) => res.send(err))
}
