// let moment = require('moment');
var moment = require('moment-timezone');
let globalHelper = require('./globalHelper');

// class Datehelper {
//     constructor(tz = null) {
//         if (tz) {
//             this.timezone = tz;
//         } else {
//             this.timezone = process.env.APP_TIMEZONE ? process.env.APP_TIMEZONE : '';
//         }
//     }

//     now() {
//         return moment().tz(this.timezone).format();
//     }
// }

module.exports = function(tz = null) {
    // let timezone = tz ? tz : (process.env.APP_TIMEZONE ? process.env.APP_TIMEZONE : '');
    let authUser = globalHelper.authUser ? globalHelper.authUser : '';
    let timezone = tz ? tz : (authUser.timezone ? authUser.timezone : '');

    // console.log('authUser....', authUser);
    return {
        moment: () => {
            return moment.tz(timezone);
        },
        now: (format = null) => {
            // console.log('moment.tz().format()..', moment.tz('').format());
            // let date = moment.tz(moment.tz('').format(), 'Asia/Kolkata');
            let date = moment.tz(timezone);

            if (format) {
                return date.format(format);
            }

            return date.format();
        },
        convert: (date) => {
            // console.log('timezone....', timezone);
            return moment.tz(date, timezone).format();
        },
        date: (rDate, pattern) => {
            return moment.tz(rDate, pattern, timezone).format();
        },
        toUtc: (date) => {
            return moment.tz(date, '').format();
        },
        isDateTimeGreater: (rDate, compareDate = null) => {
            let startTime = moment.tz(rDate, timezone);
            if (compareDate) {
                var endTime = moment.tz(compareDate, timezone);
            } else {
                var endTime = moment.tz(timezone);
            }

            return startTime.isAfter(endTime); // TRUE when startTime greater than endTime
        },
        isTimeGreater: (rTime, pattern = 'h:mm A') => {
            let beginTime = moment.tz(rTime, pattern, timezone);
            var endTime = moment.tz(timezone);

            return beginTime.isAfter(endTime);
        },
        merge: (fDate, stime, pattern = 'YYY-MM-DD,h:mm A') => {
            let patternSplit = pattern.split(',');
            let date = moment.tz(fDate, patternSplit[0], timezone).format(patternSplit[0]);
            let time = moment.tz(stime, patternSplit[1], timezone).format(patternSplit[1]);

            return moment.tz(date + ' ' + time, patternSplit[0] + ' ' + patternSplit[1], timezone).format();
        },
        add: (date, minutes) => {
            return moment.tz(date, '').add(minutes, 'minutes');
        },
        subtract: (date, minutes) => {
            return moment.tz(date, '').subtract(minutes, 'minutes');
        },
        toEpoch: (date) => {
            return moment.tz(date, timezone).valueOf();
        },
        // toUtc: (date) {
        //     return .format()
        // },
    }
}
// var moment = require('moment-timezone');
// const timezone = process.env.APP_TIMEZONE;

// function now() {
//     // return new Date().toLocaleString('en-US', { timeZone: timezone });
//     let now = moment();

//     // console.log(timezone, now.format());
//     // console.log('UTC', now.utc().format());

//     // let toronto = moment.tz(now, 'America/Toronto');
//     // console.log('toronto', toronto.format());
//     // console.log('UTC', toronto.utc().format());

//     return now;
// }

// module.exports = {
//     now: now,
// }