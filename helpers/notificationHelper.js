const mongoose = require('mongoose');
const TYPE_QUESTION = 'QUESTION';
const bookCallService = require('../services/bookCallService');
const followerService = require('../services/followerService');
const questionService = require('../services/questionService');
const subscribtionService = require('../services/subscribtionService');
const userService = require('../services/userService');
const configHelper = require('./configHelper');
const globalHelper = require('./globalHelper');
const notifications = require('./notifications')
const bookResource = require('../resources/bookResource');
const notificationLogService = require('../services/notificationLogService');

function send(userId, UniqueId, Activity, type) {
    switch (type) {
        case TYPE_QUESTION:
            notifyQuestion(UniqueId, userId, Activity);
            break;

        case 'FOLLOW':
            notifyFollower(UniqueId, userId, Activity);
            break;

        case 'SUBSCRIBE':
            notifySubscriber(UniqueId, userId, Activity);
            break;

        case 'COACH-SIGNUP':
            notifyNewCoachSignup(UniqueId, userId, Activity);
            break;

        case 'CALLBOOK':
            notifyNewBookedCall(UniqueId, userId, Activity);
            break;

        case 'ADDVIDEO':
            notifyAddedNewVideo(UniqueId, userId, Activity);
            break;

        default:
            break;
    }
}

async function notifyQuestion(questionId, userId, activity) {
    let tokens = [];
    let title = TYPE_QUESTION;
    let route = 'Business';
    let uniqueId = questionId;
    let questionData = await questionService.findOne(questionId);
    let userData = await userService.findOne(userId);
    let crowdDetail = await userService.getCrowdDetailById(questionData.crowdID);
    let extraData = {};

    switch (activity) {
        case 'Posted a question':
            uniqueId = questionData.crowdID; // Crowd-id
            extraData['questionId'] = questionId;
            extraData['crowdName'] = crowdDetail.name ? crowdDetail.name : '';
            extraData['questionTitle'] = questionData.title;
            extraData['questionDesc'] = questionData.description;
            activity = userData.username + ' posted a question in ' + crowdDetail.name;
            tokens = await postedQuestion(userId);
            break;

        case 'Posted an answer':
            title = 'ANSWER';
            route = 'crowdthread';
            activity = userData.username + ' just answered your question';
            extraData['crowdName'] = crowdDetail.name ? crowdDetail.name : '';
            extraData['questionTitle'] = questionData.title;
            extraData['questionDesc'] = questionData.description;
            tokens = await postedAnswer(questionData, userId);
            break;

        case 'Upvoted an answer':
            title = 'ANSWER';
            route = 'crowdthread';
            activity = userData.username + '- Upped an answer to your question';
            tokens = await upvotedAnswer(questionData, userId);
            break;

        default:
            break;
    }

    notify(tokens, activity, questionData.title, {
        uniqueId: uniqueId,
        type: title,
        route: route,
        extraData: extraData,
    });
}

async function postedQuestion(userId) {
    let userList = [];

    //Get All subscribed learner s
    let learners = await subscribtionService.getLearners(userId, {
        'learnerUserID': 1,
    });
    learners = learners.map(e => e.learnerUserID.toString());

    //Get All subscribed Coaches
    let coaches = await subscribtionService.getCoaches(userId, {
        'coachUserID': 1,
    });
    coaches = coaches.map(e => e.coachUserID.toString());
    userList = learners.concat(coaches);

    //Interest-Goals related users
    const userIds = await userService.getAllInterestAndGoalRelatedUser(userId);
    userList = userList.concat(userIds);

    //Get All followers
    let followers = await followerService.getFollowers(userId);
    userList = userList.concat(followers);

    return await getAllToken(userList, userId);
}

async function postedAnswer(questionData, userId) {
    let userList = []
    let question = questionData;
    userList.push(question.userID.toString());

    //Get Users from Quesion's Answers, Comments & Upvotes
    if (question.answers) {
        question.answers.forEach(element => {
            userList.push(element.userID.toString());
            //Comment's Users
            if (element.comments) {
                element.comments.forEach(cElement => {
                    userList.push(cElement.userID.toString());
                });
            }
            //Upvote's Users
            if (element.upvotes) {
                element.upvotes.forEach(uElement => {
                    userList.push(uElement.userID.toString());
                });
            }
        });
    }

    //Get followers
    let followers = await followerService.getFollowers(userId);
    userList = userList.concat(followers);

    return await getAllToken(userList, userId);
}

