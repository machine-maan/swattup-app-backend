var cron = require('node-cron');
const userService = require('../services/userService');
const notificationHelper = require('./notificationHelper');

// function notification() {
//     notificationHelper.notifyBeforeThirtyMinutesOfCoachCall();
// }

function emailVerificationCount() {
    userService.setEmailVerificationCountToZero();
}

// function everyThirtyMinutes() {
//     cron.schedule('0 */15 * * * *', () => {
//         console.log('Running a task every 15 minutes:------' + new Date);
        
//         notification();
//     });
// }

function everyNight() {
    cron.schedule('00 00 12 * * 0-6', () => {
        console.log('Running a task every 12 AM:------' + new Date);

        emailVerificationCount();
    });
}

// function everyFiveMinutes() {
//     cron.schedule('0 */5 * * * *', () => {
//         console.log('Running a task every 5 minutes:------' + new Date);
        
//         // notificationHelper.notifyIfBookedCallMissed();
//     });
// }

module.exports = () => {
    // everyThirtyMinutes();
    everyNight();
    // everyFiveMinutes();
}