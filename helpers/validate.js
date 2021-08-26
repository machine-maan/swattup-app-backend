const moment = require('moment')
const db = require('../models')
const token = require('../routes/token') // for getToken function
const users = require('./users')
const points = require('./points')

const apiKey = 'xxx'
const domain = 'mailgun.swattup.com'
const host = 'api.eu.mailgun.net'
const mailgun = require('mailgun-js')({ apiKey, domain, host })

function getEmailHeader(type, code) {
  if (type === 'signup') {
    return `Welcome to SwattUp! Your code is: ${code}.`
  }
  if (type === 'forgotpassword') {
    return `Did you forget your password?`
  }
  if (type === 'changeemail') {
    return `Hello from SwattUp. The code for your new email is: ${code}.`
  }
}

function getEmailBody(type, code, email, link) {
  if (type === 'signup') {
    return `Thanks for checking out SwattUp. The code to confirm your email address is ${code}. If you ever need help or want to get in touch, send us an email at hello@swattup.com.<br/><br/>
            All the best,<br/>
            The SwattUp Team`
  }

  if (type === 'forgotpassword') {
    if (link) {
      const resetLink = `https://hub.swattup.com/dashboard/helpmypassword/${email}/${code}`
      return `We've received a forgotten password request for your account with SwattUp.<br/><br/>
                <a href="${resetLink}">Click here to reset your password.</a><br/><br/>
                You can also copy the following URL into your address bar: ${resetLink}<br/><br/>
    
                If need more help or want to get in touch, send us an email at hello@swattup.com.<br/><br/>
                All the best,<br/>
                The SwattUp Team`
    }

    return `We've received a forgotten password request for your account with SwattUp. The code to reset your password is ${code}. If need more help or want to get in touch, send us an email at hello@swattup.com.<br/><br/>
            All the best,<br/>
            The SwattUp Team`
  }
  if (type === 'changeemail') {
    return `We've received a request to change the email on your account with SwattUp. The code to confirm your new email address is ${code}. If you need help or want to get in touch, send us an email at hello@swattup.com.<br/><br/>
            All the best,<br/>
            The SwattUp Team`
  }
}

// createCode and checkCode can take any arbitrary "type" - we use "signup", "forgotpassword" and "changeemail"
// "forgotpassword" looks up a user interpreting req.params.email as either username or email, then uses user.email
// therefore, "email" field on validation object may be filled in with a username, though the email is still sent
// "signup" just uses req.params.email
exports.createCode = (req, res) => {
  const { type } = req.params

  // if "email" doesn't end with .ac.uk and type is "signup", reject - now handled only on front-end
  // if(email.substr(email.length - 6) !== ".ac.uk") {
  //     if(type==="signup" || type==="changeemail") {
  //         return res.send({ notStudent: true })
  //     }
  // }

  // find any users with the email OR username as given email
  db.User.findOne({
    $or: [{ email: req.params.email }, { username: req.params.email }],
  })
    .then((user) => {
      // if a user exists and type is "changeemail", reject
      if (user && type === 'changeemail') {
        return res.send({ taken: true })
      }

      // if no user found and type is "forgotpassword", reject
      if (!user && type === 'forgotpassword') {
        return res.send({ notFound: true })
      }

      if (user && user.banned && type === 'forgotpassword') {
        return res.send({ banned: true })
      }

      db.Validation.findOne({
        email: req.params.email,
        type: type,
        validated: false,
      })
        .lean()
        .then((validation) => {
          let code

          console.log('validation =', validation)

          // for type "signup", re-use old code if not expired
          if (validation && type === 'signup') {
            const expiry = moment(validation.date).add(120, 'minutes')

            // if not expired, re-send the code from this validation
            // if expired, will trigger Validation.deleteMany instead
            if (moment().isSameOrBefore(expiry)) {
              code = validation.code
            }
          }

          if (!code) {
            code = 100000 + Math.floor(Math.random() * 899999)

            // in parallel, delete any previous validation objects with this code or type
            db.Validation.deleteMany({ email: req.params.email, type: type })
              .then(() => {
                // create validation item with code
                db.Validation.create({
                  email: req.params.email,
                  type: req.params.type,
                  code: code,
                  date: new Date().toISOString(),
                  validated: false,
                })
                  .then(() => {
                    console.log('new validation doc generated')
                  })
                  .catch((error) => res.send(error))
              })
              .catch((error) => res.send(error))
          }

          console.log('code =', code)

          // send email
          const data = {
            from: 'SwattUp <noreply@swattup.com>',
            to: type === 'forgotpassword' ? [user.email] : [req.params.email],
            subject: getEmailHeader(type, code),
            html: getEmailBody(
              type,
              code,
              req.params.email,
              req.params.link === 'link'
            ),
          }

          mailgun.messages().send(data, (error, body) => {
            if (error || !body) {
              return res.send(error || { error: true })
            }

            return res.send({ sent: true })
          })
        })
        .catch((err) => res.send(err))
    })
    .catch((error) => res.send(error))
}

