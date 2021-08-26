var mongoose = require('mongoose')
var bcrypt = require('bcryptjs')

var schema = new mongoose.Schema({
  email: String,
  code: String,
  type: String, // "signup" or "forgotpassword"
  date: String,
  validated: Boolean,
})

// disabled code-hashing so that we can re-send the same code. accordingly, compareCode has been simplified

// function hashCode(next) {
//     var user = this;

//     if (!user.isModified('code')) return next();

//     bcrypt.hash(user.code, 10)
//     .then((hashedCode) => {
//         user.code = hashedCode
//         next();
//     }, (err) => {
//         return next(err)
//     });
// }

// schema.pre('save', hashCode)

schema.methods.compareCode = function (candidateCode, next) {
  if (candidateCode === this.code) {
    next(null, true)
  } else {
    next(null, false)
  }

  // bcrypt.compare(candidateCode, this.code, (err, isMatch) => {
  //     if (err) {
  //         return next(err);
  //     }
  //     next(null, isMatch);
  // });
}

var Validation = mongoose.model('Validation', schema)

module.exports = Validation
