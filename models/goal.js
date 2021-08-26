const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const models = require('./')

const schema = new mongoose.Schema({
  goal: {
    type: String,
    required: true,    
  }
 })
 
const Goal = mongoose.model('Goal', schema)

module.exports = Goal
