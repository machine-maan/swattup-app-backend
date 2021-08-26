const commonHelper = require("../helpers/commonHelper");

module.exports = function(data, extraData = {}) {
    if (!data) {
        return {};
    }

    return {
        sid: data.sid,
        roomSid: data.roomSid,
        resolution: data.resolution,
        duration: data.duration,
        format: data.format,
        size: data.size,
        status: data.status,
        dateCreated: data.dateCreated,
        dateUpdated: data.dateUpdated,
        url: data.links ? (data.links.media ? data.links.media : '') : '',
        ...extraData,
    }
}