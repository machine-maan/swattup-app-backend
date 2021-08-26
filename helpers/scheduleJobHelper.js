const schedule = require('node-schedule');
const bookCallService = require('../services/bookCallService');
const configHelper = require('./configHelper');
const dateHelper = require('./dateHelper');
const notificationHelper = require('./notificationHelper');
const videoCall = require('./videoCall');

function notifyOnBookedCallActive(booked_call) {
    const job = schedule.scheduleJob(booked_call.callDate, function(bookingData){
        console.log(bookingData.title + ': Notify!!!!!!!!!!!!');
        notificationHelper.notifyOnBookedCallActive(bookingData)
    }.bind(null, booked_call));
}

async function notifyOnBookedCallMissed(booked_call) {
    let callEndDate = dateHelper('').add(booked_call.callDate, configHelper.BOOK_CALL_TIME_LIMIT + 1);

    const missed_job = schedule.scheduleJob(callEndDate.format(), async function(bookingId) {
        let bookingData = await bookCallService.findOne(bookingId);
        if (bookingData.callStatus == configHelper.BOOK_CALL_STATUS_PENDING) {
            console.log(bookingData.title + ': Missed schedule Notify!!!!!!!!!!!!');
            notificationHelper.notifyOnBookedCallMissed(bookingData)
        } else if (bookingData.callStatus == configHelper.BOOK_CALL_STATUS_ONGOING) {
            console.log(bookingData.title + ': Complete schedule Notify!!!!!!!!!!!!');
            //Update Room
            let roomDetail = await videoCall.getRoomByName(bookingData._id.toString());
            console.log('roomDetail........>>>>>>>>>>.....', roomDetail);
            if (roomDetail) {
                videoCall.updateRoomCommon(roomDetail.sid, {
                    status: 'completed',
                });
                bookCallService.update(bookingData._id, {
                    callStatus: configHelper.BOOK_CALL_STATUS_COMPLETED,
                });
                console.log('ROOM UPDATED........>>>>>>>>>>.....');
            }   
        }
    }.bind(null, booked_call._id));
}

function notifyOnBookedCallBeforeThirtyMinute(booked_call, minutes = 30) {
    let dateNow = dateHelper('').now();
    let notiftime = dateHelper('').subtract(booked_call.callDate, minutes);

    if (dateHelper('').isDateTimeGreater(dateNow, notiftime)) {
        const job = schedule.scheduleJob(notiftime.format(), function(bookingData){
            console.log('Notify before 30 minutes ....!!!!!!!!!!!!');
            notificationHelper.notifyBeforeThirtyMinutesOfCoachCall(bookingData);
        }.bind(null, booked_call));
    }
}

async function notifyOnBookedCallBeforeFiveMinutesOnCallEnd(booked_call) {
    console.log('>>> Inn....');
    let dateNow = dateHelper('').now();
    let notifMinutes = configHelper.BOOK_CALL_TIME_LIMIT - 5;
    let notiftime = dateHelper('').add(booked_call.callDate, notifMinutes);

    console.log('>>> Before Five Minutes....');
    if (dateHelper('').isDateTimeGreater(notiftime, dateNow)) {
        console.log('==========', '=========');
        console.log('>>> isDateTimeGreater....', notiftime);
        console.log('==========', '=========');
        const job = schedule.scheduleJob(notiftime.format(), async function(bookingId){
            console.log('Notify before 5 minutes on Call End ....!!!!!!!!!!!!');

            let bookingData = await bookCallService.findOne(bookingId);
            if (bookingData.callStatus == configHelper.BOOK_CALL_STATUS_ONGOING) {
                console.log('Notify before 5 minutes on Call End >>> Notified');
                notificationHelper.notifyOnBookedCallBeforeFiveMinutesOnCallEnd(bookingData);
            }
        }.bind(null, booked_call._id));
    } else {
        console.log('>>> not isDateTimeGreater....');
    }
}

module.exports = {
    notifyOnBookedCallActive: notifyOnBookedCallActive,
    notifyOnBookedCallMissed: notifyOnBookedCallMissed,
    notifyOnBookedCallBeforeThirtyMinute: notifyOnBookedCallBeforeThirtyMinute,
    notifyOnBookedCallBeforeFiveMinutesOnCallEnd: notifyOnBookedCallBeforeFiveMinutesOnCallEnd,
}