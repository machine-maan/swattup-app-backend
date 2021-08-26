const mongoose = require('mongoose')
const db = require('../models')
const baseService = require('./baseService')

async function getByIds(ids) {
    return await this.aggregate([
        // {
        //     "$addFields": { 
        //         // "_id": { "$toString": "$_id" }, 
        //         // "crowdsId": { "$toObjectId": "$crowdsId" }
        //     }
        // },
        {
            $match: {
                _id: { $in: ids }
            }
        },
        // {
        //     $lookup: {
        //         from: 'crowdquestions',
        //         localField: "crowdsId",
        //         foreignField: "_id",
        //         as: "crowdsData"
        //     }
        // },
        // { $unwind: '$crowdsData' },
    ]);
}

async function getAll() {
    return await this.aggregate([
        // { 
        //     "$addFields": {
        //         "crowdsId": { "$toObjectId": "$crowdsId" }
        //     }
        // },
        // {
        //     $lookup: {
        //         from: 'crowdquestions',
        //         localField: "crowdsId",
        //         foreignField: "_id",
        //         as: "crowdsData"
        //     }
        // },
        // { $unwind: '$crowdsData' },
    ]);
}
 
module.exports = {
    ...baseService,
    getByIds: getByIds,
    getAll: getAll,
}