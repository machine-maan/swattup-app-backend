const Joi = require('joi')
const validateRequest = require('../middleware/validate-request');

exports.chatFile = (req,res,next) => {
    const schema = Joi.object({
        type: Joi.string().required().valid('image', 'video'),
        // file: Joi.required(),
        status: Joi.string().required().valid('send', 'receive'),
        receiverId: Joi.string().required(),
        senderId: Joi.string().required(),
    });
    validateRequest(req, res, next, schema);
};