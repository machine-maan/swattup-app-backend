const commonHelper = require("../helpers/commonHelper");
const dateHelper = require("../helpers/dateHelper");
const uploadHelper = require("../helpers/uploadHelper");

module.exports = function(data, extraData = {}) {
    if (!data) {
        return {};
    }

    return {
        _id: data._id ? data._id : '',
        questionId: data.questionId ? data.questionId : '',
        answerId: data.answerId ? data.answerId : '',
        // crowdID: data.crowdID ? data.crowdID : 0,
        body: data.body ? data.body : '',
        image: data.image ? data.image : '',
        video: data.video ? data.video : '',
        videoThumbnail: data.video ? commonHelper.createThumbnailLink(data.video, uploadHelper.COMMENT_VIDEO_FILE_PATH) : '',
        date: data.date ? dateHelper().convert(data.date) : 0,
        ...extraData,
    }
}