const commonHelper = require("../helpers/commonHelper");
const dateHelper = require("../helpers/dateHelper");

module.exports = function(data, extraData = {}) {
    if (!data) {
        return {};
    }
    let date = dateHelper();

    return {
        sid: data.sid,
        name: data.uniqueName,
        type: data.type,
        duration: data.duration,
        endTime: data.endTime,
        status: data.status,
        dateCreated: date.convert(data.dateCreated),
        dateUpdated: date.convert(data.dateUpdated),
        ...extraData,
    }
}