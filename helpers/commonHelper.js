const mongoose = require('mongoose');
const configHelper = require('./configHelper');
const ObjectId = mongoose.Types.ObjectId;
const jwt = require('jsonwebtoken');
const uploadHelper = require('./uploadHelper');

function getProfileImage(profileImage, defaultImage = null) {
    return profileImage
        ? profileImage
        : (defaultImage
            ? defaultImage
            : process.env.BUCKET_URL + process.env.defaultProfileImage)
        ;
}

function getCleanObject(paramObj) {
    if (!paramObj) {
        return null;
    }

    let temp = JSON.stringify(paramObj);
    let obj = JSON.parse(temp);

    return obj;
}

async function getFilterSortFields(request, paramList) {
    let queryParams = {}

    for (const property in paramList) {
        if (paramList[property]) {
            switch (property) {
                case 'equal':
                    for (var eqKey in paramList[property]) {
                        let userValue = request[eqKey];
                        if (userValue) {
                            let singleObj = paramList[property][eqKey];
                            let queryParamkey = eqKey;
                            if (typeof singleObj === 'object' && singleObj !== null) {
                                if (singleObj.hasOwnProperty('key')) {
                                    queryParamkey = singleObj.key;
                                }
                                if (singleObj.hasOwnProperty('cast')) {
                                    userValue = updateCast(userValue, singleObj.cast);
                                }
                                if (singleObj.hasOwnProperty('condition')) {
                                    if (singleObj.condition) {
                                        userValue = getConditionalObj(request, eqKey, userValue);
                                    }
                                }
                            }
                            queryParams[queryParamkey] = userValue;
                        }
                    }

                    break;

                case 'like':
                    for (var likeKey in paramList[property]) {
                        if (request[likeKey]) {
                            let singleObj = paramList[property][likeKey];
                            let queryParamkey = likeKey;
                            if (singleObj.hasOwnProperty('key')) {
                                queryParamkey = singleObj.key;
                            }
                            queryParams[queryParamkey] = new RegExp(request[likeKey], 'i');
                        }
                    }

                    break;

                case 'in':
                    for (var inKey in paramList[property]) {
                        if (!request[inKey]) {
                            continue;
                        }
                        if (request[inKey]) {
                            let cast = null;
                            let singleObj = paramList[property][inKey];
                            if (typeof singleObj === 'object' && singleObj !== null) {
                                if (singleObj.hasOwnProperty('cast')) {
                                    cast = singleObj.cast;
                                }
                            }

                            let numList = request[inKey].split(',').map(e => {
                                if (cast == 'number') {
                                    return Number(e);
                                }
                                return e;
                            });
                            queryParams[inKey] = { "$in": numList };
                        }
                    }

                    break;

                case 'rel':
                    for (var relKeys in paramList[property]) {
                        if (!request[relKeys]) {
                            continue;
                        }
                        let tableDetail = paramList[property][relKeys][1].split('.');
                        let searchObj = {}
                        searchObj[tableDetail[1]] = new RegExp(request[relKeys], 'i');
                        let relObj = await mongoose.model(tableDetail[0]).find(searchObj);
                        relObj = relObj.map(function (item) { return item._id.toString(); });
                        if (relObj) {
                            queryParams[paramList[property][relKeys][0]] = { "$in": relObj };
                        }
                    }

                    break;

                default:
                    break;
            }
        }
    }

    let sortObj = {}
    sortObj[request.sortBy || '_id'] = request.orderBy === 'desc' ? -1 : 1;

    return {
        'filter': queryParams,
        'sort': sortObj,
    }
}

function isObjectEmpty(obj) {
    return Object.keys(obj).length === 0;
}

function getAverage(array) {
    const avg = array.reduce((p, c) => p + c.rating, 0) / array.length;

    return avg ? avg : 0;
}

function updateCast(value, castType) {
    let castValue = value;

    switch (castType) {
        case 'number':
            castValue = Number(value);
            break;

        case 'ObjectId':
            castValue = ObjectId(value);
            break;

        case 'string':
            castValue = String(value);
            break;
    }

    return castValue;
}

function getConditionalObj(request, key, value) {
    let conditionalKey = key + '-cnd';
    let res = {};
    if (request[conditionalKey]) {
        let cndValue = request[conditionalKey];
        var cndList = ['gt', 'gte', 'lt', 'lte'];
        if (cndList.includes(cndValue)) {
            res["$" + cndValue] = value;
        } else {
            return value;
        }
    } else {
        return value;
    }

    return res;
}

function filterPayload(reqBody, mapObj) {
    let res = {};

    for (pKey in mapObj) {
        if (reqBody.hasOwnProperty(pKey)) {
            res[mapObj[pKey]] = reqBody[pKey];
        }
    }

    return res;
}

function generateToken(userData) {
    return jwt.sign(
        {
            id: userData._id,
            email: userData.email,
            type: userData.type,
            timezone: userData.timezone ? userData.timezone : '',
            deviceToken: userData.deviceToken ? userData.deviceToken : '',
        },
        configHelper.SECRET_KEY,
        { expiresIn: configHelper.EXPIRES_IN }
    );
}

function removeDuplicates(data, arrayKey) {
    let key = item => item[arrayKey];

    return [
        ...new Map(data.map(item => [key(item), item])).values()
    ]
};

function removeDecimals(num, fixed = 2) {
    return parseFloat(num).toFixed(fixed).replace(/(\.0+|0+)$/, '')
};

function createLink(fileName, filePath = null) {
    if (!fileName) {
        return '';
    }

    if (fileName.includes(process.env.BUCKET_URL)) {
        return fileName;
    }

    return process.env.BUCKET_URL + '/' + filePath + fileName;
}

const createThumbnailLink = (fileName, filePath = null) => {
    if (!fileName) {
        return '';
    }

    let explodedArray = fileName.split('/');

    if (explodedArray[explodedArray.length-1]) {
        let fileNameE = explodedArray[explodedArray.length-1];
        let fileNameExplodedArray = fileNameE.split('.');

        return createLink(fileNameExplodedArray[0] + '.png', filePath + uploadHelper.VIDEO_THUMBNAILS_DIRECTORY + '/');
    }

    return '';
}

module.exports = {
    getProfileImage: getProfileImage,
    getCleanObject: getCleanObject,
    getFilterSortFields: getFilterSortFields,
    isObjectEmpty: isObjectEmpty,
    getAverage: getAverage,
    filterPayload: filterPayload,
    generateToken: generateToken,
    removeDuplicates: removeDuplicates,
    removeDecimals: removeDecimals,
    createLink: createLink,
    createThumbnailLink,
}