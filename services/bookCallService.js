const mongoose = require('mongoose');
const configHelper = require('../helpers/configHelper');
const dateHelper = require('../helpers/dateHelper');
const db = require('../models');
const bookResource = require('../resources/bookResource');
const baseService = require('./baseService')
const ObjectId = mongoose.Types.ObjectId;
const model = db.BookCall;
baseService.model = model;

function getNextThirtyMinutes() {
    var dt = new Date();
    let plusThirtyMinutes = dt.setMinutes(dt.getMinutes() + configHelper.BOOK_CALL_TIME_LIMIT);

    return model
        .aggregate([
            {
                $match: {
                    callDate: {
                        $gte: new Date(),
                        $lte: new Date(plusThirtyMinutes)
                    }
                }
            },
        ])
        .then(learnerList => {
            if (learnerList) {
                return learnerList.map(e => e.learnerUserId.toString());
            }

            return [];
        })
    ;
}

async function isScheduleBooked(date, match) {
    // let plusThirty = dateHelper('').add(date, configHelper.BOOK_CALL_TIME_LIMIT);
    let minutes = configHelper.BOOK_CALL_TIME_LIMIT * 60000;

    return model
        .aggregate([
            {
                "$addFields": { 
                    "endCalldate": {
                        $add: ['$callDate', minutes] // adding minutes in callDate
                    }, 
                }
            },
            {
                $match: {
                    callDate: {
                        $lte: new Date(date),
                    },
                    endCalldate:  {
                        $gte: new Date(date),
                    },
                    ...match,
                }
            },
        ])
        .then(bookedList => {
            if (bookedList.length) {
                return true;
            }

            return false;
        })
    ;
}

async function getAll(match = {}, query = [], withResource = true, pagination = null) {
    baseService.model = db.BookCall;
    let bookingData = await baseService.aggregate([
            {
                $lookup:
                {
                    from: "users",
                    localField: "coachUserId",
                    foreignField: "_id",
                    as: "coach_data"
                }
            },
            { $unwind: '$coach_data' },
            {
                $lookup:
                {
                    from: "users",
                    localField: "learnerUserId",
                    foreignField: "_id",
                    as: "user_data"
                }
            },
            { $unwind: '$user_data' },
            {
                $match: match,
            },
            {
                $sort: { 'callDate': 1 }
            },
            ...query
        ], pagination);

        if (bookingData) {
            if (pagination) {
                response = bookingData.data
            } else {
                response = bookingData;
            }

            response = response.map(e => {
                if (withResource) {
                    return bookResource(e)
                }
                
                return e;
            });

            if (pagination) {
                bookingData.data = response;
                
                return bookingData;
            }

            return response;
        }

        return [];
}

async function getLatestBooking(user1 = null, user2 = null) {
    let matchQ = {};
    if (user1 && user2) {
        if (user1.type != user2.type) {
            if (user1.type == configHelper.USER_TYPE_LEARNER) {
                matchQ['learnerUserId'] = user1._id;
            } else {
                matchQ['coachUserId'] = user1._id;
            }
    
            if (user2.type == configHelper.USER_TYPE_LEARNER) {
                matchQ['learnerUserId'] = user2._id;
            } else {
                matchQ['coachUserId'] = user2._id;
            }
        } else {
            return [];
        }
    }

    let dateNow = dateHelper('').now();
    let minusThirty = dateHelper('').subtract(dateNow, configHelper.BOOK_CALL_TIME_LIMIT);
    matchQ['callDate'] = {
        $lte: new Date(),
        $gt: minusThirty.toDate(),
    };
    matchQ['callStatus'] = {
        $ne: configHelper.BOOK_CALL_STATUS_COMPLETED,
    };

    return getAll(matchQ);
}

async function getMissedCall() {
    let minusThirty = dateHelper('').subtract(dateHelper('').now(), configHelper.BOOK_CALL_TIME_LIMIT + 1);
    
    return model
        .aggregate([
            {
                $match: {
                    callDate: {
                        $lte: minusThirty.toDate(),
                    },
                    callStatus: configHelper.BOOK_CALL_STATUS_PENDING,
                },
            },
        ])
        .then(async learnerList => {
            if (learnerList && learnerList.length) {
                let ids = [];
                let userIds = [];
                Promise.all(
                    learnerList.map(async (e) => {
                        ids.push(e._id);
                        userIds.push(e.learnerUserId.toString());
                        userIds.push(e.coachUserId.toString());
                        this.update(e._id, {
                            callStatus: configHelper.BOOK_CALL_STATUS_MISSED,
                        });
                    })
                )

                return userIds;
            }

            return [];
        })
    ;
}

module.exports = {
    ...baseService,
    getNextThirtyMinutes: getNextThirtyMinutes,
    getAll: getAll,
    isScheduleBooked: isScheduleBooked,
    getLatestBooking: getLatestBooking,
    getMissedCall: getMissedCall,
}