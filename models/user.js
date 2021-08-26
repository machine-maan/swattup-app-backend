const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const models = require('./')
const configHelper = require('../helpers/configHelper')

const schema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  username: {
    type: String,
    required: false,
    lowercase: false,
    trim: true,
  },

  firebaseUserID: {
    required: false,
    type: String,
  },

  authProvider: {
    type: String,
    // enum: ['google', 'twitter', 'email', 'apple', 'facebook'],
    enum: configHelper.AUTH_PROVIDERS,
    required: false,
  },

  source: {
    type: String,
    // enum: ['google', 'twitter', 'email', 'apple', 'facebook'],
    enum: configHelper.SOURCE_PROVIDERS,
    default: configHelper.SOURCE_PROVIDER_EMAIL,
    required: true,
  },

  sourceID: String,
  profileImage: String,
  bannerImage: String,

  phone: String,
  aboutMe: String,
  stripeCustomerId: String,

  type: {
    // Learner, Professional etc,
    type: String,
    enum: configHelper.USER_TYPE,
    required: true,
  },
  verificationCode: {
    type: String,
  },
  verificationCodeCount: {
    type: Number,
    default: 0,
  },

  validated: { type: Boolean, default: false },

  goals: [],
  topics: [],
  password: { type: String, required: true },

  deviceID: { type: String },
  deviceModel: { type: String },
  devicePlatform: { type: String },
  deviceToken: { type: String },

  /* For coach */
  title: String,
  video: String,
  subscriptionPrice: Number,
  stripeAccountId: String,
  callPrice: Number,
  linkdinProfileUrl: String,
  facebookProfileUrl: String,
  instagramProfileUrl: String,
  twitterProfileUrl: String,
  timezone: { type: String, required: false },
}, {timestamps: true})
//
function hashPassword(next) {
  var user = this
  if (!user.isModified('password')) return next()
  console.log('password',bcrypt.hash(user.password, 10));
  bcrypt.hash(user.password, 10).then(
    (hashedPassword) => {
      console.log('hashedPassword',hashPassword);
      user.password = hashedPassword
      next()
    },
    (err) => {
      return next(err)
    }
  )
}
// //
schema.pre('save', hashPassword)
//
schema.methods.comparePassword = function (candidatePassword, next) {
  console.log('candidatePassword',candidatePassword);
  // console.log("canddd",this.password)
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    if (err) {
      return next(err)
    }

    return next(null, isMatch)
  })
}

const User = mongoose.model('User', schema)

module.exports = User
