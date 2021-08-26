const Joi = require('joi')
const validateRequest = require('../middleware/validate-request');
let dateHelper = require('../helpers/dateHelper');
const timeRegex = '^((1[0-2]|0?[1-9]):([0-5][0-9]) ?([AaPp][Mm]))$';

exports.createBookCallSchema = (req,res,next) => {
    const schema = Joi.object({
        learnerUserId: Joi.string().required(), 
        coachUserId: Joi.string().required(), 
        title: Joi.string().required(),
        description: Joi.string().required(),
        callDate: Joi.date().required().min(dateHelper().now('YYYY-MM-DD')).message('callDate must be equal OR greater than current date'),
        callTime: Joi.string()
        .required()
        .regex(new RegExp(timeRegex))
        .message('callTime pattern must be `hh:mm A`')
        .required(), //moment.tz.names()
    });
    validateRequest(req, res, next, schema);
};