var mongoose = require('mongoose')

var schema = new mongoose.Schema({
  image: {
    type: String,
  },
  name: {
    type: String,
  },
  goals: {
    type: String,
  },
  interests: {
    type: String,
  },
  createdDate: {
    type: String,
  },
  updatedDate: {
    type: String,
  },
})

var _Crowd = mongoose.model('crowdquestions', schema)

module.exports = _Crowd