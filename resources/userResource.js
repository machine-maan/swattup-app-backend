const commonHelper = require("../helpers/commonHelper");
const dateHelper = require("../helpers/dateHelper");
const uploadHelper = require("../helpers/uploadHelper");

module.exports = function(data, extraData = {}) {
    if (!data) {
        return {};
    }
    let date = dateHelper(data.timezone);

    return {
        _id: data._id ? data._id : '',
        username: data.username ? data.username : '',
        email: data.email ? data.email : '',
        aboutMe: data.aboutMe ? data.aboutMe : '',
        subscriptionPrice: data.subscriptionPrice ? data.subscriptionPrice : 0,
        callPrice: data.callPrice ? data.callPrice : 0,
        video: data.video ? data.video : '',
        videoThumbnail: data.video ? commonHelper.createThumbnailLink(data.video, uploadHelper.COACH_PROFILE_VIDEO_PATH) : '',
        title: data.title ? data.title : '',
        type: data.type ? data.type : '',
        profileImage: commonHelper.getProfileImage(data.profileImage),
        bannerImage: commonHelper.getProfileImage(data.bannerImage, null),
        linkdinProfileUrl: data.linkdinProfileUrl ? data.linkdinProfileUrl : '',
        facebookProfileUrl: data.facebookProfileUrl ? data.facebookProfileUrl : '',
        instagramProfileUrl: data.instagramProfileUrl ? data.instagramProfileUrl : '',
        twitterProfileUrl: data.twitterProfileUrl ? data.twitterProfileUrl : '',
        firebaseUserID: data.firebaseUserID ? data.firebaseUserID : '',
        deviceToken: data.deviceToken ? data.deviceToken : '',
        timezone: data.timezone ? data.timezone : '',
        ...extraData,
        createdAt: data.createdAt ? date.convert(data.createdAt) : '',
        updatedAt: data.updatedAt ? date.convert(data.updatedAt) : '',
    }
}