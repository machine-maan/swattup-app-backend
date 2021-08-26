const configHelper = require("../helpers/configHelper");
const dateHelper = require("../helpers/dateHelper");
const userResource = require("./userResource");

module.exports = function(data, extraData = {}) {
    if (!data) {
        return {};
    }
    let date = dateHelper();

    let callEndDate = '';
    if (data.callDate) {
        callEndDate = dateHelper().add(data.callDate, configHelper.BOOK_CALL_TIME_LIMIT);
    }

    return {
        _id: data._id ? data._id : '',
        learnerUserId: data.learnerUserId ? data.learnerUserId : '',
        coachUserId: data.coachUserId ? data.coachUserId : '',
        title: data.title ? data.title : '',
        description: data.description ? data.description : '',
        callDate: data.callDate ? date.convert(data.callDate) : '',
        callEndDate: callEndDate ? date.convert(callEndDate) : '',
        callPrice: data.callPrice ? data.callPrice : 0,
        bookDate: data.bookDate ? date.convert(data.bookDate) : '',
        callStatus: data.callStatus ? data.callStatus : '',
        chargeStatus: data.chargeStatus ? data.chargeStatus : '',
        chargeId: data.chargeId ? data.chargeId : '',
        chargeCurrency: data.chargeCurrency ? data.chargeCurrency : '',
        callExtendCount: data.callExtendCount ? data.callExtendCount : 0,
        coach: data.coach_data ? userResource(data.coach_data) : {},
        user: data.user_data ? userResource(data.user_data) : {},
        ...extraData,
        // createdAt: data.createdAt ? date.convert(data.createdAt) : '',
        // updatedAt: data.updatedAt ? date.convert(data.updatedAt) : '',
    }
}