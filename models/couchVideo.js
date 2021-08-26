const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const models = require('./')
var Schema = mongoose.Schema;

const schema = new mongoose.Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  videoTitle: {
    type: String,
    required: true,
  },
  videoDescription: {
    type: String,
    required: true,
  }, 
  video: {
    type: String,
    required: true,
  },
},{
    timestamps: true,
    versionKey: false,
})

const CouchVideo = mongoose.model('CouchVideo', schema)
module.exports = CouchVideo
