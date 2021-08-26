const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const models = require('./')

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
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  source: {
    type: String,
    enum: ['google', 'twitter', 'email', 'linkedin'],
    default: 'email',
    required: true,
  },
  sourceID: String,

  phone: String,
  password: { type: String, required: true },
  passwordDate: String,

  type: String, // user, admin etc,

  premium: Boolean,
  premiumCheckDate: String,
  premiumAutoRenewing: Boolean,
  premiumExpiry: Number, // milliseconds
  premiumPurchase: {
    productId: String,
    receipt: String,
  },
  premiumPromo: Boolean, // forced premium for life by using promo code

  validated: { type: Boolean, default: false },

  tutor: { type: Boolean, default: false },
  organiser: { type: Boolean, default: false },
  organisationLimit: { type: Number, default: 100 },

  avatar: false,

  deviceID: { type: String },

  consentEmails: Boolean,

  banned: { type: Boolean, default: false },
  bannedCrowdCreator: { type: Boolean, default: false },

  firstName: String,
  lastName: String,

  learningLevel: String,
  learningSubject: String,
  school: String, // now "institutions" (e.g. company if learning level = "Professional")

  subjects: [],
  subscriptions: [],
  content: [
    {
      subject: String,
      questions: { type: [], default: [] },
      answers: { type: [], default: [] },
      comments: { type: [], default: [] },
      saved: { type: [], default: [] },
    },
  ],

  organisations: [], // organisations stored separately and not in "subjects". can't be easily updated like subjects, requires invite code. no document in "content" either.

  savedOrganisationQuestions: [], // no organisation document in "content" so store saved organisation questions here

  joinDate: String,

  invitedFriends: { type: Boolean, default: false }, // whether they've claimed the invite points

  points: { type: Number, default: 10 },

  following: [],
  followingSubscribed: [], // users you follow who you are subscribed to (for notifications)

  followers: [],
  followersSubscribed: [], // users following you who are subscribed to you

  notifications: [
    {
      form: String,
      message: String, // custom only
      why: String, // answer or comment only
      user: String,
      question: String,
      subject: String,
      answer: String, // comment only
      file: String, // newFile only
      organisation: Boolean, // display e.g. "official post" instead of "question" on front-end
      date: String,
      points: Number, // for certain notifications
      read: { type: Boolean, default: false },
    },
  ],

  questionsToday: Number,
  answersToday: Number,

  blocked: [models.ref('User')],
  blockedBy: [models.ref('User')],

  config: {
    initialPremiumModal: String, // "sign_up" / "second_open"
    variantPopUpA: Number, // "1" / "2"
  },
})

function hashPassword(next) {
  var user = this
  if (!user.isModified('password')) return next()
  bcrypt.hash(user.password, 10).then(
    (hashedPassword) => {
      user.password = hashedPassword
      next()
    },
    (err) => {
      return next(err)
    }
  )
}

schema.pre('save', hashPassword)

schema.methods.comparePassword = function (candidatePassword, next) {
  console.log("can",candidatePassword)
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    if (err) {
      return next(err)
    }

    return next(null, isMatch)
  })
}

const User = mongoose.model('User', schema)

module.exports = User
