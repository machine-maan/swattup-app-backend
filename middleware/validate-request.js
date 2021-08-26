module.exports = validateRequest;

function validateRequest(req, res, next, schema) {
  const options = {
    abortEarly: false, // include all errors
    allowUnknown: true, // ignore unknown props
    stripUnknown: true, // remove unknown props
  };
  const { error, value } = schema.validate(req.body, options);
  if (error) {
    const { details } = error;
    const validateMessage = details.map((i) => i.message.replace(/['"]+/g, '')).join(",");

    console.log("error", validateMessage);
    //  res.status(422).json({ error: message }) }
    res.status(422).send({
		status: 422,
		// error: 'Validation error',
		message: validateMessage,
    });
  } else {
    req.body = value;
    next();
  }
}
