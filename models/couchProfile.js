const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const models = require('./')
var Schema = mongoose.Schema;

const schema = new mongoose.Schema({
  title: String,
  description: String,
  video: String,
  subscriptionPrice: Number,
  stripeAccountId: String,
  callPrice: Number,
  linkdinProfileUrl: String,
  facebookProfileUrl: String,
  instagramProfileUrl: String,
  twitterProfileUrl: String,
})

const CouchProfile = mongoose.model('CouchProfile', schema)
module.exports = CouchProfile
