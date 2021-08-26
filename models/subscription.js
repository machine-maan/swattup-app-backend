var mongoose = require('mongoose')
var Schema = mongoose.Schema;

var schema = new mongoose.Schema({
  coachUserID: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  learnerUserID: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  stripeSubscriptionId: String,
  subscriptionAmount: String,
  subscriptionCurrency: String,
  subscriptionDate: Date,
  unSubscriptionDate: Date,
  startDate: Date,
  endDate: Date,
  isActive:Boolean
})

var Subscription = mongoose.model('Subscription', schema)

module.exports = Subscription
