const mongoose = require('mongoose')
const db = require('../models')
const baseCrowdService = require('./baseCrowdService')
const model = db.CrowdGoals;
baseCrowdService.model = model;

const getIdsBySearchText = async (searchText) => {
    return await model.aggregate([
        {
            $match: {
                'goalsName': new RegExp(searchText, 'i'),
            }
        },
    ]).then((result) => {
        return result.map((e) => e._id);
    });
}

module.exports = {
    ...baseCrowdService,
    getIdsBySearchText,
}