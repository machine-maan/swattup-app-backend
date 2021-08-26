const db = require('../models')
const async = require('async')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId;
const logHelper = require('./logHelper');
const dateHelper = require('./dateHelper');
const bookCallService = require('../services/bookCallService');
const bookResource = require('../resources/bookResource');
const configHelper = require('./configHelper');
const userService = require('../services/userService');
const scheduleJobHelper = require('./scheduleJobHelper');
const paginationHelper = require('./paginationHelper');

function getAsDate(day, time)
{
    var hours = Number(time.match(/^(\d+)/)[1]);
    var minutes = Number(time.match(/:(\d+)/)[1]);
    var AMPM = time.match(/\s(.*)$/)[1];
    if(AMPM == "pm" && hours<12) hours = hours+12;
    if(AMPM == "am" && hours==12) hours = hours-12;
    var sHours = hours.toString();
    var sMinutes = minutes.toString();
    if(hours<10) sHours = "0" + sHours;
    if(minutes<10) sMinutes = "0" + sMinutes;
    time = sHours + ":" + sMinutes + ":00";
    console.log("time", time);
    var d = new Date(day);
    var n = d.toISOString().substring(0,10);
    var newDate = new Date(n+"T"+time);

    return newDate;
}

exports.bookCall = async (req, res) => {
    if (!dateHelper().isTimeGreater(req.body.callTime)) {
        return res.status(422).send({
            status: 422,
            message: "CallTime must be greater than current time",
        })
    }

      const learnerUserId = req.body.learnerUserId
      const coachUserId = req.body.coachUserId
      const title = req.body.title
      const description = req.body.description
      let callDate = null;
        try {
            callDate = dateHelper()
                .merge(req.body.callDate, req.body.callTime);
            callDate = dateHelper().toUtc(callDate);
        } catch(e) {
            return res.status(422).send({
                status: false,
                statusCode: 422,
                message: 'Something wrong with Date & Time ' + e,
            })
        }

        let bookS = await bookCallService.isScheduleBooked(callDate, {
                coachUserId: ObjectId(coachUserId),
        });

        if (bookS) {
            return res.status(422).send({
                status: false,
                statusCode: 422,
                message: 'Coach has already schduled a call for given time-slot',
            })
        }
        
        let bookL = await bookCallService.isScheduleBooked(callDate, {
                learnerUserId: ObjectId(learnerUserId),
        });

        if (bookL) {
            return res.status(422).send({
                status: false,
                statusCode: 422,
                message: 'Learner has already schduled a call for given time-slot',
            })
        }

        const book_call = {
            learnerUserId: learnerUserId,
            coachUserId: coachUserId,
            title: title,
            description: description,
            callDate: callDate,
        }
      db.User.findOne({_id: coachUserId}, function(err, coach_data){
        if(coach_data) {
          book_call.callPrice = coach_data.callPrice 
          db.User.findOne({_id: learnerUserId}, function(err, user_data) {
            if (user_data) {
              db.Subscription.findOne({
                coachUserID: coachUserId,
                learnerUserID: learnerUserId
              }, async function(err, subscription_data){
                
                if(subscription_data){
                  currentDate = new Date();
                //   console.log(subscription_data);
                //   console.log(subscription_data.endDate, currentDate);
                  if(subscription_data.endDate >= currentDate){

                    db.BookCall.create(book_call)
                      .then(function (booked_call) {
                        if (booked_call) {

                            logHelper.log(
                                booked_call.learnerUserId,
                                booked_call._id,
                                'New Call Booked',
                                'CALLBOOK'
                            )
                            // let resBook = booked_call.toJSON();
                            booked_call.coach_data = coach_data;
                            booked_call.user_data = user_data;

                            scheduleJobHelper.notifyOnBookedCallBeforeThirtyMinute(booked_call);
                            scheduleJobHelper.notifyOnBookedCallActive(booked_call);
                            scheduleJobHelper.notifyOnBookedCallMissed(booked_call);
                            console.log('notifyOnBookedCallBeforeFiveMinutesOnCallEnd...');
                            scheduleJobHelper.notifyOnBookedCallBeforeFiveMinutesOnCallEnd(booked_call);

                            return res.status(200).send({
                                status: true,
                                statusCode:200,
                                message: 'Call booked successfully.',
                                responseData: bookResource(booked_call)
                            })
                        }else{
                          return res.status(400).send({
                            status: false,
                            statusCode: 400,
                            message: 'Call not booked.',
                          })
                        }
                        
                      })
                      .catch((err) => {
                        return res.status(500).json({
                          status: 0,
                          message: err.message,
                        })
                      });
                  } else {
                        return res.status(400).send({
                            success: false,
                            message: "Learner's subscription plan is going to end before your given call date-time.",
                            statusCode: 400,
                        })
                  }
                }else{
                    return res.status(400).send({
                        success: false,
                        message: "Learner has not subscribed to his coach.",
                        statusCode: 400,
                    })
                }
              })

            } else {
                return res.status(401).send({
                    status: false,
                    statusCode:401,
                    message:"Learner not found."
                })
            }
          })

        }else{
          res.status(401).send({
            status: false,
            statusCode:401,
            message:"Coach data not found."
          })
        }
      });
}

