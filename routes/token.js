const jwt = require('jsonwebtoken')
const admin = require('firebase-admin')
var db = require('../models')
const crypto = require('crypto')

admin.initializeApp({
  // firebase-adminsdk-wfchi@swattup-demo.iam.gserviceaccount.com
  credential: admin.credential.cert({
    "type": "service_account",
    "project_id": "swattup-d3638",
    "private_key_id": "8336f166991f96fe2fcf76f359ca471ef9b1b9c5",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGLrPHDI6shcFw\nhGp604C+l/3CxwV/pc/Y019k6+ThVV7VhbIbFnYSjodjYr9fxeHigjjHR1i3Qk8m\nILNWDBR95TxRKc0J76or2e625nM9ILHPpvC897C4ANJ2W4qoPJtBCgFt54spLIXG\nAqbuPdBTqw8QiN9fwTsfmZscvcTk2k4U/HbTvX43LdyE11nnXaNFKfXHh/Y7+olB\numxctLQMU8hh8b4c5y3MMoLqtVxrsClvTwK1IrW3Q6oycWzH1LersoUI3wSO8Rgq\nowfgbWjeJn93h/vW8VlZFEp2fwqGd8bV4sG0zCxZkjKITZUnocR4eWx4VW3Hb23m\nnKnfS3k1AgMBAAECggEAGWLDFuSwuUBa5872asGr6f4YfHo3kJh3QtF0lJNeRU+a\nWbnfTMv4QjvtSMRN5PaOjuVaYOBuk0Q+/5B3GGHCFYxRyR2/Ih4yi0fGZbmoRPTA\nAhbixc8+h5tcr4TeAoXc50cLqX3cMWEpc5SZuHEaPerD/7y19uiOv7yn21XNok4V\nuHismn2iaxgbAd+anRBmuRmGYYm/F1ak+zEeXtM0lJLXYz4ierm1Isr8+ert9Dsz\ntrfdRGN2fzeRIWlLNojnbQngbEQRAwyUrg4ms+LZ7fZflstGMTtjenKB7CDsYr4N\nP0hasMzA2Xcho/OgHhUs5j4lOb0X2k9SRX76sS6gIwKBgQD6pN00tJuFAI8h/TqI\nN2/OyCz2f2fZYnQnuKwljvfYzsxafD0Cx/eDvrvL+MvCroWOPGg7fYsP4WMLg00H\nLDdnqy1wRyg+5sLPCNbpBuxjfv1T8sBCEWQtCJe7k9AbJv1BqbgVWEo1L7J6bynm\n6NX0irm8uyZV0hxPmB/ti6GuJwKBgQDKatmE5ogrf2U/ZZje0gG1hUUvNSyM+h82\nQLawJ78PXOpxRkr/vxK/cyppw9+CuHNAgRP2RKrt3oQFgjm1hm1XDutjQap+lwzL\nlIZE4Cz3n8prrhWtHwVrHmDy7h+nc15IPlvh/gAeV8jdcme8+RyAnSTpDDEVSGSH\nTRos4kITQwKBgBScK+hilYs5QYvM89wxmssJINFgJpz0gJKnl9g6ylyUnK8wGiA5\nazv1GiIqoi6vBSJuCzAhIac7pFZVBKd7Vk76/3CFGWUaupglpO5ieFuyHIijpHWK\nUo91bmypOeqRqS+WEiIHMYrwEiAJNgvbx4QlSCKhzQQvk85jtvRkj/XvAoGAEksz\n23oGRoAeA2vINCMgumoQBaM1oowcdAfHOwZskxPfsFsc/h4jsJ/U7nggZC0NZYAE\n8NXl6NeacPEDDC/ZA+w6Q980bHp0UpXayLDF/582aSLznJDYKYU2V95DiBu6IqdY\nIIWXNybR5YmobIDLHaiWJGXQrc68HypNuk68kAcCgYEA3KuaTnNskufzCIPizD3F\nYD6cB4f8zA/GZwdlcR/0eO+Yfmd7lcRsO8PSFI1mC0Oh2OvQ59S6KZiWxr6m2B6j\nHrHexx9zfEJmFTMQq4OdasgBtfk8D8HiAltkV0VmiF/QV5/hx63PJdM9dRDUPq2S\nNjb2Ohq6Lw9xZA69oVjDi40=\n-----END PRIVATE KEY-----\n",
    "client_email": "swattup-d3638@appspot.gserviceaccount.com",
    "client_id": "",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/swattup-d3638%40appspot.gserviceaccount.com"
  }
  ),
  databaseURL: 'https://swattup-d3638.firebaseio.com',
})



// const userId = 'some-uid';
// const additionalClaims = {
//   premiumAccount: true,
// };

// admin
//   .auth()
//   .createCustomToken(userId, additionalClaims)
//   .then((customToken) => {
//     // Send token back to client
//   })
//   .catch((error) => {
//     console.log('Error creating custom token:', error);
//   });

exports.getToken = (user) => {
  const token = jwt.sign(
    {
      _id: user._id,
      type: user.type,
      organiser: user.organiser,
      check: crypto
        .createHash('md5')
        .update(`${user._id}${user.type}${user.firebaseUserID}`)
        .digest('hex'),
    },
    process.env.SECRET_KEY
  )
  return token
}

// #dev - get token
// const users = require('../helpers/users')
// const { auth } = require('firebase-admin')
// db.User.findOne({
//   username: 'freddie',
// })
//   .then((user) => {
//     console.log('user._id =', user._id)
//     console.log(users.trimUser(user))
//     console.log(exports.getToken(user))
//   })
//   .catch((err) => console.log(err))

