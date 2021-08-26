const mongoose = require('mongoose')
const db = require('../models')
const baseService = require('./baseService')
const model = db.NotificationLog;
baseService.model = model;

async function find(match = {}, payload = [], pagination = null) {
    let baseQuery = [
        {
            $match: match,
        },
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
    find: find,
}