exports.extendBookCall = async (req, res) => {
    try{
        let bookId;

        try{
            bookId = ObjectId(req.params.bookId);
        } catch(e) {
            throw {
                code: 422,
                msg: 'Invalid BookId',
            };
        }

        let bookDetail = await bookCallService.findOne(bookId);
        if (!bookDetail) {
            throw {
                code: 404,
                msg: 'Booking data not found',
            };
        }
        if (bookDetail.callStatus == configHelper.BOOK_CALL_STATUS_PENDING) {
            let callExtendCount = bookDetail.callExtendCount ? parseInt(bookDetail.callExtendCount) : 0;
            if (callExtendCount >= configHelper.BOOK_CALL_EXTEND_COUNT_LIMIT) {
                throw {
                    code: 400,
                    msg: 'Call already extended',
                };
            }

            let coachDetail = await userService.findOne(bookDetail.coachUserId);
            if (coachDetail) {
                let currentCharge = bookDetail.callPrice ? parseInt(bookDetail.callPrice) : 0;
                let coachCharge = coachDetail.callPrice ? parseInt(coachDetail.callPrice) : 0;
                let latestCharge = currentCharge + coachCharge;
                
                bookCallService.update(bookDetail._id, {
                    callPrice: latestCharge,
                    callExtendCount: callExtendCount + 1,
                });
            } else {
                throw {
                    code: 404,
                    msg: 'Coach not found',
                };
            }
        } else {
            throw {
                code: 400,
                msg: 'It\'s not an on-going booking',
            };
        }

        return res.status(200).send({
            success: true,
            statusCode: 200,
            message: 'Call extended successfully',
        })
    
    } catch(e) {
        return res.status(e.code).send({
            success: false,
            statusCode: e.code,
            message: e.msg,
        })
    }
}

exports.updateBookCallOnGoing = async (req, res) => {
    try{
        let bookId;

        try{
            bookId = ObjectId(req.params.bookId);
        } catch(e) {
            throw {
                code: 422,
                msg: 'Invalid BookId',
            };
        }

        bookCallService.update(bookId, {
            callStatus: configHelper.BOOK_CALL_STATUS_ONGOING
        });

        return res.status(200).send({
            success: true,
            statusCode: 200,
            message: 'Call status updated successfully',
        })
    
    } catch(e) {
        return res.status(e.code).send({
            success: false,
            statusCode: e.code,
            message: e.msg,
        })
    }
}

