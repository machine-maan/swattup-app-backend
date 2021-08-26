const db = require('../models')

const apiKey = 'xxx'
const domain = 'mailgun.swattup.com'
const host = 'api.eu.mailgun.net'
exports.mailgun = require('mailgun-js')({ apiKey, domain, host })

exports.getTerms = (req, res) => {
  db.Config.findOne({ name: 'terms' })
    .then((item) => res.send({ terms: item.note }))
    .catch((err) => res.send(err))
}

exports.getPrivacyPolicy = (req, res) => {
  db.Config.findOne({ name: 'privacy' })
    .then((item) => res.send({ privacy: item.note }))
    .catch((err) => res.send(err))
}

exports.updateTerms = (req, res) => {
  db.Config.findOneAndUpdate(
    { name: 'terms' },
    { note: req.body.body },
    { new: true }
  )
    .then((result) => res.send({ success: true, body: result }))
    .catch((err) => res.send(err))
}

exports.updatePrivacyPolicy = (req, res) => {
  db.Config.findOneAndUpdate(
    { name: 'privacy' },
    { note: req.body.body },
    { new: true }
  )
    .then((result) => res.send({ success: true, body: result }))
    .catch((err) => res.send(err))
}

exports.reportItem = (req, res) => {
  // send email
  const data = {
    from: 'SwattUp <noreply@swattup.com>',
    to: ['tecocraftganesh@gmail.com'],
    subject: `A report has been made on SwattUp`,
    html: req.body.report,
  }

  exports.mailgun.messages().send(data, (error, body) => {
    if (error || !body) {
      return res.send(error || { error: true })
    }
    return res.send({ sent: true })
  })
}