exports.checkCode = (req, res) => {
  db.Validation.findOne({
    email: req.params.email,
    type: req.params.type,
    validated: false,
  })
    .then((validation) => {
      if (!validation) {
        return res.send({ notFound: true })
      }

      validation.compareCode(req.body.code || '', (err, isMatch) => {
        if (err) {
          return res.send(err)
        }

        if (!isMatch) {
          return res.send({ correct: false })
        }

        validation.validated = true
        validation
          .save()
          .then(() => {
            if (req.params.type === 'signup') {
              db.User.findOneAndUpdate(
                {
                  email: req.params.email,
                },
                {
                  validated: true,
                }
              )
                .then(() => {
                  return res.send({ correct: true })
                })
                .catch((err) => res.send(err))
            } else {
              return res.send({ correct: true })
            }
          })
          .catch((error) => {
            return res.send(error)
          })
      })
    })
    .catch((error) => res.send(error))
}

exports.setNewPassword = (req, res) => {
  console.log('hjsdsd');
  db.Config.findOne({ name: 'config' })
    .lean()
    .then((config) => {
      // make sure a validation exists for that "email" (may also be username)
      db.Validation.findOne({
        email: req.params.email,
        type: 'forgotpassword',
        validated: true,
      })
        .then((validation) => {
          if (!validation) {
            return res.send({ unauthorized: true })
          }

          const expiry = moment(new Date(validation.date)).add(120, 'minutes')

          if (moment().isSameOrBefore(expiry)) {
            //valid - find user
            db.User.findOne({
              $or: [
                { email: req.params.email },
                { username: req.params.email },
              ],
            })
              .then((user) => {
                if (!user) {
                  return res.send({ notFound: true })
                }

                user.password = req.body.password
                user.passwordDate = new Date().toISOString()
                user
                  .save()
                  .then((savedUser) => {
                    // delete all validations of this email and type (including this one) and send token
                    db.Validation.deleteMany({
                      email: req.params.email,
                      type: 'forgotpassword',
                    })
                      .then(() =>
                        res.send({
                          // token: token.getToken(savedUser),
                          user: users.trimUser(savedUser),
                          levelData: points.getLevelData(
                            savedUser.points,
                            config.levelThresholds
                          ),
                        })
                      )
                      .catch((error) => res.send(error))
                  })
                  .catch((error) => res.send(error))
              })
              .catch((error) => res.send(error))
          } else {
            return res.send({ expired: true })
          }
        })
        .catch((error) => res.send(error))
    })
    .catch((err) => res.send(err))
}

exports.setNewEmail = (req, res) => {
  console.log('jdfj');
  db.Config.findOne({ name: 'config' })
    .lean()
    .then((config) => {
      // make sure a validation exists for that email
      db.Validation.findOne({
        email: req.body.email,
        type: 'changeemail',
        validated: true,
      })
        .then((validation) => {
          if (!validation) {
            return res.send({ unauthorized: true })
          }

          const expiry = moment(new Date(validation.date)).add(120, 'minutes')

          if (moment().isSameOrBefore(expiry)) {
            //valid - find user by _id
            db.User.findOne({ _id: req.params._id })
              .then((user) => {
                if (!user) {
                  return res.send({ notFound: true })
                }

                // check current password
                user.comparePassword(
                  req.body.currentPassword || '',
                  (err, isMatch) => {
                    if (err) {
                      return res.send(err)
                    }
                    if (!isMatch) {
                      return res.send({ unauthorized: true })
                    }
                    // update and save
                    user.email = req.body.email
                    user
                      .save()
                      .then((savedUser) => {
                        // delete all validations of this email and type (including this one) and send token
                        db.Validation.deleteMany({
                          email: req.body.email,
                          type: 'changeemail',
                        })
                          .then(() =>
                            res.send({
                              token: token.getToken(savedUser),
                              user: users.trimUser(savedUser),
                              levelData: points.getLevelData(
                                savedUser.points,
                                config.levelThresholds
                              ),
                            })
                          )

                          .catch((error) => res.send(error))
                      })
                      .catch((error) => res.send(error))
                  }
                )
              })
              .catch((error) => res.send(error))
          } else {
            return res.send({ expired: true })
          }
        })
        .catch((error) => res.send(error))
    })
    .catch((error) => res.send(error))
}
