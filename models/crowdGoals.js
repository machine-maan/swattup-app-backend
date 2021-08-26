const mongoose = require('mongoose')

const schema = new mongoose.Schema({
    _id: String,
    goalsName: {
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

const crowdGoals = mongoose.model('crowdGoals', schema)

module.exports = crowdGoals