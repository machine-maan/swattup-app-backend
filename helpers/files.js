const MobileDetect = require('mobile-detect')
const db = require('../models')
const points = require('./points')
const notifications = require('./notifications')

const AWS = require('aws-sdk')
// const s3 = new AWS.S3({
//   accessKeyId: 'xxx',
//   secretAccessKey: 'xxx',
//   region: 'eu-west-2',
// })

const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint('fra1.digitaloceanspaces.com'),
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET,
})

// const bucket = 'swattup-public'
// const privateBucket = 'swattup-private'
const bucket = 'cookietaker-clients'
const privateBucket = 'cookietaker-clients'
const privatePrefix = 'swattupPrivate'

const newAvatarMessage =
  "Good job uploading a profile photo, we hope you're getting settled in!"

exports.deleteFile = (req, res) => {
  const { organisation, file } = req.body

  // make sure organisation exists, file belongs it, and token is creator
  // if found, pull file from it and delete in S3
  db.Crowd.findOneAndUpdate(
    {
      name: organisation,
      organisation: true,
      creator: req.token._id,
      'files.file': file,
    },
    {
      $pull: { files: { file: file } },
    },
    {
      new: true,
    }
  )
    .then((crowd) => {
      if (!crowd) {
        return res.send({ unauthorized: true })
      }

      s3.deleteObject(
        { Bucket: privateBucket, Key: `${privatePrefix}/files/${file}` },
        (err) => {
          if (err) {
            res.send(err)
            return
          }

          return res.send({ success: true })
        }
      )
    })
    .catch((err) => res.send(err))
}

exports.requestFile = (req, res) => {
  const { organisation, file } = req.body

  // make sure there's an organisation with this name, where the token is a member or leader, and which this file belongs to
  db.Crowd.findOne({
    name: organisation,
    organisation: true,
    $or: [{ users: req.token._id }, { leaders: req.token._id }],
    'files.file': file,
  })
    .then((crowd) => {
      if (!crowd) {
        return res.send({ unauthorized: true })
      }

      // const find = organisation ? { _id: req.body.userID }
      // : { _id: req.body.userID, "content.subject": req.body.subject }

      console.log('crowd', crowd)

      // matching crowd found - file belongs to this one, which they're allowed into.
      const params = {
        Bucket: privateBucket,
        Key: `${privatePrefix}/files/${file}`,
        Expires: 3600,
      }

      s3.getSignedUrl('getObject', params, (err, url) => {
        if (err) {
          return res.send({ error: err })
        }

        return res.send({ URL: url, crowd: crowd })
      })
    })
    .catch((err) => res.send(err))
}

// note: for uploading files from the web to S3, you need to change the CORS settings on the bucket
exports.uploadFile = (req, res) => {
  const { title, organisation, type } = req.body

  const date = new Date().toISOString()

  const fileName = `(${organisation}) ${title}`

  db.Crowd.findOneAndUpdate(
    { name: organisation, organisation: true, creator: req.token._id },
    {
      $push: {
        files: {
          title: title,
          file: fileName,
          date: date,
          format: req.body.type,
        },
      },
    },
    { new: true }
  )
    .then((crowd) => {
      if (!crowd) {
        return res.send({ unauthorized: true })
      }

      const file = `${privatePrefix}/files/${fileName}`

      const params = {
        Bucket: privateBucket,
        Key: file,
        ContentType: type,
      }

      s3.getSignedUrl('putObject', params, (err, url) => {
        if (!err) {
          notifications.newFile(crowd, file, req.user)

          // send upload URL along with complete image name - client side will now upload to this image
          res.send({ URL: url, name: title })
        } else {
          res.send(err)
        }
      })
    })
    .catch((err) => res.send(err))
}

