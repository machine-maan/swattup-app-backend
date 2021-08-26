const mongoose = require('mongoose')
var Schema = mongoose.Schema;
const bcrypt = require('bcryptjs')
const models = require('./')

const schema = new mongoose.Schema({
 answerId: {
    type: Schema.Types.ObjectId,
    ref: 'Question',
  },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
  comments: {
    type: String,
    required: true,    
  }
 })
 
const Comment = mongoose.model('Comment', schema)

module.exports = Comment
