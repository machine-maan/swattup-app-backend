const commonHelper = require("../helpers/commonHelper");
const dateHelper = require("../helpers/dateHelper");
const uploadHelper = require("../helpers/uploadHelper");
const bookResource = require("./bookResource");
const userResource = require("./userResource");

module.exports = function(data, extraData = {}) {
    if (!data) {
        return {};
    }
    let date = dateHelper(data.timezone);

    return {
        _id: data._id ? data._id : '',
        roomId: data.roomId ? data.roomId : '',
        compositionId: data.compositionId ? data.compositionId : '',
        bookingCallId: data.bookingCallId ? data.bookingCallId : '',
        status: data.status ? data.status : '',
        duration: data.duration ? data.duration : 0,
        size: data.size ? data.size : 0,
        videoUrl: data.videoUrl ? data.videoUrl : '',
        videoThumbnail: data.videoUrl ? commonHelper.createThumbnailLink(data.videoUrl, uploadHelper.KNOWLEDGEBANK_PATH) : '',
        booking: data.booking ? bookResource(data.booking) : null,
        learner: data.learner ? userResource(data.learner) : null,
        coach: data.coach ? userResource(data.coach) : null,
        ...extraData,
        createdAt: data.createdAt ? date.convert(data.createdAt) : '',
        updatedAt: data.updatedAt ? date.convert(data.updatedAt) : '',
    }
}