// get URL for uploading image of given name
// format for avatars should be avatar-<user id>.jpg
// backend always suffixes -<_id> to name
exports.uploadImage = (req, res) => {
  const fullName = `${req.body.name}-${req.params._id}`
  const file = `images/${fullName}.jpg`

  if (req.body.type === 'chat') {
    deleteAndSendURL(req, res, fullName, false, 'isPrivate')
  } else if (req.body.name === 'avatar') {
    // update avatar field to true
    db.User.findOne({ _id: req.params._id })
      .then((user) => {
        db.Config.findOne({ name: 'config' })
          .lean()
          .then((config) => {
            const pointReward = config.pointRewards.uploadAvatar

            let firstAvatar = false
            // if no avatar yet, send a notification and points
            if (!user.avatar) {
              firstAvatar = true

              const notification = {
                form: 'custom',
                message: newAvatarMessage,
                date: new Date(),
                points: pointReward,
              }

              user.points = user.points + pointReward
              user.notifications.push(notification)
            }
            user.avatar = true
            user
              .save()
              .then((user) => {
                if (firstAvatar) {
                  points.checkLevelUp(user, pointReward, config.levelThresholds)
                }
                deleteAndSendURL(req, res, fullName, firstAvatar)
              })
              .catch((error) => res.send(error))
          })
          .catch((err) => res.send(err))
      })
      .catch((error) => res.send(error))
  } else if (req.body.type === 'post') {
    deleteAndSendURL(req, res, fullName, file) // delete incase a previous submit didn't go through
  } else if (req.body.type === 'answer') {
    deleteAndSendURL(req, res, fullName, file)
  }
}

function deleteAndSendURL(req, res, fullName, firstAvatar, isPrivate) {
  const file = `${privatePrefix}/images/${fullName}.jpg`

  // delete any previous image of this file (e.g. for profile picture)
  s3.deleteObject(
    {
      Bucket: bucket,
      Key: file,
    },
    (err) => {
      if (err) {
        res.send(err)
        return
      }

      // generate URL for uploading image
      const params = {
        Bucket: isPrivate ? privateBucket : bucket,
        Key: file,
        ContentType: 'image/jpeg',
      }

      s3.getSignedUrl('putObject', params, (err, url) => {
        if (!err) {
          // send upload URL along with complete image name - client side will now upload to this image
          res.send({ URL: url, fullName: fullName, firstAvatar: firstAvatar })
        } else {
          res.send(err)
        }
      })
    }
  )
}

exports.adminDeleteImage = (req, res) => {
  const file = `images/avatar-${req.params._id}.jpg`

  // delete any previous image of this file (e.g. for profile picture)
  s3.deleteObject(
    {
      Bucket: bucket,
      Key: file,
    },
    (err) => {
      if (err) {
        res.send(err)
        return
      }

      res.send({ success: true })
    }
  )
}

exports.appStoreRedirect = (req, res) => {
  const os = new MobileDetect(req.headers['user-agent']).os()

  const storeURL =
    os === 'AndroidOS'
      ? 'https://play.google.com/store/apps/details?id=com.swattup'
      : 'https://itunes.apple.com/us/app/swattup/id1372185266'

  res.redirect(storeURL)
}

// use this when loading chats to send an array with private image URLs to put into redux
// pass in an array of image names, including -_id but not .jpg
exports.requestImages = (req, res) => {
  console.log('ffjfg');
  let names = req.body.names

  // if given just one image, make it into an array
  if (names.constructor !== Array) {
    names = [names]
  }

  const collection = []

  let calls = names.length

  for (let i = 0; i < calls; i++) {
    const file = `${privatePrefix}/images/${names[i]}.jpg`
    const params = { Bucket: privateBucket, Key: file, Expires: 86400 }

    s3.getSignedUrl('getObject', params, (err, url) => {
      err && console.log('err =', err)

      // add name with URL to collection
      collection.push({ name: names[i], URL: url })

      // reduce counter by 1
      calls -= 1

      // if all done, return the collection
      if (calls === 0) {
        return res.send({ images: collection })
      }
    })
  }
}

exports.getSignedURLsForFiles = function (names) {
  // if given just one image, make it into an array
  if (!Array.isArray(names)) {
    names = [names]
  }

  return new Promise(async function (resolve) {
    const collection = []

    let calls = names.length
    if (calls === 0) {
      return resolve(collection)
    }

    for (let i = 0; i < calls; i++) {
      const file = `${privatePrefix}/images/${names[i]}.jpg`
      const params = { Bucket: privateBucket, Key: file }

      if (
        await s3
          .headObject(params)
          .promise()
          .catch(() => false)
      ) {
        s3.getSignedUrl(
          'getObject',
          { ...params, Expires: 86400 },
          (err, url) => {
            err && console.log('err =', err)

            // add name with URL to collection
            collection.push({ name: names[i], exists: true, URL: url })

            // reduce counter by 1
            calls -= 1

            // if all done, return the collection
            if (calls === 0) {
              return resolve(collection)
            }
          }
        )
      } else {
        collection.push({ name: names[i], exists: false })
        calls--

        if (calls === 0) {
          return resolve(collection)
        }
      }
    }
  })
}
