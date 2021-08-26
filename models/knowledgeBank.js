const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const models = require('./');
const configHelper = require('../helpers/configHelper');
var Schema = mongoose.Schema;

const schema = new mongoose.Schema({
    bookingCallId: {
        type: Schema.Types.ObjectId,
        ref: 'BookingCall',
        required: true,
    },
    roomId: {
        type: String,
        required: true,
    },
    compositionId: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        required: false,
        enum: configHelper.KNOWLEDGEBANK_VIDEO_STATUS,
        default: configHelper.KNOWLEDGEBANK_VIDEO_STATUS_ENQUEUED,
    },
    duration: {
        type: Number,
        required: false,
    },
    size: {
        type: Number,
        required: false,
    },
    videoUrl: {
        type: String,
        required: false,
    },
}, {
    timestamps: true,
    versionKey: false,
})

const knowledgeBank = mongoose.model('knowledgeBank', schema)

module.exports = knowledgeBank
