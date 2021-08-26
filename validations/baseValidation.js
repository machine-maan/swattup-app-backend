const Joi = require('joi');
const validateRequest = require('../middleware/validate-request');
const crowdGoalService = require('../services/crowdGoalService');
const crowdInterestService = require('../services/crowdInterestService');
const userService = require('../services/userService');
const regPattern = {
    alphaSpace : [
        new RegExp(/^[a-zA-Z ]*$/),
        'Alpha characters',
    ],
    alphaNumSpace : [
        new RegExp(/^[a-zA-Z0-9 ]*$/),
        'Alpha characters',
    ]
};
// function chunkArray(myArray, chunk_size){
//     var index = 0;
//     var arrayLength = myArray.length;
//     var tempArray = [];
    
//     for (index = 0; index < arrayLength; index += chunk_size) {
//         myChunk = myArray.slice(index, index+chunk_size);
//         // Do something if you want with the group
//         tempArray.push(myChunk);
//     }

//     return tempArray;
// }

// const helper = {
//     isExist: (modelService, matchKey = null) => {
//         return async (value, helper) => {
//             let cnd = {};
//             let primaryKey = '_id';
//             if (matchKey) {
//                 let matchKeyList = matchKey.split(',');
//                 if (!matchKeyList.length % 2) {
//                     primaryKey = matchKeyList[0];
//                     matchKeyList.shift();
//                 }
//                 cnd[primaryKey] = value;

//                 let chunkList = chunkArray(matchKeyList, 2);
//                 chunkList.forEach((value) => {
//                     if (value.length === 2) {
//                         cnd[value[0]] = value[1];
//                     }
//                 });
//             } else {
//                 cnd[primaryKey] = value;
//             }

//             const exists = await modelService.isExist(cnd);
//             if (exists) {
//                 return value;
//             }

//             return helper.message("Email already exist")

//             // throw Error('Invalid input');
//             // throw new Error('khnjhj');
//             // return helpers.error("any.invalid");
//         }
//     },
// }

function login(req, res, next) {
    const schema = Joi.object({
        deviceToken: Joi.string(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).max(18).required(), //https://stackoverflow.com/questions/19605150/regex-for-password-must-contain-at-least-eight-characters-at-least-one-number-a
    });

    validateRequest(req, res, next, schema);
}

function updateDeviceToken(req, res, next) {
    const schema = Joi.object({
        deviceToken: Joi.string().required(),
    });

    validateRequest(req, res, next, schema);
}

function createCouchProfile(req, res, next) {
    const schema = Joi.object({
        userId: Joi.string().required(),
        title: Joi.string(),
        username: Joi.string().regex(...regPattern.alphaNumSpace),
        description: Joi.string(),
        subscriptionPrice: Joi.number(),
        callPrice: Joi.number(),
        aboutMe: Joi.string(),
        linkdinProfileUrl: Joi.string().allow(''),
        facebookProfileUrl: Joi.string().allow(''),
        twitterProfileUrl: Joi.string().allow(''),
        instagramProfileUrl: Joi.string().allow(''),
    });

    validateRequest(req, res, next, schema);
}

function editUserProfile(req, res, next) {
    const schema = Joi.object({
        id: Joi.string().required(),
        title: Joi.string(),
        username: Joi.string().regex(...regPattern.alphaNumSpace),
        email: Joi.string().email(),
        aboutMe: Joi.string().allow(''),
    });

    validateRequest(req, res, next, schema);
}

function unSubscribeCoach(req, res, next) {
    const schema = Joi.object({
        coachUserId: Joi.string().required(),
        learnerUserId: Joi.string().required(),
        stripeToken: Joi.string(),
    });

    validateRequest(req, res, next, schema);
}

function withdrawFromWallet(req, res, next) {
    const schema = Joi.object({
        coachUserID: Joi.string().required(),
    });

    validateRequest(req, res, next, schema);
}

