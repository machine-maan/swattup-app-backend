var mongoose = require('mongoose')

var schema = new mongoose.Schema({
  store: String,
  title: String,
  code: String,
  icon: String,
  camelIcon: String, // icon in camel-case (as opposed to kebab-case)
  URL: String,
  level: Number,
  expiry: String,
  date: String,
})

var Voucher = mongoose.model('Voucher', schema)

module.exports = Voucher
