const mongoose = require('mongoose')
const db = require('../models')
const baseService = require('./baseService')
const model = db.Review;
baseService.model = model;

async function getAvgRatingOfUser(userId) {
    return this.model.aggregate([
        { "$match": { userId: userId } },
        {$group: {_id:null, avg: {$avg:"$rating"}, total: {$sum:1} } },
    ])
    .then((result) => {
        if (result) {
            if (result.length) {
                return {
                    avg: result[0].avg,
                    total: result[0].total,
                };
            }
        }

        return 0;
    })
    .catch((err) => {
        console.log('err..', err + '');
        return 0;
    });
}

module.exports = {
    ...baseService,
    getAvgRatingOfUser: getAvgRatingOfUser,
}