function followUnfollowUser(req, res, next) {
    const schema = Joi.object({
        userId: Joi.string().required(),
        followerId: Joi.string().required(),
        status: Joi.number().required().valid(0, 1),
    });

    validateRequest(req, res, next, schema);
}

function viewUnansweredUserCrowds(req, res, next) {
    const schema = Joi.object({
        userId: Joi.string().required(),
    });

    validateRequest(req, res, next, schema);
}

async function submitQuestion(req, res, next) {
    let crowList = [];
    if (req.body.userID) {
        crowList = await userService.getListOfCrowdsByUser(req.body.userID);
        crowList = crowList ? crowList.all : [];
    }
    console.log('crowList....', crowList);

    const schema = Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        crowdID: Joi.string().required().valid(...crowList).messages({
            'any.only': `crowdID is invalid`,
        }),
        // crowdID: Joi.string().required(),
        userID: Joi.string().required(),
    });

    validateRequest(req, res, next, schema);
}

async function submitAsnwer(req, res, next) {
    const schema = Joi.object({
        body: Joi.string().required(),
        questionID: Joi.string().required(),
        userID: Joi.string().required(),
    });

    validateRequest(req, res, next, schema);
}

async function upvoteAsnwer(req, res, next) {
    const schema = Joi.object({
        answerID: Joi.string().required(),
        userID: Joi.string().required(),
    });

    validateRequest(req, res, next, schema);
}

async function submitComment(req, res, next) {
    const schema = Joi.object({
        questionID: Joi.string().required(),
        answerID: Joi.string().required(),
        userID: Joi.string().required(),
        body: Joi.string().required(),
    });

    validateRequest(req, res, next, schema);
}

async function insertGoals(req, res, next) {
    let goalsList = [];
    goalsList = await crowdGoalService.getAll();
    goalsList = goalsList.map((e) => {
        return e._id;
    });

    const schema = Joi.object({
        goals: Joi.array().items(Joi.string().valid(...goalsList).messages({
            'any.only': `"GoalId" is invalid`,
        })).unique((a, b) => a == b).min(1).required(),
    });

    validateRequest(req, res, next, schema);
}

async function insertTopics(req, res, next) {
    let interestList = [];
    interestList = await crowdInterestService.getAll();
    interestList = interestList.map((e) => {
        return e._id;
    });

    const schema = Joi.object({
        topics: Joi.array().items(Joi.string().valid(...interestList).messages({
            'any.only': `"TopicId" is invalid`,
        })).unique((a, b) => a == b).min(1).required(),
    });

    validateRequest(req, res, next, schema);
}

function addVideo(req, res, next) {
    const schema = Joi.object({
        userId: Joi.string().required(),
        videoTitle: Joi.string().required(),
        videoDescription: Joi.string().required(),
    });

    validateRequest(req, res, next, schema);
}

function videoToken(req, res, next) {
    const schema = Joi.object({
        identity: Joi.string().required(),
    });

    validateRequest(req, res, next, schema);
}

function createRoom(req, res, next) {
    const schema = Joi.object({
        roomName: Joi.string().required(),
    });

    validateRequest(req, res, next, schema);
}

module.exports = {
    login: login,
    updateDeviceToken: updateDeviceToken,
    createCouchProfile: createCouchProfile,
    editUserProfile: editUserProfile,
    unSubscribeCoach: unSubscribeCoach,
    subscribeCoach: unSubscribeCoach,
    withdrawFromWallet: withdrawFromWallet,
    followUnfollowUser: followUnfollowUser,
    viewUnansweredUserCrowds: viewUnansweredUserCrowds,
    submitQuestion: submitQuestion,
    submitAsnwer: submitAsnwer,
    upvoteAsnwer: upvoteAsnwer,
    submitComment: submitComment,
    insertGoals: insertGoals,
    insertTopics: insertTopics,
    addVideo: addVideo,
    videoToken: videoToken,
    createRoom: createRoom,
}