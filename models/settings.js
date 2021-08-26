const mongoose = require('mongoose')

const schema = new mongoose.Schema({
    app_version: {
        type: String,
    },
 })
 
const Settings = mongoose.model('Settings', schema)

module.exports = Settings
