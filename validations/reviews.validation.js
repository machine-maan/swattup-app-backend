const Joi = require('joi')
const validateRequest = require('../middleware/validate-request');

exports.createReviews = (req,res,next) => {
    const schema = Joi.object({
        userId: Joi.string().required(),
        rating: Joi.number().min(1).max(5).required(),
        description: Joi.string().required(),
    });
    validateRequest(req, res, next, schema);
};