exports.getAllBookings = async (req, res) => {
    let query = {};
    const requestUserId = req.user._id;

    if (req.user.type == configHelper.USER_TYPE_LEARNER) {
        query.learnerUserId = requestUserId;
    } else {
        query.coachUserId = requestUserId;
    }

    let bookingList = await bookCallService.getAll(query, [], true, paginationHelper(req));

    return res.status(200).send({
        success: true,
        statusCode: 200,
        message: 'Bookings fetched successfully',
        data: bookingList.data,
        metadata: bookingList.metadata,
    })
}

exports.getUpcomingBookings = async (req, res) => {
    let baseQuery = {};
    const requestUserId = req.user._id;

    if (req.user.type == configHelper.USER_TYPE_LEARNER) {
        baseQuery.learnerUserId = requestUserId;
    } else {
        baseQuery.coachUserId = requestUserId;
    }

    let dateNow = dateHelper('').now();
    let minusThirty = dateHelper('').subtract(dateNow, configHelper.BOOK_CALL_TIME_LIMIT);
    query = {
        callDate: { $gt: minusThirty.toDate() },
        callStatus: { $eq: configHelper.BOOK_CALL_STATUS_PENDING } ,
        ...baseQuery,
    };

	let bookingList = await bookCallService.getAll(query, [], true, paginationHelper(req));

    if (bookingList.data.length) {
        let latestBookigData = await bookCallService.getAll({
            callDate: { $lt: new Date(), $gt: minusThirty.toDate() },
            callStatus: { $eq: configHelper.BOOK_CALL_STATUS_PENDING },
            ...baseQuery,
        });

        if (latestBookigData.length) {
            latestBookigData = latestBookigData[0];
            await Promise.all(
                bookingList.data = bookingList.data.map(e => {
                    let flag = 0;
                    if (e._id.toString() == latestBookigData._id.toString()) {
                       flag = 1;
                    }

                    return {
                        ...e,
                        flag: flag,
                    };
                })
            )
        }
    }

    return res.status(200).send({
        success: true,
        statusCode: 200,
        message: 'Upcoming Bookings fetched successfully',
        data: bookingList.data,
        metadata: bookingList.metadata,
    });
}

exports.getPastBookings = async (req, res) => {
    let query = {};
    const requestUserId = req.user._id;

    if (req.user.type == configHelper.USER_TYPE_LEARNER) {
        query.learnerUserId = requestUserId;
    } else {
        query.coachUserId = requestUserId;
    }

    let minusThirty = dateHelper('').subtract(dateHelper('').now(), configHelper.BOOK_CALL_TIME_LIMIT);
    query.callDate = {
        $lt: minusThirty.toDate(),
    };

	let bookingList = await bookCallService.getAll(query, [], true, paginationHelper(req));

    return res.status(200).send({
        success: true,
        statusCode: 200,
        message: 'Past Bookings fetched successfully',
        data: bookingList.data,
        metadata: bookingList.metadata,
    });
}


exports.getLearnerAllBookings = async (req, res) => {
    return res.status(400).send({
        success: false,
        statusCode: 400,
        message: 'API Deprecated',
    });
}

exports.getLearnerPastBookings = async (req, res) => {
    return res.status(400).send({
        success: false,
        statusCode: 400,
        message: 'API Deprecated',
    });
}

exports.getLearnerUpcomingBookings = async (req, res) => {
    return res.status(400).send({
        success: false,
        statusCode: 400,
        message: 'API Deprecated',
    });
}


exports.getCoachAllBookings = async (req, res) => {
    return res.status(400).send({
        success: false,
        statusCode: 400,
        message: 'API Deprecated',
    });
}

exports.getCoachPastBookings = async (req, res) => {
    return res.status(400).send({
        success: false,
        statusCode: 400,
        message: 'API Deprecated',
    });
}

exports.getCoachUpcomingBookings = async (req, res) => {
    return res.status(400).send({
        success: false,
        statusCode: 400,
        message: 'API Deprecated',
    });
}