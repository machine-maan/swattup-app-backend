const mongoose = require('mongoose')
var Schema = mongoose.Schema;

const schema = new mongoose.Schema({
  subscriptionCallId: {
    type: String
  },
  coachUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
  },
  debit: {
    type: Number,
    required: true, 
    default: 0   
  },
  credit: {
    type: Number,
    required: true,   
    default: 0  
  },
  currency: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,   
    enum: ['SUBSCRIPTION', 'CALL', 'WITHDRAW']  
  },
  createdDate: {
    type: Date,
    required: true,
    default: Date.now    
  },
 })
 
const Wallet = mongoose.model('wallet', schema)

module.exports = Wallet
