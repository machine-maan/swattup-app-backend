const Joi = require('joi')
const configHelper = require('../helpers/configHelper')
const validateRequest = require('../middleware/validate-request')
const crowdGoalService = require('../services/crowdGoalService')
const crowdInterestService = require('../services/crowdInterestService')
let moment = require('moment');
const regPattern = {
    alphaSpace : [
        new RegExp(/^[a-zA-Z ]*$/),
        'Alpha characters',
    ],
    alphaNumSpace : [
        new RegExp(/^[a-zA-Z0-9 ]*$/),
        'Alpha characters',
    ]
};

exports.createCouchProfileSchema = (req, res, next) => {
  const schema = Joi.object({
    userId: Joi.string().required(),
    bio: Joi.string(),
    fullName: Joi.string(),
    title: Joi.string().required(),
    description: Joi.string().required(),
    videoDetails: Joi.string(),
    listOfTopics: Joi.string(),
    subscriptionPrice: Joi.string().required(),
    amount: Joi.string(),
    totalEarning: Joi.string(),
    interests: Joi.string(),
    time: Joi.string(),
    subscribersCount: Joi.number().integer(),
    bookingType: Joi.number().integer(),
    contentPerformance: Joi.number().integer(),
    socialLink: Joi.string(),
  })
  validateRequest(req, res, next, schema)
}

exports.uploadCouchProfileSchema = (req, res, next) => {
  const schema = Joi.object({
    userId: Joi.string().required(),
    fullName: Joi.string().required(),
    bio: Joi.string(),
    description: Joi.string().required(),
    title: Joi.string().required(),   
    subscriptionPrice: Joi.string().required(),
    subscriptionPlanId: Joi.string(),
    callPrice: Joi.string().required(),
    linkdinProfileUrl: Joi.string(),
    facebookProfileUrl: Joi.string(),
    instagramProfileUrl: Joi.string(),
    twitterProfileUrl: Joi.string(),
   
  })
  validateRequest(req, res, next, schema)
}

exports.editUploadProfileSchema = (req, res, next) => {
  const schema = Joi.object({
    userId: Joi.string().required(),
    fullName: Joi.string().required(),
    bio: Joi.string(),
    description: Joi.string().required(),
    title: Joi.string().required(),   
    subscriptionPrice: Joi.string().required(),
    callPrice: Joi.string().required(),
    linkdinProfileUrl: Joi.string(),
    facebookProfileUrl: Joi.string(),
    instagramProfileUrl: Joi.string(),
    twitterProfileUrl: Joi.string(),
   
  })
  validateRequest(req, res, next, schema)
}


exports.editCouchProfileSchema = (req, res, next) => {
  const schema = Joi.object({
    id: Joi.string().required(),
    userId: Joi.string().required(),
    bio: Joi.string(),
    description: Joi.string().required(),
    videoDetails: Joi.string(),
    listOfTopics: Joi.string(),
    subscriptionPrice: Joi.string().required(),
    amount: Joi.string(),
    totalEarning: Joi.string(),
    interests: Joi.string(),
    time: Joi.string(),
    subscribersCount: Joi.number().integer(),
    bookingType: Joi.number().integer(),
    contentPerformance: Joi.number().integer(),
    socialLink: Joi.string(),
  })
  validateRequest(req, res, next, schema)
}

exports.signupValidation = async (req, res, next) => {
    let goalsList = [];
    goalsList = await crowdGoalService.getAll();
    goalsList = goalsList.map((e) => {
        return e._id;
    });

    let interestList = [];
    interestList = await crowdInterestService.getAll();
    interestList = interestList.map((e) => {
        return e._id;
    });

    let usernameValidation = {
        username: Joi.string().disallow(' ').regex(...regPattern.alphaNumSpace).required(),
    };

    if (req.body.source) {
        if (req.body.source === configHelper.AUTH_PROVIDER_APPLE) {
            usernameValidation = { 
                username: Joi.string().allow('').regex(...regPattern.alphaNumSpace),
            };
        }
    }

  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(15).required(),
    type: Joi.string().required().valid(...configHelper.USER_TYPE),
    source: Joi.string().required().valid(...configHelper.AUTH_PROVIDERS),
    firebaseUserID: Joi.string(),
    deviceID: Joi.string().required(),
    deviceModel: Joi.string().required(),
    devicePlatform: Joi.string().required(),
    goals: Joi.array().items(Joi.string().valid(...goalsList).messages({
        'any.only': `"GoalId" is invalid`,
    })).unique((a, b) => a == b).min(1),
    interests: Joi.array().items(Joi.string().valid(...interestList).messages({
        'any.only': `"InterestId" is invalid`,
    })).unique((a, b) => a == b).min(1),
    profileImage: Joi.string().allow(''),
    // goals: Joi.string(),
    // interests: Joi.string(),
    action: Joi.string(),
    timezone: Joi.string().valid(...moment.tz.names()).messages({
        'any.only': `"timezone" is invalid`,
    }),
    ...usernameValidation,
  })
  validateRequest(req, res, next, schema)
}

exports.resendEmail = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
  })
  validateRequest(req, res, next, schema)
}

exports.resetPassword = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().required(),
    password: Joi.string().min(6).max(15).required(),
    confirmPassword: Joi.any().valid(Joi.ref('password')).required().label('Confirm password')
    .options({ messages: { 'any.only': '{{#label}} does not match'} })
  })
  validateRequest(req, res, next, schema)
}
