const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const models = require('./');
const configHelper = require('../helpers/configHelper');
var Schema = mongoose.Schema;

const schema = new mongoose.Schema({
    learnerUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    coachUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    callDate: {
        type: Date,
        required: true,
    },
    callPrice: {
        type: Number,
        default: 0,
    },
    bookDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    callStatus: {
        type: String,
        enum: configHelper.BOOK_CALL_STATUS,
        default: configHelper.BOOK_CALL_STATUS_PENDING,
        required: true,
    },
    chargeId: {
        type: String,
    },
    chargeStatus: {
        type: String,
        enum: configHelper.BOOK_CHARGE_STATUS,
        default: configHelper.BOOK_CHARGE_STATUS_PENDING,
        required: true,
    },
    chargeCurrency: {
        type: String,
    },
    callExtendCount: {
        type: Number,
        default: 0,
        required: false,
    }
})

schema.index({ learnerUserId: 1, coachUserId: 1, callDate: 1 });

const bookCall = mongoose.model('bookingCall', schema)

module.exports = bookCall
