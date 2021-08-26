const mongoose = require('mongoose')
var Schema = mongoose.Schema;

const schema = new mongoose.Schema({
  coachUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
  },
  transferId: {
    type: String,
    required: true, 
  },
  amount: {
    type: Number,
    required: true, 
    default: 0   
  },
  status: {
    type: String,
    required: true,
  },
  createdDate: {
    type: Date,
    required: true,
    default: Date.now    
  },
 })
 
const Withdrawal = mongoose.model('withdrawal', schema)

module.exports = Withdrawal
