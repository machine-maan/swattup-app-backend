const mongoose = require('mongoose');

function insert(data) {
    return this.model
        .create(data)
        .then((result) => {
            return true
        })
        .catch((err) => {
            return false
        })
    ;
}

function update(id, data) {
    return this.model.updateOne({
        _id: id,
    }, data)
    .then((result) => {
        return true
    })
    .catch((err) => {
        return false
    });
}


function insertOrUpdate(match, data) {
    return this.model.updateOne(match, {
        $set: data,
    }, {
        upsert: true,
    })
    .then((result) => {
        return true
    })
    .catch((err) => {
        console.log('insertOrUpdate..', ' ' + err);
        return false
    });
}

async function aggregate(query, pagination = null, callback = null) {
    let totalData = null;
    if (pagination) {
        totalData = await pagination.getTotalDataByModal(this.model, query);
    }

    return this.model
    .aggregate([
        ...query,
        ...(pagination ? pagination.aggregateQuery() : []),
    ])
    .then((result) => {
        let responseResult = [];

        if (pagination) {
            responseResult = {
                data: result ? result: [],
                metadata: pagination.metadata(totalData),
            };
        } else {
            responseResult = result ? result : [];
        }

        if (!callback) {
            return responseResult ? responseResult : [];
        }
        
        callback(responseResult);
    })
    .catch((err) => {
        if (!callback) {
            return [];
        }
        
        callback([]);
    });
}

function findOne(id) {
    return this.model.findOne({
        _id: id,
    })
    .then((result) => {
        return result
    })
    .catch((err) => {
        return []
    });
}

function isExist(match) {
    return this.model
    .findOne(match)
    .then((result) => {
        return result
    })
    .catch((err) => {
        return []
    });
}

async function count(match) {
    return this.model
    .countDocuments(match)
    .then((result) => {
        return result
    })
    .catch((err) => {
        return null
    });
}

async function deleteMany(filter) {
    return this.model
    .deleteMany(filter)
    .then((result) => {
        return result
    })
    .catch((err) => {
        return null
    });
}

module.exports = {
    model: null,
    insert: insert,
    update: update,
    insertOrUpdate: insertOrUpdate,
    aggregate: aggregate,
    findOne: findOne,
    isExist: isExist,
    count: count,
    delete: deleteMany,
}