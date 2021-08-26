var mongoose = require('mongoose')

var schema = new mongoose.Schema({
  name: String,
  note: String,
  requireAcEmail: Boolean,
  subjects: [],
  learningLevels: [],
  schools: [],
  companies: [],
  levelThresholds: {
    1: Number,
    2: Number,
    3: Number,
    4: Number,
    5: Number,
  },
  pointRewards: {
    signUp: Number,
    uploadAvatar: Number,
    inviteFriend: Number,
    postedQuestion: Number,
    postedAnswer: Number,
    questionUpped: Number,
    answerUpped: Number,
    friendInvited: Number,
  },
  message: {
    date: String,
    title: String,
    body: String,
    prefixName: Boolean,
  },
  dailyQuestionLimit: Number,
  dailyAnswerLimit: Number,
})

var Config = mongoose.model('Config', schema)

module.exports = Config
