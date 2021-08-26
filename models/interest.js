const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const models = require('./')

const schema = new mongoose.Schema({
  interest: {
    type: String,
    required: true,    
  }
 })
 
const Interest = mongoose.model('Interest', schema)

module.exports = Interest
