var mongoose = require('mongoose')

var schema = new mongoose.Schema({
  name: { type: String, unique: true, trim: true },
  lowercaseName: { type: String, lowercase: true, trim: true },
  official: Boolean,
  organisation: { type: Boolean, default: false },
  banned: { type: Boolean, default: false },
  creator: String,
  date: String,
  users: [],
  subscriptions: [],

  // organisation only
  files: [{ title: String, file: String, format: String, date: String }],
  leaders: [],
  inviteCode: String,
  leaderCode: String,
  emailLock: { type: String, lowercase: true }, // e.g. @keele.ac.uk
  emailLockB: { type: String, lowercase: true }, // alternative email lock field
  anonymous: Boolean,
})

var Crowd = mongoose.model('Crowd', schema)

module.exports = Crowd