// exports.getAuthToken = function (req, res, next) {
//   // console.log('token');
//   // console.log('authorization',req.headers.authorization);
//   if (req.headers.authorization) {
//     req.authToken = req.headers.authorization.split(' ')[1]
//   } else {
//     req.authToken = null
//   }
//   next()
// }

function getUser(authId) {
  // console.log('user_id',authId);
  try {
    return admin
      .auth()
      .getUser(authId)
      .then((userRecord) => {
        // See the UserRecord reference doc for the contents of userRecord.
        console.log(`Successfully fetched user data:`, userRecord)
        return {
          displayName: userRecord.displayName,
          photoURL: userRecord.photoURL,
          emailVerified: userRecord.emailVerified,
          uid: userRecord.uid,
          disabled: userRecord.disabled,
          lastSignIn: userRecord.metadata.lastSignInTime,
          email: userRecord.email,
          phone: userRecord.phone,
          username: userRecord.displayName.replace(/\s+/g, '_').toLowerCase(),
          authProvider: userRecord.providerData[0].providerId,
          authProviderData: userRecord.providerData[0],
        }
      })
      .catch((error) => {
        res.status(500).send({ unauthorized: true })
      })
  } catch (e) {
    return res.status(500).send({ unauthorized: true, errorOccurred: true })
  }
}

// Process Firebase
exports.processFirebase = async (req, res, next) => { 
  try {
    const { authToken } = req  
    const userInfo = await admin.auth().verifyIdToken(authToken)
    console.log('userInfo',userInfo);
    req.firebaseUserID = userInfo.uid
    req.firebaseUser = await getUser(userInfo.uid)
    return next()
  } catch (e) {
    return res.status(401).send({ unauthorized: true })
  }
}

// runs before every request
exports.decode = (req, res, next) => {
  console.log('token', req.token)
  req.token = false


  const authorization =
    req.headers.authorization && req.headers.authorization !== undefined
      ? req.headers.authorization
      : req.query.authorization && req.query.authorization !== undefined
      ? req.query.authorization
      : null

  if (authorization) {
    jwt.verify(authorization, process.env.SECRET_KEY, (err, decoded) => {
      if (err) {
        console.log(err)
      } else if (decoded) {
        req.token = decoded
      }
      next()
    })
  } else {
    next()
  }
}

exports.require = (req, res, next) => {
  if (!req.token || !req.token._id) {
    return res.send({ unauthorized: true })
  }

  db.User.findById(req.token._id)
    .lean()
    .then((user) => {
      if (
        crypto
          .createHash('md5')
          .update(`${user._id}${user.type}${user.firebaseUserID}`)
          .digest('hex') === req.token.check
      ) {
        req.user = user
        next()
      } else {
        console.log('Hash mismatch')
        return res.send({ unauthorized: true })
      }
    })
    .catch((error) => {
      console.log(error)
      return res.send({ unauthorized: true })
    })
}

exports.matchesID = (req, res, next) => {
  console.log('token', req.token)
  if (!req.token || req.token._id !== req.params._id) {
    return res.send({ unauthorized: true })
  }

  db.User.findById(req.params._id)
    .lean()
    .then((user) => {
      if (user.passwordDate && user.passwordDate === req.token.passwordDate) {
        next()
      } else {
        return res.send({ unauthorized: true })
      }
    })
    .catch((error) => {
      console.log(error)
      return res.send({ unauthorized: true })
    })
}

// requires req.token._id === req.body.userID
exports.matchesBodyUserID = (req, res, next) => {
  console.log('token', req.authorization)
  if (!req.token || req.token._id !== req.body.userID) {
    return res.send({ unauthorized: true })
  }

  db.User.findById(req.body.userID)
    .lean()
    .then((user) => {
      if (user.passwordDate && user.passwordDate === req.token.passwordDate) {
        req.user = user
        next()
      } else {
        return res.send({ unauthorized: true })
      }
    })
    .catch((error) => {
      console.log(error)
      return res.send({ unauthorized: true })
    })
}

exports.admin = (req, res, next) => {
  console.log('token', req.token)
  if (!req.token || req.token.type !== 'admin') {
    return res.send({ unauthorized: true })
  }

  // look up the yser ID and make sure they're (still) an admin, as well as checking passwordDate
  db.User.findById(req.token._id)
    .lean()
    .then((user) => {
      if (
        !user.passwordDate ||
        user.passwordDate !== req.token.passwordDate ||
        user.type !== 'admin'
      ) {
        return res.send({ unauthorized: true })
      }
      return next()
    })
    .catch((error) => {
      console.log(error)
      return res.send({ unauthorized: true })
    })
}

exports.organiser = (req, res, next) => {
  if (
    !req.token ||
    (req.token.organiser !== true && req.token.type !== 'admin')
  ) {
    return res.send({ unauthorized: true })
  }

  // look up the user ID and make sure they're (still) an organiser, as well as checking passwordDate
  db.User.findById(req.token._id)
    .lean()
    .then((user) => {
      if (
        !user.passwordDate ||
        user.passwordDate !== req.token.passwordDate ||
        user.organiser !== true
      ) {
        return res.send({ unauthorized: true })
      }
      req.user = user

      return next()
    })
    .catch((error) => {
      console.log(error)
      return res.send({ unauthorized: true })
    })
}
