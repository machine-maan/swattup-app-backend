var mongoose = require('mongoose')
mongoose.set('debug', true)
mongoose.Promise = global.Promise

// affects analytics key, mentoring bot account, db uri
// exports.dev = true
exports.dev = process.env.NODE_ENV === 'development'

mongoose
  .connect('mongodb://127.0.0.1:27017/swattupdev', {
    useNewUrlParser: true,
    useFindAndModify: false,
    useUnifiedTopology: true ,
    useNewUrlParser: true,
  })
  .then(
    () => {
      console.log('Database sucessfully connected');
      var admin = new mongoose.mongo.Admin(mongoose.connection.db);
      admin.buildInfo(function (err, info) {
         console.log('Mongo version-------->', info.version);
      });
    },
    (error) => {
      console.log('Database could not connected: ' + error)
    }
  )

exports.ref = (collection) => {
  return { type: mongoose.Schema.Types.ObjectId, ref: collection }
}

module.exports.User = require('./user')
module.exports.Validation = require('./validation')
module.exports.Question = require('./question')
module.exports.Crowd = require('./crowd')
module.exports.Config = require('./config')
module.exports.Voucher = require('./voucher')
module.exports.Chat = require('./chat')
module.exports.Interest = require('./interest')
module.exports.Goal = require('./goal')
module.exports.CouchProfile = require('./couchProfile')
module.exports.CouchVideo = require('./couchVideo')
module.exports.Follower = require('./follower')
module.exports.Comment = require('./comment')
module.exports.Review = require('./review')
module.exports.BookCall = require('./bookCall')
module.exports.CommentReply = require('./commentReply')
module.exports.CrowdsIntersts = require('./crowdsIntersts')
module.exports.CrowdGoals = require('./crowdGoals')
module.exports._Crowd = require('./_crowd')
module.exports.Subscription = require('./subscription')
module.exports.SubscriptionUpdates = require('./subscriptionUpdates')
module.exports.ActivityLog = require('./activityLog')
module.exports.Settings = require('./settings')
module.exports.Wallet = require('./wallet')
module.exports.Withdrawal = require('./withdrawal')
module.exports.NotificationLog = require('./notificationLog')
module.exports.KnowledgeBank = require('./knowledgeBank')