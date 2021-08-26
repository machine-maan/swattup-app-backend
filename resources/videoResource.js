const commonHelper = require("../helpers/commonHelper");
const dateHelper = require("../helpers/dateHelper");
const globalHelper = require("../helpers/globalHelper");
const uploadHelper = require("../helpers/uploadHelper");

module.exports = function(data, extraData = {}) {
    if (!data) {
        return {};
    }
    const userData = globalHelper.authUser;
    const date = dateHelper(userData.timezone);

    return {
        _id: data._id ? data._id : '',
        userId: data.userId ? data.userId : '',
        videoTitle: data.videoTitle ? data.videoTitle : '',
        videoDescription: data.videoDescription ? data.videoDescription : '',
        videoThumbnail: data.video ? commonHelper.createThumbnailLink(data.video, uploadHelper.COACH_VIDEO_PATH) : '',
        video: data.video ? data.video : '',
        ...extraData,
        createdAt: data.createdAt ? date.convert(data.createdAt) : '',
        updatedAt: data.updatedAt ? date.convert(data.updatedAt) : '',
    }
}