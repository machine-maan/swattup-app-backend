const commonHelper = require("../helpers/commonHelper");

module.exports = function(data, extraData = {}) {
    if (!data) {
        return {};
    }

    return {
        sid: data.sid,
        roomSid: data.roomSid,
        name: data.identity,
        status: data.status,
        duration: data.duration,
        startTime: data.startTime,
        endTime: data.endTime,
        dateCreated: data.dateCreated,
        dateUpdated: data.dateUpdated,
        ...extraData,
    }
}