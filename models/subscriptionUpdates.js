var mongoose = require('mongoose')
var Schema = mongoose.Schema;

var schema = new mongoose.Schema({
  stripeSubscriptionId: String,
  eventId: String,
  startDate: Date,
  endDate: Date,
  status: String,
  type: String,
  created: {
    type: Date,
    default: Date.now 
  }
})

var SubscriptionUpdates = mongoose.model('SubscriptionUpdates', schema)

module.exports = SubscriptionUpdates