async function upvotedAnswer(questionData, userId) {
    let userList = [];
    let question = questionData;
    userList.push(question.userID.toString());

    //Get Users from Quesion's Answers
    if (question.answers) {
        question.answers.forEach(element => {
            userList.push(element.userID.toString());
        });
    }

    return await getAllToken(userList);
}

async function notifyFollower(followerId, userId, activity) {
    let tokens = [];
    if (activity === 'Following') {
        let route = 'StudentProfile';

        let userData = await userService.findOne(followerId);
        if (userData.type === configHelper.USER_TYPE_PROFESSIONAL) {
            route = 'coachProfile';
        }

        tokens = await getAllToken([
            userId,
        ]);

        notify(tokens, 'Congratulations! You have a new follower', userData.username + ' just followed you', {
            uniqueId: followerId,
            type: activity,
            route: route,
        });
    }
}

async function notifySubscriber(subscribeTableId, learnerId, activity) {
    const result = await subscribtionService.findOne(subscribeTableId);
    if (!result) {
        return false;
    }

    let userData = await userService.findOne(result.learnerUserID);
    let tokens = await getAllToken([
        result.coachUserID.toString(),
    ]);

    notify(tokens, 'New subscriber alert!', userData.username + ' just subscribed to your channel', {
        uniqueId: result.learnerUserID,
        type: 'SUBSCRIBE',
        route: 'StudentProfile',
    });
}

async function notifyNewCoachSignup(userId, userTableId, activity) {
    const userIds = await userService.getAllInterestAndGoalRelatedUser(userId);
    let tokens = await getAllToken(userIds, userId);
    let userData = await userService.findOne(userId);

    notify(tokens, 'A coach that matches your interests / goals just signed up', userData.username + ' just signed up - go check out their profile', {
        uniqueId: userTableId,
        type: 'COACH-SIGNUP',
        route: 'coachProfile'
    });
}

async function notifyNewBookedCall(callBookId, learnerId, activity) {
    const callBookData = await bookCallService.findOne(callBookId);
    let tokens = await getAllToken([
        // callBookData.learnerUserId.toString(),
        callBookData.coachUserId.toString(),
    ]);
    let userData = await userService.findOne(callBookData.learnerUserId);

    notify(tokens, 'New call booked', userData.username + ' just booked a call with you. Find a link to the call in your feed', {
        uniqueId: callBookId,
        type: 'CALLBOOK',
        route: 'bookASchedule',
    });
}

async function notifyAddedNewVideo(videoTableId, userId, activity) {
    let userList = [];

    let userData = await userService.findOne(userId);
    let learners = await subscribtionService.getLearners(userId, {
        'learnerUserID': 1,
    });
    userList = learners.map(e => e.learnerUserID.toString());

    //Get followers
    let followers = await followerService.getFollowers(userId);
    userList = userList.concat(followers);

    let tokens = await getAllToken(userList);
    notify(tokens, userData.username + ' just posted a new video', 'check it out today', {
        uniqueId: videoTableId,
        type: 'ADDVIDEO',
        route: 'coachLocked',
    });
}

/**
 * Cron Notification
 */
async function notifyBeforeThirtyMinutesOfCoachCall(bookedData) {
    // const userIds = await bookCallService.getNextThirtyMinutes();
    let tokens = await getAllToken([
        bookedData.learnerUserId.toString(),
    ], null, false);

    notify(tokens, 'Coach call in 30 mins', 'Your call with ' + bookedData.coach_data.username + ' begins in 30 mins. Please go to your feed to start the call', {
        uniqueId: null,
        type: 'BOOK-CALL',
    });
}
// async function notifyIfBookedCallMissed() {
//     const userIds = await bookCallService.getMissedCall();
//     let tokens = await getAllToken(userIds, null, false);

//     notify(tokens, 'BOOK-CALL', 'You missed the schedule call', {
//         uniqueId: null,
//         type: 'BOOK-CALL',
//     });
// }
async function notifyOnBookedCallMissed(bookedData) {
    let tokens = await getAllToken([
        // bookedData.coachUserId.toString(),
        bookedData.learnerUserId.toString(),
    ], null, false);
    let userData = await userService.findOne(bookedData.coachUserId);
    let coachName = userData.username;

    bookCallService.update(bookedData._id, {
        callStatus: configHelper.BOOK_CALL_STATUS_MISSED,
    });

    notify(tokens, 'Sorry we missed you', 'You missed your scheduled call with ' + coachName + '. Please message ' + coachName + ' if you’d like to reschedule', {
        uniqueId: null,
        type: 'BOOK-CALL-MISSED',
    });
}

