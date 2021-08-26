const mongoose = require('mongoose')
const db = require('../models')
const baseService = require('./baseService')
const model = db.Subscription;
baseService.model = model;

function getLearners(userId, fieldList = {}) {
    return model
        .find({
            coachUserID: userId,
        }, {
            _id: 0,
            ...fieldList,
        })
        .then(function(items) {
            return items;
        })
    ;
}

function getCoaches(userId, fieldList = {}) {
    return model
        .find({
            learnerUserID: userId,
        }, {
            _id: 0,
            ...fieldList,
        })
        .then(function(items) {
            return items;
        })
    ;
}

module.exports = {
    ...baseService,
    getLearners: getLearners,
    getCoaches: getCoaches,
}