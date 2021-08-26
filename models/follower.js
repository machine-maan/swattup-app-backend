const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const models = require('./')
var Schema = mongoose.Schema;

const schema = new mongoose.Schema({
userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    },
followerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',   
   },
status: {
    type: String,
    required: true,      
},
 })
 
const Follower = mongoose.model('Follower', schema)

module.exports = Follower
