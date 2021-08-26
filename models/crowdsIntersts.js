const mongoose = require('mongoose')

const schema = new mongoose.Schema({
    _id: String,
    interestName: {
        type: String,
    },
    image: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    versionKey: false,
})

const CrowdsIntersts = mongoose.model('crowdInterst', schema)

module.exports = CrowdsIntersts
