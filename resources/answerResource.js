const commonHelper = require("../helpers/commonHelper");
const dateHelper = require("../helpers/dateHelper");
const globalHelper = require("../helpers/globalHelper");
const uploadHelper = require("../helpers/uploadHelper");
const followerService = require("../services/followerService");
const userResource = require("./userResource");

module.exports = async function(data, extraData = {}) {
    if (!data) {
        return {};
    }
    
    let self = false;
    var following = 0
    let authUser = globalHelper.authUser;
    if (authUser) {
        if (authUser._id.toString() == data.userID.toString()) {
            self = true;
        }
        following = await followerService.count({
            userId: data.userID,
            followerId: authUser._id,
            status: 1,
        });
    }

    return {
        _id: data._id ? data._id : '',
        userID: data.userID ? data.userID : '',
        body: data.body ? data.body : '',
        image: data.image ? data.image : '',
        video: data.video ? data.video : '',
        videoThumbnail: data.video ? commonHelper.createThumbnailLink(data.video, uploadHelper.ANSWER_VIDEO_FILE_PATH) : '',
        followStatus: following > 0 ? true : false,
        self: self,
        commentsCount: data.comments ? data.comments.length : '',
        upvotesCount: data.upvotes ? data.upvotes.length : '',
        date: data.date ? dateHelper().convert(data.date) : 0,
        user: data.answerUserData ? userResource(data.answerUserData) : {},
        ...extraData,
    }
}