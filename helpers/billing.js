const IAP = require('in-app-purchase')
const PlayValidator = require('google-play-billing-validator')
require('dotenv').config()

const playOptions = {
  email: process.env.GOOGLE_PRIVATE_KEY_EMAIL,
  key: JSON.parse(process.env.GOOGLE_PRIVATE_KEY_STRING).key, // format key as object in .env
}

const playVerifier = new PlayValidator(playOptions)

const configuration = {
  /* Configurations for Apple */
  appleExcludeOldTransactions: false, // if you want to exclude old transaction, set this to true. Default is false
  applePassword: 'xxx', // this comes from iTunes Connect (You need this to valiate subscriptions)

  /* Configurations for Google Service Account validation: You can validate with just packageName, productId, and purchaseToken */
  googleServiceAccount: {
    clientEmail: process.env.GOOGLE_PRIVATE_KEY_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY_STRING,
  },

  /* Configurations for Google Play */
  // not needed if using strings below
  // googlePublicKeyPath: 'path/to/public/key/directory/', // this is the path to the directory containing iap-sanbox/iap-live files
  googlePublicKeyStrSandBox: 'publicKeySandboxString', // this is the google iap-sandbox public key string
  googlePublicKeyStrLive: process.env.GOOGLE_PUBLIC_KEY, // this is the google iap-live public key string

  /* Configurations all platforms */
  test: false, // For Apple and Googl Play to force Sandbox validation only
  verbose: true, // Output debug logs to stdout stream
}

IAP.config(configuration)

IAP.setup()
  .then(() => console.log('IAP.setup success'))
  .catch((err) => console.log('IAP.setup  err =', err))

// call this before turning a user's premium "true" from "false"
// it checks the purchase receipt stored on a user's profile
// validating a receipt that has expired shouldn't work

exports.validatePremium = (transaction, attempt = 1) => {
  return new Promise((resolve, reject) => {
    console.log('running validatePremium, attempt ' + attempt)
    console.log('transaction =', transaction)

    if (attempt > 3) {
      console.log('out of attempts')

      return resolve(false)
    }

    if (!transaction || !transaction.receipt) {
      return resolve(false)
    }

    // for Android, "transaction" includes "productId" - for ios, just "receipt"
    if (transaction.productId) {
      if (!transaction) {
        return resolve(false)
      }

      const receipt = {
        packageName: 'com.swattup',
        productId: transaction.productId,
        purchaseToken: transaction.receipt,
      }

      console.log('receipt =', receipt)

      playVerifier
        .verifySub(receipt)
        .then((response) => {
          // valid
          console.log('verifySub response =', response)

          const data = response.payload

          console.log(
            `subscription ${
              data.autoRenewing ? 'is' : 'is not'
            } autorenewing. expires ${new Date(
              Number(data.expiryTimeMillis)
            ).toString()}`
          )

          // if sub isn't set to auto renew, and expiry time has passed, validation fails
          if (!data.autoRenewing) {
            if (Number(data.expiryTimeMillis) < new Date().getTime()) {
              console.log('subscription expired')

              return resolve(false)
            }
          }

          return resolve({
            autoRenewing: data.autoRenewing,
            expiryTimeMillis: data.expiryTimeMillis,
            purchase: transaction,
          })
        })
        .catch((error) => {
          console.log('verifySub error =', error)

          if (error.errorMessage.code === 'ENOTFOUND') {
            return exports.validatePremium(transaction, attempt + 1)
          } else {
            return resolve(false)
          }
        })
    } else {
      IAP.validate(transaction.receipt)
        .then((validatedData) => {
          const autoRenewing =
            validatedData.pending_renewal_info[0].auto_renew_status === '1'

          console.log(
            'validatedData.pending_renewal_info =',
            validatedData.pending_renewal_info
          )
          console.log('autoRenewing =', autoRenewing)

          const purchaseData = IAP.getPurchaseData(validatedData, {})
          const data = purchaseData[0]

          console.log('data =', data)
          console.log(
            'expiration date',
            new Date(data.expirationDate).toString()
          )

          // if sub isn't set to auto renew, and expiry time has passed, validation fails
          if (data.expirationDate < new Date().getTime()) {
            console.log('subscription expired')

            return resolve(false)
          }

          return resolve({
            autoRenewing: autoRenewing,
            expiryTimeMillis: data.expirationDate,
            purchase: transaction,
          })
        })
        .catch((error) => {
          console.log('IAP.validate error =', error)
        })
    }
  })
}
