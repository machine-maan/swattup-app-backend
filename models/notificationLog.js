const mongoose = require('mongoose')
const models = require('./')
var Schema = mongoose.Schema;

const schema = new mongoose.Schema({
    fromUser: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    toUser: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    deviceToken: {
        type: String,
    },
    uniqueId: {
        type: String,
    },
    type: {
        type: String
    },
    route: {
        type: String
    },
    title: {
        type: String
    },
    description: {
        type: String
    },
    extraData: {
        type: Object
    },
    date: {
        type: String,
        default: Date.now
    },
 })
 
const NotificationLog = mongoose.model('NotificationLog', schema)

module.exports = NotificationLog
