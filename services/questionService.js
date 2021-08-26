const mongoose = require('mongoose')
const db = require('../models')
const baseService = require('./baseService')
const ObjectId = mongoose.Types.ObjectId
const model = db.Question;
baseService.model = model;

async function getUnansweredUserCrowds(crowdType, crowdList, userId) {
    let tableName = 'crowdgoals';
    if (crowdType == 'interest') {
        tableName = 'crowdintersts';
    }

    return await this.aggregate([
        {
            $match: { answers: [], crowdID: { $in : crowdList } },
        },
        // { "$addFields": { "crowdID": { "$toObjectId": "$crowdID" }}},
        {
            $lookup: {
                from: tableName,
                localField: "crowdID",
                foreignField: "_id",
                as: "crowdsData"
            }
        },
        { $unwind: '$crowdsData' },
        // { "$addFields": { "crowdsData.crowdsId": { "$toObjectId": "$crowdsData.crowdsId" }}},
        // {
        //     $lookup: {
        //         from: "crowdquestions",
        //         localField: "crowdsData.crowdsId",
        //         foreignField: "_id",
        //         as: "imageDetail",
        //     }
        // },
        // { $unwind: '$imageDetail' },
        {
            $group: { _id: '$crowdID', "unanswercount":{$sum: 1}, crowdsData: { $first: "$crowdsData"} },
        },
        { $project: { crowdID: 1, unanswercount: 1, crowdsData: "$crowdsData", crowdType: crowdType }},
    ]);
}

async function find(match = {}, payload = [], pagination = null) {
    let baseQuery = [
        {
            $match: match,
        },
        {
            $lookup: {
                from: 'users',
                localField: 'userID',
                foreignField: '_id',
                as: 'userData',
            }
        },
        { $unwind: '$userData' },
        // {
        //     $sort: { date: -1 }
        // },
        ...payload
    ];

    if (!pagination) {
        return await this.aggregate(baseQuery);
    }
    
    let totalData = await pagination.getTotalDataByModal(model, baseQuery);

    return {
        data: await this.aggregate([
            ...baseQuery,
            ...pagination.aggregateQuery(),
        ]),
        metadata: pagination.metadata(totalData),
    }
}

module.exports = {
    ...baseService,
    getUnansweredUserCrowds, getUnansweredUserCrowds,
    find: find,
}