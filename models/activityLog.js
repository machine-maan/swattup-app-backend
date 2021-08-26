const mongoose = require('mongoose')
const models = require('./')
var Schema = mongoose.Schema;

const schema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    uniqueId: {
        type: String,
    },
    activity: {
        type: String
    },
    type: {
        type: String
    },
    date: {
        type: String
    },
 })
 
const ActivityLog = mongoose.model('ActivityLog', schema)

module.exports = ActivityLog
