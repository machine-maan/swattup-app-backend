const commonHelper = require("../helpers/commonHelper");
const dateHelper = require("../helpers/dateHelper");
const userResource = require("./userResource");

module.exports = function(data, extraData = {}) {
    if (!data) {
        return {};
    }

    return {
        _id: data._id ? data._id : '',
        userID: data.userID ? data.userID : '',
        crowdID: data.crowdID ? data.crowdID : 0,
        title: data.title ? data.title : '',
        description: data.description ? data.description : '',
        answerCount: data.answers ? data.answers.length: 0,
        // answers: data.answers ? data.answers : '',
        date: data.date ? dateHelper().convert(data.date) : 0,
        user: data.userData ? userResource(data.userData) : null,
        ...extraData,
    }
}