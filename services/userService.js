const mongoose = require('mongoose');
const commonHelper = require('../helpers/commonHelper');
const configHelper = require('../helpers/configHelper');
const db = require('../models')
const baseService = require('./baseService');
const crowdGoalService = require('./crowdGoalService');
const crowdInterestService = require('./crowdInterestService');
const questionService = require('./questionService');
const ObjectId = mongoose.Types.ObjectId
const model = db.User;
baseService.model = model;

function getUserDeviceTokens(userIds) {
    return model.find({
        _id: { $in: userIds },
        deviceToken: { $ne: null }
    }, {
        _id: 1,
        deviceToken: 1,
    })
        .then(function (items) {
            return items.map((e) => {
                return {
                    id: e._id,
                    deviceToken: e.deviceToken,
                };
            });
        })
        ;
}

function getAllInterestAndGoalRelatedUser(userId) {
    return model
        .findOne(userId)
        .then(user => {
            let interests = user.topics ? user.topics : [];
            let goals = user.goals ? user.goals : [];
            return model.aggregate([
                {
                    $match: {
                        _id: { $ne: userId },
                        $or: [{ topics: { '$in': interests } }, { goals: { '$in': goals } }],
                        type: "Learner",
                    }
                }])
                .then(userList => {
                    if (userList) {
                        return userList.map(e => e._id.toString());
                    }

                    return [];
                })
                ;
        })
        ;
}

function updateToAll(where, data) {
    return model
        .updateMany(
            where,
            { $set: data },
            { multi: true }
        )
        .then(result => {
            return result;
        })
        ;
}

async function getRandomUserRelatedToCrowd(crowdId, exceptUserId = null) {
    let orCnd = {}
    if (crowdId != configHelper.SUPPORT_CROWD._id) {
        orCnd = {
            $or: [{ topics: crowdId }, { goals: crowdId }],
        }
    }

    return await this.aggregate([
        {
            $match: {
                _id: { $ne: ObjectId(exceptUserId) },
                type: configHelper.USER_TYPE_PROFESSIONAL,
                ...orCnd,
            }
        }
    ]);
}

async function getListOfCrowdsByUser(userId) {
    return model
        .findOne({
            _id: ObjectId(userId),
        }, {
            _id: 1,
            topics: 1,
            goals: 1,
        })
        .then(result => {
            if (result) {
                const topics = [...result.topics];
                const goals = [...result.goals];
                return {
                    topics: topics,
                    goals: goals,
                    all: [
                        configHelper.SUPPORT_CROWD._id,
                        ...topics,
                        ...goals,
                    ]
                };
            }

            return null;
        })
        ;
}

async function getCrowdDetailById(crowdId) {
    let supportCrowd = configHelper.SUPPORT_CROWD;
    if (crowdId == supportCrowd._id) {
        return {
            ...supportCrowd,
            name: supportCrowd.interestName,
            type: 'interest',
        };
    }
    let topics = await crowdInterestService.findOne(crowdId);

    if (topics) {
        return {
            ...topics._doc,
            name: topics._doc.interestName,
            type: 'interest',
        };
    }

    let goal = await crowdGoalService.findOne(crowdId);

    if (goal) {
        return {
            ...goal._doc,
            name: goal._doc.goalsName,
            type: 'goal',
        };
    }

    return null;
}

async function setEmailVerificationCountToZero() {
    let result = await model.updateMany({
        validated: false,
        source: configHelper.SOURCE_PROVIDER_EMAIL,
    }, {
        verificationCodeCount: 0,
    });
    console.log('verificationCodeCount...', result);
}

async function find(match = {}, payload = [], pagination = null) {
    let baseQuery = [
        {
            $match: match,
        },
        ...payload
    ];

    // if (!pagination) {
    return await this.aggregate(baseQuery, pagination);
    // }

    // let totalData = await pagination.getTotalDataByModal(model, baseQuery);

    // return {
    //     data: await this.aggregate([
    //         ...baseQuery,
    //         ...pagination.aggregateQuery(),
    //     ]),
    //     metadata: pagination.metadata(totalData),
    // }
}

module.exports = {
    ...baseService,
    getRandomUserRelatedToCrowd: getRandomUserRelatedToCrowd,
    updateToAll: updateToAll,
    getUserDeviceTokens: getUserDeviceTokens,
    getAllInterestAndGoalRelatedUser: getAllInterestAndGoalRelatedUser,
    getListOfCrowdsByUser: getListOfCrowdsByUser,
    getCrowdDetailById: getCrowdDetailById,
    setEmailVerificationCountToZero: setEmailVerificationCountToZero,
    find: find,
}