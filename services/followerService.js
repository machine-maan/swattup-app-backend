const mongoose = require('mongoose')
const db = require('../models')
const baseService = require('./baseService')
const model = db.Follower;
baseService.model = model;

async function getFollowers(userId) {
    return model.find({
            userId: userId,
        }, {
            _id: 0,
            followerId: 1,
        })
        .then(function(items) {
            return items.map(e => e.followerId.toString());
        })
    ;
}

module.exports = {
    ...baseService,
    getFollowers: getFollowers,
}