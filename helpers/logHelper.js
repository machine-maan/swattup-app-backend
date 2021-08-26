const mongoose = require('mongoose');
const notificationHelper = require('./notificationHelper');
const db = require('../models')

async function log(userId, UniqueId, Activity, type) {
    db.User
        .findOne({ _id: userId }, async function (err, user_data) {
        if (user_data) {
            var logData = {
                userId: userId,
                uniqueId: UniqueId,
                activity: Activity,
                type: type,
                date: new Date().toISOString(),
            }
            db.ActivityLog
                .create(logData)
                .then((logResponse) => {
                    notificationHelper.send(userId, UniqueId, Activity, type);
                })
                .catch((error) => {
                    console.log(error)
                    return false
                })
            ;
        } else {
            console.log('user_data not found')
            return false
        }
    })
}

module.exports = {
    log: log,
}