const mongoose = require('mongoose')
var Schema = mongoose.Schema;
const bcrypt = require('bcryptjs')
const models = require('./')

const schema = new mongoose.Schema({
    commentId: {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
      },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    reply: {
        type: String,
        required: true,    
    }
 })
 
const CommentReply = mongoose.model('CommentReply', schema)

module.exports = CommentReply
