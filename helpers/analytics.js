const db = require('../models')

const mixpanel = require('mixpanel').init(db.dev ? 'xxx' : 'xxx')

const ip = '127.0.0.1' // clear IP data so server location isn't passed through

exports.trackAssignedInitialPopUpLocation = (user, location) => {
  const body = {
    ip,
    distinct_id: user._id,
    $email: user.email,
    Username: user.username,

    Location:
      location === 'sign_up'
        ? 'Initial pop-up after sign-up'
        : 'Initial pop-up after second app open',
  }

  mixpanel.track('Assigned initial premium pop-up location', body)
}

exports.trackAssignedPopUpAVariant = (user, variant) => {
  const body = {
    ip,
    distinct_id: user._id,
    $email: user.email,
    Username: user.username,

    variant:
      variant === 1
        ? 'Pop-up A, variant 1 (original)'
        : 'Pop-up A, variant 2 (direct sales)',
  }

  mixpanel.track('Assigned pop-up A variant', body)
}