async function notifyOnBookedCallActive(bookedData) {
    const notifData = await notificationLogService.count({
        uniqueId: bookedData._id.toString(),
        type: 'BOOK-CALL-ACTIVE',
    });

    if (!notifData) {
        let coachTokens = await getAllToken([
            bookedData.coachUserId.toString(),
        ], null, false);

        let studentTokens = await getAllToken([
            bookedData.learnerUserId.toString(),
        ], null, false);

        notify(coachTokens, 'Booked call active', 'Please open the app now and call your learner', {
            uniqueId: bookedData._id.toString(),
            type: 'BOOK-CALL-ACTIVE',
            route: 'BOOK-CALL-ACTIVE',
            extraData: {
                ...bookResource(bookedData)
            }
        });
        notify(studentTokens, 'Booked call active', 'Please open the app now and call your coach', {
            uniqueId: bookedData._id.toString(),
            type: 'BOOK-CALL-ACTIVE',
            route: 'BOOK-CALL-ACTIVE',
            extraData: {
                ...bookResource(bookedData)
            }
        });
    }
}

async function notifyOnBookedCallBeforeFiveMinutesOnCallEnd(bookedData) {
    let tokens = await getAllToken([
        bookedData.coachUserId.toString(),
        bookedData.learnerUserId.toString(),
    ], null, false);

    notify(tokens, 'Your ongoing-call will end soon', 'Your call is going to end in 5 minutes.', {
        uniqueId: null,
        type: 'BOOK-CALL-END-SOON',
    });
}
/**
 * END Cron Notification
 */

async function notifyOnVideoRecordingReady(knowledgeBankData) {
    if (knowledgeBankData) {
        let bookedData = await bookCallService.findOne(knowledgeBankData.bookingCallId);
        let tokens = await getAllToken([
            bookedData.coachUserId.toString(),
            bookedData.learnerUserId.toString(),
        ], null, false);

        notify(tokens, 'Video recording', 'Your video-call recording is available to view in knowhow', {
            uniqueId: bookedData._id.toString(),
            type: 'VIDEO-CALL-RECORDING-READY',
            route: 'know',
            // extraData: {
            //     ...bookResource(bookedData)
            // }
        });
        console.log('>>>>>>>>>>>>>>> Vide-recording-ready Notification Sent!!!');
    } else {
        console.log('knowledgeBankData not available!!!');
    }
}

function getFilteredUserList(userList, userId = null, withoutAuthUser = true) {
    if (!userList) {
        return [];
    }

    //Prevent duplication
    userList = userList.filter(function (e, i, c) {
        return c.indexOf(e) === i;
    });

    //Remove notif user
    if (userId) {
        var userIndex = userList.indexOf(userId);
        userList.splice(userIndex, 1);
    }

    //Remove self user
    if (withoutAuthUser && globalHelper.authUser) {
        var userIndex = userList.indexOf(globalHelper.authUser._id.toString());
        userList.splice(userIndex, 1);
    }

    return userList;
}

async function getAllToken(userList, userId = null, withoutAuthUser = true) {
    if (!userList) {
        return [];
    }

    let userFilteredList = getFilteredUserList(userList, userId, withoutAuthUser);
    console.log('Notification result.....', userFilteredList);

    return await userService.getUserDeviceTokens(userFilteredList);
}

function notify(tokens, title, body, typeDetail) {
    tokens.forEach(element => {
        notifications.send(element, title, body, typeDetail);
    });
}

module.exports = {
    TYPE_QUESTION: TYPE_QUESTION,
    send: send,
    notify: notify,
    notifyBeforeThirtyMinutesOfCoachCall: notifyBeforeThirtyMinutesOfCoachCall,
    // notifyIfBookedCallMissed: notifyIfBookedCallMissed,
    notifyOnBookedCallActive: notifyOnBookedCallActive,
    notifyOnBookedCallMissed: notifyOnBookedCallMissed,
    notifyOnVideoRecordingReady: notifyOnVideoRecordingReady,
    notifyOnBookedCallBeforeFiveMinutesOnCallEnd: notifyOnBookedCallBeforeFiveMinutesOnCallEnd,
}