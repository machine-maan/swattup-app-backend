const db = require('../models')

exports.getVouchers = (req, res) => {
  db.Voucher.find()
    .lean()
    .sort({ level: 1, expiry: 1 })
    .then((vouchers) => res.send({ vouchers }))
    .catch((err) => res.send(err))
}

exports.addVoucher = (req, res) => {
  if (req.body.URL.slice(0, 4) !== 'http') {
    req.body.URL = 'http://' + req.body.URL
  }

  const URL = `http://go.redirectingat.com/?id=122049X1582485&url=${req.body.URL}`

  db.Voucher.create({
    title: req.body.title,
    URL: URL,
    store: req.body.store,
    icon: req.body.icon,
    camelIcon: req.body.camelIcon,
    code: req.body.code,
    expiry: req.body.expiry,
    level: req.body.level,
    date: new Date().toISOString(),
  })
    .then((voucher) => res.send({ success: true, voucher }))
    .catch((err) => res.send(err))
}

exports.deleteVoucher = (req, res) => {
  db.Voucher.deleteOne({ _id: req.params._id })
    .then(() => {
      res.send({ success: true })
    })
    .catch((err) => res.send(err))
}
