const db = require('../models')
const token = require('../routes/token')
const points = require('./points')
const notifications = require('./notifications')
const crowds = require('./crowds')
const async = require('async')
const Stripe = require('stripe')
var nodemailer = require('nodemailer')
const jwt = require('jsonwebtoken')
const fs = require('fs')
var path = require('path')
const AWS = require('aws-sdk')
const commonHelper = require('./commonHelper')
const userResource = require('../resources/userResource')
const mongoose = require('mongoose')
const logHelper = require('./logHelper')
const configHelper = require('./configHelper')
const userService = require('../services/userService')
const crowdInterestService = require('../services/crowdInterestService')
const crowdGoalService = require('../services/crowdGoalService')
const dateHelper = require('./dateHelper')
const paginationHelper = require('./paginationHelper')
const questionService = require('../services/questionService')

function uploadToS3Bucket(filePath, fileName) {
    const AWS_ACCESS_KEY = 'AKIASW4K5WL2ERJS7HG2'
    const AWS_SECRET_ACCESS_KEY = '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'
    const BUCKET_NAME = 'swattup-app-bucket'

    const fileContent = fs.readFileSync(filePath)

    const s3 = new AWS.S3({
        accessKeyId: AWS_ACCESS_KEY,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    })

    const params = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: fileContent,
        ACL: 'public-read',
    }

    var s3upload = s3.upload(params).promise()
    // return the `Promise`
    s3upload
        .then(function (data) {
            return data.Location
        })
        .catch(function (err) {
            return handleError(err)
        })

    /* return new Promise((resolve, reject) => {
      s3.upload(params, function(err, data) {
        if (err) return reject(err);
        resolve(data);
      });
    }); */
}

function updateActivityLog(userId, UniqueId, Activity, type) {
    db.User.findOne({ _id: userId }, async function (err, user_data) {
        if (user_data) {
            var logData = {
                userId: userId,
                uniqueId: UniqueId,
                activity: Activity,
                type: type,
                date: new Date().toISOString(),
            }
            db.ActivityLog.create(logData)
                .then((question) => {
                    return true
                })
                .catch((error) => {
                    console.log(error)
                    return false
                })
        } else {
            console.log('user_data not found')
            return false
        }
    })
}

exports.countUnreadNotifications = (user) => {
    // count unread notifications and add onto user object
    // start from end and break when reaching a 'read' one
    let unread = 0

    for (let i = user.notifications.length - 1; i >= 0; i--) {
        if (user.notifications[i].read) {
            break
        } else {
            unread += 1
        }
    }

    // max 50 (as we'll only ever fetch 50)
    if (unread > 50) {
        unread = 50
    }

    return unread
}

// should be called before res.send-ing full user
exports.trimUser = (originalUser) => {
    const user = originalUser.toObject()

    user.unreadNotifications = exports.countUnreadNotifications(user)

    // delete excessive keys
    delete user.content
    delete user.notifications
    delete user.premiumPurchase
    delete user.blockedBy

    return user
}

exports.findFriends = (req, res) => {
    db.Config.findOne({ name: 'config' })
        .lean()
        .then((config) => {
            db.User.find(
                { phone: { $in: req.body.numbers } },
                { _id: 1, username: 1, phone: 1, points: 1, tutor: 1, premium: 1 }
            )
                .lean()
                .then((users) => {
                    users.forEach((user) => {
                        user.level = points.getLevelData(
                            user.points,
                            config.levelThresholds,
                            true
                        ).level
                    })
                    res.send({ users })
                })
                .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
}

// when signing in, we send user with an unreadNotifications field
// when they receive a new notification, the client's unreadNotifications goes up by 1 (but we don't send all notifications)
// only when they go on notifications screen, do we fetch notifications
// when they leave this screen, all notifications are marked read and client unreadNotifications goes back to 0
exports.fetchNotifications = (req, res) => {
    db.Config.findOne({ name: 'config' })
        .lean()
        .then((config) => {
            db.User.findOne({ _id: req.token._id }, { notifications: 1, points: 1 })
                .lean()
                .then((user) => {
                    let limit = 20
                    const skip = Number(req.params.skip)
                    const length = user.notifications.length

                    const totalSkip = skip + limit

                    let startPoint = length - totalSkip // e.g. length 70, seen 40 and want 20, so start at 10

                    // if we're requesting to skip past more notifications than there actually are
                    // e.g. asking to skip 40 and get 20, so total skip is 60 from the end
                    // and there are only 51 notifications
                    // give them 11 notifications and change the starting point to 0
                    if (startPoint < 0) {
                        limit = startPoint + limit // so if we were at -9, -9 plus 20 means give them 11
                        if (limit < 0) {
                            limit = 0 // if they're skipping way too much and even +20 we're still in minus, return nothing
                        }

                        startPoint = 0 // using old startPoint above so this must be at the bottom
                    }

                    // get the slice
                    const notificationSlice = user.notifications.slice(
                        startPoint,
                        startPoint + limit
                    )

                    // build array of user id's to fetch light profiles for
                    const userList = []

                    notificationSlice.forEach((item) => {
                        if (!userList.includes(item.user)) {
                            userList.push(item.user)
                        }
                    })

                    points
                        .fetchLightProfiles(userList, config)
                        .then((userData) => {
                            res.send({
                                levelData: points.getLevelData(
                                    user.points,
                                    config.levelThresholds
                                ), // update user level data
                                notifications: notificationSlice,
                                users: userData,
                            })
                        })
                        .catch((err) => res.send(err))
                })
                .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
}

exports.markNotificationsRead = (req, res) => {
    // console.log('fkjfkjg');
    db.User.findOne({ _id: req.token._id })
        .then((user) => {
            console.log('user', user)
            for (let i = user.notifications.length - 1; i >= 0; i--) {
                if (user.notifications[i].read) {
                    break
                } else {
                    user.notifications[i].read = true
                }
            }
            user
                .save()
                .then(() => res.send({ unreadNotifications: 0 }))
                .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
}

const fields = [
    'firstName',
    'lastName',
    'phone',
    'learningLevel',
    'learningSubject',
    'school',
    'deviceID',
    'consentEmails',
    // doing subjects and password manually
]

exports.updateUser = (req, res) => {
    db.User.findOne({ _id: req.params._id })
        .then((user) => {
            // for every allowable field, if it's provided in req.body update it in user
            for (let i = 0; i < fields.length; i++) {
                if (req.body[fields[i]] !== undefined) {
                    user[fields[i]] = req.body[fields[i]]
                }
            }

            // if we've passed in a learning level (i.e. not just saving subjects), then overwrite learningSubject and school even if they're undefined (i.e. cleared due to changing learningLevel)
            if (req.body.learningLevel) {
                user.learningSubject = req.body.learningSubject
                user.school = req.body.school
            }

            // clear subject and school if not undergrad/postgrad/tutor/professional
            if (
                req.body.learningLevel &&
                req.body.learningLevel !== 'Undergraduate' &&
                req.body.learningLevel !== 'Postgraduate' &&
                req.body.learningLevel !== 'Tutor' &&
                req.body.learningLevel !== 'Professional'
            ) {
                user.school = undefined
                user.learningSubject = undefined
            }

            if (req.body.learningLevel === 'Professional') {
                user.learningSubject = undefined
            }

            // if subjects given, for each subject...
            if (req.body.subjects) {
                const newCrowds = []

                // if user does not have content collection for any given subjects, create it
                req.body.subjects.forEach((subject) => {
                    if (
                        !user.content.find((collection) => collection.subject === subject)
                    ) {
                        // if first time joining a crowd, add it to a list to auto-subscribe
                        newCrowds.push(subject)

                        user.content.push({
                            subject: subject,
                            answers: [],
                            questions: [],
                            saved: [],
                            comments: [],
                        })
                    }
                })

                // compare original user.subjects and req.body.subjects to see which subjects have been removed
                const removedCrowds = user.subjects.filter(
                    (item) => !req.body.subjects.includes(item)
                )

                // remove these from the subscriptions document for that crowd
                crowds.batchUnsubscribe(user._id, removedCrowds)

                // remove any subscriptions from the user array which aren't in the new subjects list, or in user's organisations
                user.subscriptions = user.subscriptions.filter((item) => {
                    return (
                        req.body.subjects.includes(item) ||
                        user.organisations.includes(item)
                    )
                })

                // add any new crowds to user subscriptions
                user.subscriptions = user.subscriptions.concat(newCrowds)

                // add user to crowd subscriptions
                crowds.subscribeToCrowds(user._id, newCrowds)

                // update user.subjects
                user.subjects = req.body.subjects

                // update the crowds objects to add this user
                crowds.addUserToCrowds(req.body.subjects, user._id)
            }

            // if password was provided, make sure currentPassword was also provided and is correct
            if (req.body.password) {
                user.comparePassword(req.body.currentPassword || '', (err, isMatch) => {
                    if (err) {
                        return res.send(err)
                    }
                    if (!isMatch) {
                        return res.send({ unauthorized: true })
                    }
                    user.password = req.body.password
                    user.passwordDate = new Date().toString()
                    saveUser(user, res)
                })
            } else {
                return saveUser(user, res)
            }
        })
        .catch((error) => res.send(error))
}

function saveUser(user, res) {
    // save and return with new token incase password changed
    return user
        .save()
        .then((savedUser) =>
            res.send({
                token: token.getToken(savedUser),
                user: exports.trimUser(user),
            })
        )
        .catch((error) => res.send(error))
}

/* exports.followUser = (req, res) => {
  console.log('follow user');
  const { action } = req.params

  // if (req.params._id === req.token._id) {
  //   return res.send({ self: true })
  // }

  if (action === 'subscribe' || action === 'unsubscribe') {
    return subscribeUser(req, res)
  }

  const pushOrPull = action === 'follow' ? '$addToSet' : '$pull'

  const notification = {
    form: 'newFollower',
    user: req.token._id,
    date: new Date().toString(),
  }

  // for target user
  const commands = {
    [pushOrPull]: {
      followers: req.token._id,
      followersSubscribed: req.token._id,
    },
  }

  if (action === 'follow') {
    commands.$push = { notifications: notification }
  }

  // targetted user
  db.User.findOneAndUpdate({ _id: req.params._id }, commands)
    .then((targetUser) => {
      // console.log('targetUser',targetUser);
      // initial user
      db.User.findOneAndUpdate(
        // { _id: req.token._id },
        {
          [pushOrPull]: {
            following: req.params._id,
            followingSubscribed: req.params._id,
          },
        },
        { new: true } // return updated document
      )
        .then((user) => {
          // console.log('user',user);
          if (action === 'follow') {
            // console.log('jjsfsf');
            notifications.newFollower(targetUser, user)
          }

          // delete excessive bits before sending
          delete user.notifications
          delete user.content

          // send own user back, and then client may re-fetch target profile
          res.send({ user: exports.trimUser(user) })
        })
        .catch((error) => res.send(error))
    })
    .catch((error) => res.send(error))
}
 */
const subscribeUser = (req, res) => {
    // console.log('jjkdgdfd');
    const { action } = req.params

    const pushOrPull = action === 'subscribe' ? '$addToSet' : '$pull'

    // targetted user
    db.User.findOneAndUpdate(
        { _id: req.params._id },
        { [pushOrPull]: { followersSubscribed: req.token._id } }
    )
        .then((targetUser) => {
            // initial user
            db.User.findOneAndUpdate(
                { _id: req.token._id },
                {
                    [pushOrPull]: {
                        followingSubscribed: req.params._id,
                    },
                },
                { new: true } // return updated document
            )
                .then((user) => {
                    // delete excessive bits before sending
                    delete user.notifications
                    delete user.content

                    // send own user back, and then client may re-fetch target profile
                    res.send({ user: exports.trimUser(user) })
                })
                .catch((error) => res.send(error))
        })
        .catch((error) => res.send(error))
}

// send public profile
exports.fetchUserDetail = (req, res) => {
    let follow_query = {
        userId: req.body.profileUserId,
        followerId: req.body.loginUserId,
        status: 1,
    }
    let subscribe_query = {
        coachUserID: req.body.profileUserId,
        learnerUserID: req.body.loginUserId,
        isActive: 1,
    }
    db.User.findOne({ _id: req.body.profileUserId }).then(async function (
        user_data
    ) {
        if (user_data) {
            var following = await db.Follower.countDocuments(follow_query)
            var subscribe = await db.Subscription.countDocuments(subscribe_query)

            var response_arr = {
                _id: user_data._id,
                followStatus: following > 0 ? true : false,
                subscribeStatus: subscribe > 0 ? true : false,
                fullName: user_data.fullName ? user_data.fullName : '',
                username: user_data.username,
                aboutMe: user_data.aboutMe ? user_data.aboutMe : '',
                profileImage: commonHelper.getProfileImage(user_data.profileImage),
            }

            res.status(200).send({
                message: 'User detail fetched',
                status: true,
                statusCode: 200,
                responseData: response_arr,
            })
        } else {
            res.status(401).send({
                message: 'User not found',
                status: false,
                statusCode: 401,
            })
        }
    })
}

exports.fetchFullProfile = (req, res) => {
    let query

    if (req.params.username) {
        query = { username: req.params.username }
    } else {
        query = { _id: req.params._id }
    }

    db.User.findOne(query)
        .lean()
        .then((user) => {
            console.log('user', user)
            if (!user) {
                return res.send({ notFound: true })
            }

            db.Config.findOne({ name: 'config' })
                .lean()
                .then((config) => {
                    console.log('config', config)
                    // figure out if blocked or blocking, and append as isBlocked
                    const blockList = req.user.blocked.concat(req.user.blockedBy)

                    let isBlocked

                    if (
                        blockList.find((item) => item.toString() === user._id.toString())
                    ) {
                        isBlocked = true
                    }

                    const profile = {
                        _id: user._id,
                        username: user.username,
                        firstName: user.firstName,
                        lastName: user.lastName,

                        // explicitly true or false - if undefined, still loading so we hide message button just in case
                        isBlocked: isBlocked ? true : false,

                        tutor: user.tutor,
                        premium: user.premium,

                        learningLevel: user.learningLevel,
                        learningSubject: user.learningSubject,
                        school: user.school,

                        points: user.points,
                        levelData: points.getLevelData(user.points, config.levelThresholds),

                        // only return content collections for crowds that the user's still a part of
                        content: user.content.filter((collection) =>
                            user.subjects.find((item) => item === collection.subject)
                        ),

                        joinDate: user.joinDate,

                        followers: user.followers,
                        following: user.following,

                        followersSubscribed: user.followersSubscribed,
                        followingSubscribed: user.followingSubscribed,
                    }
                    console.log('profile', profile)

                    // #dev - used to tweak generated bot profiles for running tests
                    // for each subject, if it doesn't have an entry in content (e.g. no questions/answers), create it so it still turns up on their profile
                    // user.subjects.forEach(subject => {
                    //     if(!profile.content.find(collection => collection.subject === subject)) {
                    //         profile.content.push({ subject: subject, answers: [], questions: [] })
                    //     }
                    // })

                    // populate light profiles of users in followers or following
                    const combinedUserList = user.followers.concat(user.following)
                    // console.log('combinedUserList',user.followers);

                    points
                        .fetchLightProfiles(combinedUserList, config)
                        .then((userData) => res.send({ profile: profile, users: userData }))
                        .catch((error) => res.send(error))
                })
                .catch((error) => res.send(error))
        })
        .catch(() => res.send({ notFound: true }))
}

const maxInvitePoints = 100
const invitedNotificationMessage =
    'Thanks for inviting friends to SwattUp! See which contacts are on the app and invite more on the Friends tab.'

exports.claimInvitePoints = (req, res) => {
    let { points } = req.params
    // console.log('maxInvitePoints',maxInvitePoints)

    if (points > maxInvitePoints) {
        points = maxInvitePoints
    }

    const notification = {
        form: 'custom',
        message: invitedNotificationMessage,
        date: new Date(),
        points: points,
    }

    // user.points = user.points + pointReward
    // user.notifications.push(notification)

    db.User.findOneAndUpdate(
        {
            _id: req.token._id,
            invitedFriends: { $ne: true },
        },
        {
            $addToSet: { notifications: notification },
            $inc: { points: points },
            invitedFriends: true,
        },
        {
            new: true,
        }
    )
        .then((user) => {
            if (!user) {
                return res.send({ unauthorized: true })
            }

            // level up if needed
            db.Config.findOne({ name: 'config' })
                .lean()
                .then((config) => {
                    points.checkLevelUp(user, points, config.levelThresholds)
                })
                .catch((err) => console.log(err))

            return res.send({ success: true })
        })
        .catch((err) => res.send(err))
}

exports.devUpdateUser = (req, res) => {
    db.Question.updateMany(
        {
            subject: '12345',
        },
        {
            organisation: true,
        },
        {
            new: true,
        }
    )
        .then((result) => res.send(result))
        .catch((err) => res.send(err))

    // db.User.findOneAndUpdate({
    //     username: "dan16"
    // }, {
    //     organisationLimit: 30
    // }, {
    //     new: true
    // })
    // .then(result => res.send(result))
    // .catch(err => res.send(err))
}

/* exports.setTopics = (req, res) => {
  db.Config.findOne({ name: 'config' })
    .lean()
    .then((config) => {
      db.User.findOne({ _id: req.token._id })
        .lean()
        .then((user) => {
          // Update User
          db.User.updateOne(
            { _id: req.token._id },
            {
              topics: req.body.topics,
            }
          )
            .then((result) => {
              res.send({ status: 'OK', message: 'Topics updated' })
            })
            .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
} */

/* exports.setGoals = (req, res) => {
  // console.log('jdgd');
  // console.log('token_id',req.token._id);
  db.Config.findOne({ name: 'config' })
    .lean()
    .then((config) => {
      db.User.findOne({ _id: req.token._id })
        .lean()
        .then((user) => {
          console.log('user',user);
          // Update User
          db.User.updateOne(
            { _id: req.token._id },
            {
              goals: req.body.goals,
            }
          )
            .then((result) => {
              res.send({ status: 'OK', message: 'Goals updated' })
            })
            .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
} */

/* exports.getGoals = (req, res) => {
  // console.log('jdgd');
  // console.log('token_id',req.token._id);
  db.Config.findOne({ name: 'config' })
    .lean()
    .then((config) => {
      db.User.findOne({ _id: req.token._id })
        .lean()
        .then((user) => {
          console.log('user',user);
          // Update User
          db.User.updateOne(
            { _id: req.token._id },
            {
              goals: req.body.goals,
            }
          )
            .then((result) => {
              res.send({ status: 'OK', message: 'Goals updated' })
            })
            .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
} */

exports.getInterestGoals = (req, res) => {
    db.User.findOne({ _id: req.params.user_id })
        .then(async function (user) {
            if (user == null) {
                return res.status(404).send({
                    message: 'User not found',
                    status: false,
                    statusCode: 404,
                })
            }

            let resTopics = [];
            let resGoals = [];
            if (user) {
                if (user.topics) {
                    resTopics = await crowdInterestService.getByIds(user.topics);
                }

                if (user.goals) {
                    resGoals = await crowdGoalService.getByIds(user.goals);
                }
            }
            console.log('resGoals..', resTopics, resGoals);
            let crowdList = resGoals.concat(resTopics);
            // let supportCrowd = await db._Crowd.findOne({
            //     _id: '607982adf5e9aa0f9454a38f', // Support crowdId
            // }).then((sRes) => sRes);
            crowdList.unshift(configHelper.SUPPORT_CROWD);

            if (crowdList.length) {
                let mappedRes = [];

                await Promise.all(
                    crowdList.map(async (e) => {
                        let userCount = 0, questionCount = 0;
                        let query = {}
                        if (e._id == configHelper.SUPPORT_CROWD._id) {
                            query = {}
                        } else {
                            if (e.goalsName) {
                                query = {
                                    goals: {
                                        $in: [
                                            e._id,
                                        ],
                                    },
                                    _id: { $ne: req.user._id }
                                }
                            } else {
                                query = {
                                    topics: {
                                        $in: [
                                            e._id,
                                        ],
                                    },
                                    _id: { $ne: req.user._id }
                                }
                            }
                        }

                        userCount = await userService.count(query);
                        questionCount = await questionService.count({
                            crowdID: e._id,
                        });

                        mappedRes.push({
                            _id: e._id,
                            // crowdsId: e.crowdsId,
                            name: e.goalsName ? e.goalsName : e.interestName,
                            image: e.image ? e.image : '',
                            userCount: userCount ? userCount : 0,
                            questionCount: questionCount ? questionCount : 0,
                            createdDate: dateHelper().convert(e.createdAt),
                        });
                    })
                );

                mappedRes = mappedRes.sort((a, b) => {
                    if (a.name == b.name) return 0;
                    if (a.name == configHelper.SUPPORT_CROWD.interestName) return -1;
                    if (b.name == configHelper.SUPPORT_CROWD.interestName) return 1;

                    if (a.name < b.name)
                        return -1;
                    if (a.name > b.name)
                        return 1;
                    return 0;
                });

                return res.status(200).send({
                    message: 'User goals and interests fetched successfully',
                    status: true,
                    statusCode: 200,
                    responseData: mappedRes,
                });
            }

            return res.status(404).send({
                message: 'Interest an goals not found',
                status: false,
                statusCode: 404,
            })
        })
}

exports.setGoals = (req, res) => {
    db.User.findOne({ _id: req.params.user_id })
        .lean()
        .then((user) => {
            if (user == null) {
                res.status(401).send({
                    message: 'User not found',
                    status: false,
                    statusCode: 401,
                })
            }
            db.User.updateOne(
                { _id: req.params.user_id },
                {
                    goals: req.body.goals,
                }
            )
                .then(async (result) => {
                    var details
                    details = await db.CrowdGoals.find({ _id: { $in: req.body.goals } })

                    res.status(200).send({
                        message: 'Goals updated',
                        status: true,
                        statusCode: 200,
                        responseData: details,
                    })
                })
                .catch((err) =>
                    res.status(401).send({
                        message: err + '',
                        status: false,
                        statusCode: 401,
                    })
                )
        })
        .catch((err) =>
            res.status(401).send({
                message: err + '',
                status: false,
                statusCode: 401,
            })
        )
}

exports.setTopics = (req, res) => {
    db.User.findOne({ _id: req.params.user_id })
        .lean()
        .then((user) => {
            if (user == null) {
                res.status(401).send({
                    message: 'User not found',
                    status: false,
                    statusCode: 401,
                })
            }
            db.User.updateOne(
                { _id: req.params.user_id },
                {
                    topics: req.body.topics,
                }
            )
                .then(async (result) => {
                    var details
                    details = await db.CrowdsIntersts.find({
                        _id: { $in: req.body.topics },
                    })

                    res.status(200).send({
                        message: 'Topics updated',
                        status: true,
                        statusCode: 200,
                        responseData: details,
                    })
                })
                .catch((err) =>
                    res.status(401).send({
                        message: err,
                        status: false,
                        statusCode: 401,
                    })
                )
        })
        .catch((err) =>
            res.status(401).send({
                message: err,
                status: false,
                statusCode: 401,
            })
        )
}

exports.setGoalsTopics = (req, res) => {
    db.User.findOne({ _id: req.params.user_id })
        .lean()
        .then((user) => {
            if (user == null) {
                res.status(401).send({
                    message: 'User not found',
                    status: false,
                    statusCode: 401,
                })
            }

            db.User.updateOne(
                { _id: req.params.user_id },
                {
                    topics: req.body.topics,
                    goals: req.body.goals,
                }
            )
                .then(async (result) => {
                    var topics_detail = await db.CrowdsIntersts.find({
                        _id: { $in: req.body.topics },
                    })
                    var crowds_detail = await db.CrowdGoals.find({
                        _id: { $in: req.body.goals },
                    })
                    res.status(200).send({
                        message: 'Goals and Topics updated',
                        status: true,
                        statusCode: 200,
                        responseData: {
                            topics: topics_detail,
                            goals: crowds_detail,
                        },
                    })
                })
                .catch((err) =>
                    res.status(401).send({
                        message: err,
                        status: false,
                        statusCode: 401,
                    })
                )
        })
        .catch((err) =>
            res.status(401).send({
                message: err,
                status: false,
                statusCode: 401,
            })
        )
}

exports.agreeToTerms = (req, res) => {
    // console.log('jhjfk');
    db.Config.findOne({ name: 'config' })
        .lean()
        .then((config) => {
            db.User.findOne({ _id: req.token._id })
                .lean()
                .then((user) => {
                    // Update User
                    db.User.updateOne(
                        { _id: req.token._id },
                        {
                            agreeToTerms: req.body.termsVersion,
                        }
                    )
                        .then((result) => {
                            res.send({ status: 'OK', message: 'Goals updated' })
                        })
                        .catch((err) => res.send(err))
                })
                .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
}

exports.addComment = (req, res) => {
    const id = req.body.id
    const answerId = req.body.answerId
    const userId = req.body.userId
    const comments = req.body.comments
    const comment_data = {
        answerId: answerId,
        userId: userId,
        comments: comments,
    }
    db.Comment.create(comment_data)
        .then(() => {
            res.send({
                success: true,
                message: 'comment data inserted!',
            })
        })
        .catch((error) =>
            res.send({ success: false, message: 'comment not found!' })
        )
}

exports.editComment = (req, res) => {
    const id = req.body.id
    const userId = req.body.userId
    const comments = req.body.comments
    const myquery = { _id: id }
    const comment_data = {
        userId: userId,
        comments: comments,
    }
    const newvalues = { $set: comment_data }

    db.Comment.updateOne(myquery, newvalues, function (err, res) {
        console.log('data update successfully')
    })
    res
        .send({
            success: true,
            message: 'comment data updated!',
        })
        .catch((error) =>
            res.send({ success: false, message: 'comment not updated!' })
        )
}

exports.getCommentList = (req, res) => {
    const response_arr = []
    const comment_reply_arr = []
    db.Comment.find()
        .lean()
        .populate([
            {
                path: 'userId',
                select: 'email username',
            },
        ])
        .exec((err, comments) => {
            async.forEachOf(
                comments,
                (comment_data, key, callback) => {
                    db.CommentReply.find({ commentId: comment_data._id })
                        .lean()
                        .populate([
                            {
                                path: 'userId',
                                select: 'email username',
                            },
                        ])
                        .exec((err, comments_reply_data) => {
                            async.forEachOf(
                                comments_reply_data,
                                (reply_arr, key, callback1) => {
                                    comment_reply_arr.push(reply_arr)
                                    callback1()
                                },
                                (err) => {
                                    var create_comment_reply_arr = []
                                    for (let i = 0; comment_reply_arr[i]; i++) {
                                        create_comment_reply_arr.push(comment_reply_arr[i])
                                    }

                                    response_arr.push({
                                        _id: comment_data._id,
                                        userId: comment_data.userId._id,
                                        userEmail: comment_data.userId.email,
                                        username: comment_data.userId.username,
                                        comments: comment_data.comments,
                                        reply: create_comment_reply_arr,
                                    })
                                    callback()
                                }
                            )
                        })
                },
                (err) => {
                    if (err) console.error(err.message)
                    res.send({
                        success: true,
                        message: 'comment could data get successfully!',
                        data: response_arr,
                    })
                }
            )
        })
    // .sort({ lowercaseName: 1 })
}

// exports.getComment = (req, res) => {
//   const response_arr = []
//   db.Comment.find()
//     .lean()
//     .populate([
//       {
//         path: 'userId',
//         select: 'email username',
//       },
//     ])
//     .exec((err, comments) => {
//       async.forEachOf(
//         comments,
//         (comment_data, key, callback) => {
//           response_arr.push({
//             _id: comment_data._id,
//             userId: comment_data.userId._id,
//             userEmail: comment_data.userId.email,
//             username: comment_data.userId.username,
//             comments: comment_data.comments,
//           })
//           callback()
//         },
//         (err) => {
//           if (err) console.error(err.message)
//           res.send({
//             success: true,
//             message: 'comment could data get successfully!',
//             data: response_arr,
//           })
//         }
//       )
//     })
//   // .sort({ lowercaseName: 1 })
// }

exports.addCommentReply = (req, res) => {
    const commentId = req.body.commentId
    const userId = req.body.userId
    const reply = req.body.reply

    const comment_reply_data = {
        commentId: commentId,
        userId: userId,
        reply: reply,
    }

    db.CommentReply.create(comment_reply_data)
        .then(() => {
            res.send({
                success: true,
                message: 'comment reply data inserted!',
            })
        })
        .catch((error) =>
            res.send({ success: false, message: 'comment reply data not found!' })
        )
}

exports.addReview = (req, res) => {
    const review_data = {
        reviewerId: req.user._id,
        userId: req.body.userId,
        rating: req.body.rating,
        description: req.body.description,
    }

    if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
        return res.status(422).send({
            status: false,
            message: 'invalid userId!',
        })
    };

    db.User.findOne({
        _id: req.body.userId,
        type: configHelper.USER_TYPE_PROFESSIONAL,
    }).then((profUser) => {
        if (!profUser) {
            return res.status(404).send({
                status: false,
                message: 'coach not found!',
            })
        }

        db.Review
            .findOneAndUpdate(
                {
                    reviewerId: req.user._id,
                    userId: req.body.userId,
                },
                { $set: review_data },
                { upsert: true, new: true, setDefaultsOnInsert: true },
                async function (err, reviewData) {
                    if (err) {
                        return res.status(401).send({
                            message: '' + err,
                            status: false,
                            statusCode: 401,
                        })
                    }
                    return res.send({
                        success: true,
                        message: 'review data inserted!',
                    })
                }
            )
            ;
    })
}

// exports.editReview = (req, res) => {
//   const id = req.body.id
//   const userId = req.body.userId
//   const reviews = req.body.reviews
//   const myquery = { _id: id }
//   const review_data = {
//     userId: userId,
//     reviews: reviews,
//   }
//   const newvalues = { $set: review_data }

//   db.Review.updateOne(myquery, newvalues, function (err, res) {
//     console.log('data update successfully')
//   })
//   res
//     .send({
//       success: true,
//       message: 'review data updated!',
//     })
//     .catch((error) =>
//       res.send({ success: false, message: 'review not updated!' })
//     )
// }

exports.getReview = async (req, res) => {
    let bodyParams = {};
    if (req.body.userId) {
        bodyParams['userId'] = req.body.userId;
    }
    if (req.body.reviewerId) {
        bodyParams['reviewerId'] = req.body.reviewerId;
    }

    let queryParams = await commonHelper.getFilterSortFields({
        ...req.query,
        ...bodyParams,
    }, {
        equal: {
            'userId': {},
            'reviewerId': {},
        },
    });
    let searchParams = {};
    if (!commonHelper.isObjectEmpty(queryParams.filter)) {
        searchParams = { ...queryParams.filter };
    }

    db.Review.find({
        ...queryParams.filter,
        sort: searchParams.sort,
    })
        .lean()
        .populate([
            {
                path: 'reviewerId',
            },
            {
                path: 'userId',
            },
        ])
        .sort(queryParams.sort)
        .exec((err, reviews) => {
            if (!reviews) {
                return res.send({
                    success: true,
                    message: 'review data not found!',
                    data: [],
                })
            }
            reviews = reviews.map(e => ({
                _id: e._id,
                reviewer: userResource(e.reviewerId),
                user: userResource(e.userId),
                rating: commonHelper.removeDecimals(e.rating),
                description: e.description,
                date: dateHelper().convert(e.updatedAt),
            }));

            return res.send({
                success: true,
                message: 'review data get successfully!',
                data: reviews,
            })
        })
    // .sort({ lowercaseName: 1 })
}

module.exports.subscribeCoach = async function (req, res) {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

    db.User.findOne({ _id: req.body.coachUserId, type: configHelper.USER_TYPE_PROFESSIONAL }, async function (
        err,
        user_data
    ) {
        if (err) {
            return res.status(400).send({
                success: false,
                message: '' + err,
                statusCode: 400,
            })
        } else {
            if (user_data) {
                db.User.findOne({ _id: req.body.learnerUserId, type: configHelper.USER_TYPE_LEARNER }, async function (
                    err,
                    learner_data
                ) {
                    if (!learner_data) {
                        return res.status(404).send({
                            success: false,
                            message: 'Learner not found',
                            statusCode: 404,
                        })
                    } else {
                        db.Subscription.findOne(
                            {
                                coachUserID: req.body.coachUserId,
                                learnerUserID: req.body.learnerUserId,
                            },
                            async function (err, subscription_data) {
                                if (err) {
                                    return res.status(400).send({
                                        success: false,
                                        message: '' + err,
                                        statusCode: 400,
                                    })
                                } else {
                                    if (subscription_data) {
                                        currentDate = new Date()
                                        console.log(subscription_data)
                                        console.log(subscription_data.endDate, currentDate)

                                        if (subscription_data.isActive == true) {
                                            return res.status(422).send({
                                                success: false,
                                                message:
                                                    'Learner has already subscribed to this coach.',
                                                statusCode: 422,
                                            })
                                        } else if (subscription_data.endDate >= currentDate) {
                                            return res.status(422).send({
                                                success: false,
                                                message:
                                                    "You can't subscribe to this coach at the moment. Please try after " +
                                                    subscription_data.endDate,
                                                statusCode: 422,
                                            })
                                        }
                                    }

                                    const CUSTOMER_EMAIL = learner_data.email
                                    const CUSTOMER_SOURCE = req.body.stripeToken
                                    var customerID = ''
                                    if (learner_data.stripeCustomerId) {
                                        customerID = learner_data.stripeCustomerId
                                    } else {
                                        const customer = await stripe.customers
                                            .create({
                                                email: CUSTOMER_EMAIL,
                                                source: CUSTOMER_SOURCE,
                                            })
                                            .catch((exception) => {
                                                return res.status(400).send({
                                                    success: false,
                                                    message: '' + exception,
                                                    statusCode: 400,
                                                })
                                            })
                                        customerID = customer.id

                                        await db.User.findOneAndUpdate(
                                            {
                                                _id: req.body.learnerUserId,
                                            },
                                            {
                                                $set: {
                                                    stripeCustomerId: customerID,
                                                },
                                            },
                                            { new: true }
                                        )
                                    }

                                    const PRODUCT_NAME = 'Monthly Subscription'
                                    const PRODUCT_TYPE = 'service'

                                    const product = await stripe.products
                                        .create({
                                            name: PRODUCT_NAME,
                                            type: PRODUCT_TYPE,
                                        })
                                        .catch((exception) => {
                                            return res.status(400).send({
                                                success: false,
                                                message: '' + exception,
                                                statusCode: 400,
                                            })
                                        })
                                    const PRODUCT_ID = product.id
                                    const PLAN_INTERVAL = 'month'
                                    const CURRENCY = process.env.STRIPE_CURRENCY
                                    const PLAN_PRICE = parseInt(user_data.subscriptionPrice) * 100

                                    await stripe.subscriptions
                                        .create({
                                            customer: customerID,
                                            items: [
                                                {
                                                    price_data: {
                                                        unit_amount: PLAN_PRICE,
                                                        currency: CURRENCY,
                                                        product: PRODUCT_ID,
                                                        recurring: {
                                                            interval: PLAN_INTERVAL,
                                                        },
                                                    },
                                                },
                                            ],
                                            metadata: {
                                                coachUserID: req.body.coachUserId,
                                                learnerUserID: req.body.learnerUserId,
                                                learnerEmail: learner_data.email,
                                            },
                                        })
                                        .then(function (subscription) {
                                            const subscriptionData = {
                                                coachUserID: req.body.coachUserId,
                                                learnerUserID: req.body.learnerUserId,
                                                stripeSubscriptionId: subscription.id,
                                                subscriptionAmount: subscription.plan.amount / 100,
                                                subscriptionCurrency: subscription.plan.currency,
                                                subscriptionDate: new Date(
                                                    subscription.created * 1000
                                                ),
                                                startDate: new Date(
                                                    subscription.current_period_start * 1000
                                                ),
                                                endDate: new Date(
                                                    subscription.current_period_end * 1000
                                                ),
                                                isActive: subscription.status === 'active' ? true : false,
                                            }

                                            db.Subscription.create(subscriptionData)
                                                .then(async function (subscriptionData) {
                                                    if (subscriptionData) {
                                                        logHelper.log(
                                                            subscriptionData.learnerUserID,
                                                            subscriptionData._id,
                                                            'Subscribed to coach',
                                                            'SUBSCRIBE'
                                                        )
                                                        db.Wallet.create({
                                                            subscriptionCallId: subscriptionData._id,
                                                            coachUserId: subscriptionData.coachUserID,
                                                            credit:
                                                                subscriptionData.subscriptionAmount * 0.8,
                                                            type: 'SUBSCRIPTION',
                                                            currency:
                                                                subscriptionData.subscriptionCurrency,
                                                        }).then((wallet_data) => {
                                                            if (wallet_data) {
                                                                return res.status(200).send({
                                                                    success: true,
                                                                    message: 'Subscribed successfully',
                                                                    responseData: subscriptionData,
                                                                    statusCode: 200,
                                                                })
                                                            }
                                                            return res.status(403).send({
                                                                status: false,
                                                                statusCode: 403,
                                                                message: 'Subscribed but failed to manage wallet.',
                                                            })
                                                        })
                                                    } else {
                                                        return res.status(500).json({
                                                            status: false,
                                                            statusCode: 500,
                                                            message: 'Something went wrong.',
                                                        })
                                                    }
                                                })
                                                .catch((err) => {
                                                    return res.status(401).json({
                                                        status: false,
                                                        statusCode: 401,
                                                        message: '' + err,
                                                    })
                                                })
                                        })
                                        .catch((error) => {
                                            return res.status(400).send({
                                                success: false,
                                                message: '' + error,
                                                statusCode: 400,
                                            })
                                        })
                                }
                            })
                            .sort({ _id: -1 })
                            .limit(1)
                            .catch((error) => {
                                return res.status(401).send({
                                    success: false,
                                    message: '' + error,
                                    statusCode: 401,
                                })
                            })
                    }
                })
            } else {
                return res.status(404).json({
                    status: false,
                    statusCode: 404,
                    message: 'Coach not found',
                })
            }
        }
    })
}

module.exports.updateSubscription = async function (req, res) {
    console.log('start', req.body.data.object.lines.data[0].period.start)
    console.log('end', req.body.data.object.lines.data[0].period.end)
    const subscriptionId = req.body.data.object.subscription
    const eventId = req.body.id
    const startPeriod = new Date(
        req.body.data.object.lines.data[0].period.start * 1000
    )
    const endPeriod = new Date(
        req.body.data.object.lines.data[0].period.end * 1000
    )
    const paymentType = req.body.type
    const paymentStatus = req.body.data.object.status

    const subscription_set = {
        stripeSubscriptionId: subscriptionId,
        eventId: eventId,
        startDate: startPeriod,
        endDate: endPeriod,
        type: paymentType,
        status: paymentStatus,
    }
    db.SubscriptionUpdates.findOneAndUpdate(
        {
            eventId: eventId,
        },
        { $set: subscription_set },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).then((inserted_data) => {
        if (
            req.body.type == 'invoice.payment_succeeded' &&
            req.body.data.object.status == 'paid'
        ) {
            db.Subscription.findOneAndUpdate(
                { stripeSubscriptionId: subscriptionId },
                {
                    startDate: startPeriod,
                    endDate: endPeriod,
                },
                { new: true }
            ).then((data) => {
                res.send({
                    message: 'subscription updated',
                    responseData: data,
                })
            })
        } else {
            res.send({
                message: 'subscription not updated because payment is failed',
                responseData: inserted_data,
            })
        }
    })
}

module.exports.unSubscribeCoach = async function (req, res) {
    const auth_token = req.token
    const secret = '123456'
    jwt.verify(auth_token, secret, async (err, authData) => {
        if (err) {
            res.status(401).send({
                message: 'Invalid Auth Token',
                status: false,
                statusCode: 401,
            })
        } else {
            const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

            db.User.findOne({ _id: req.body.coachUserId, type: configHelper.USER_TYPE_PROFESSIONAL }, async function (
                err,
                user_data
            ) {
                if (user_data) {
                    db.User.findOne({ _id: req.body.learnerUserId, type: configHelper.USER_TYPE_LEARNER }, async function (
                        err,
                        learner_data
                    ) {
                        if (!learner_data) {
                            res.status(404).send({
                                success: false,
                                message: 'Learner not found',
                                statusCode: 404,
                            })
                        } else {
                            db.Subscription.findOne(
                                {
                                    coachUserID: req.body.coachUserId,
                                    learnerUserID: req.body.learnerUserId,
                                    isActive: true,
                                },
                                async function (err, subscription_data) {
                                    if (err) {
                                        res.status(401).send({
                                            success: false,
                                            message: '' + err,
                                            statusCode: 401,
                                        })
                                    } else {
                                        if (subscription_data == null) {
                                            return res.status(401).send({
                                                success: false,
                                                message: 'User has already unsubscribed this coach',
                                                statusCode: 401,
                                            })
                                        }

                                        const subscriptionId =
                                            subscription_data.stripeSubscriptionId
                                        await stripe.subscriptions
                                            .del(subscriptionId)
                                            .then(function (unsubscribeData) {
                                                const query = { _id: subscription_data.id }
                                                // Set some fields in that document
                                                const update = {
                                                    $set: {
                                                        isActive: false,
                                                        unSubscriptionDate: unsubscribeData.canceled_at,
                                                    },
                                                }
                                                // Return the updated document instead of the original document
                                                const options = { new: true }
                                                db.Subscription.findOneAndUpdate(query, update, options)
                                                    .then((updatedDocument) => {
                                                        if (updatedDocument) {
                                                            logHelper.log(
                                                                updatedDocument.learnerUserID,
                                                                updatedDocument._id,
                                                                'Unsubscribed to coach',
                                                                'SUBSCRIBE'
                                                            )
                                                            return res.status(200).send({
                                                                success: true,
                                                                message:
                                                                    'User has successfully unsubscribed this coach',
                                                                statusCode: 200,
                                                                responseData: updatedDocument,
                                                            })
                                                        } else {
                                                            return res.status(401).send({
                                                                success: false,
                                                                message:
                                                                    'Nothing found in the subscription document.',
                                                                statusCode: 401,
                                                            })
                                                        }
                                                    })
                                                    .catch((err) => {
                                                        res.status(401).send({
                                                            success: false,
                                                            message: '' + err,
                                                            statusCode: 401,
                                                        })
                                                    })
                                            })
                                            .catch((error) => {
                                                res.status(401).send({
                                                    success: false,
                                                    message: '' + error,
                                                    statusCode: 401,
                                                })
                                            })
                                    }
                                }
                            )
                                .sort({ _id: -1 })
                                .limit(1)
                                .catch((error) => {
                                    res.status(401).send({
                                        success: false,
                                        message: '' + error,
                                        statusCode: 401,
                                    })
                                })
                        }
                    }).catch((err) => {
                        return res.status(401).json({
                            status: false,
                            statusCode: 401,
                            message: '' + err,
                        })
                    })
                } else {
                    res.status(404).send({
                        success: false,
                        message: 'Coach not found',
                        statusCode: 404,
                    })
                }
            })
        }
    })
}

exports.getPeoplesYouMayLike = async (req, res) => {
    const response_arr = []
    db.User.findOne({ _id: req.body.userId }, async function (err, user_data) {
        if (err) {
            return res.status(401).json({
                status: false,
                statusCode: 401,
                message: '' + err,
            })
        } else {
            // console.log(user_data);
            // return false;
            var topics = [];
            var goals = [];
            if (user_data) {
                topics = user_data.topics
                goals = user_data.goals
            }

            if (topics.length || goals.length) {
                let userData = await userService.find({
                    _id: { $ne: user_data._id },
                    type: user_data.type,
                    $or: [{ topics: { $in: topics } }, { goals: { $in: goals } }],
                }, [], paginationHelper(req));

                return res.status(200).json({
                    status: true,
                    statusCode: 200,
                    message: 'People you may like',
                    responseData: userData.data,
                    metadata: userData.metadata,
                })
            }

            return res.status(404).json({
                status: true,
                statusCode: 404,
                message: 'People you may like not found',
                responseData: [],
            })
        }
    }).catch((err) => {
        return res.status(401).json({
            status: false,
            statusCode: 401,
            message: '' + err,
        })
    })
}

module.exports.createStripe = function (req, res) {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
    const type = req.body.type ? req.body.type : ''
    const amount = req.body.amount
    if (type == 'admin') {
        const percent = (20 / 100) * amount
        stripe.charges
            .create({
                amount: percent,
                currency: 'eur',
                source: 'tok_amex', // obtained with Stripe.js
            })
            .then(function (response) {
                if (response) {
                    res.status(200).json({
                        status: true,
                        message: 'Payment successful',
                        statusCode: 200,
                        responseData: response,
                    })
                } else {
                    res.status(401).json({
                        status: false,
                        message: 'Payment failed',
                        statusCode: 401,
                    })
                }
            })
    } else if (type == 'couch') {
        const percent = (80 / 100) * amount
        stripe.charges
            .create({
                amount: percent,
                currency: 'eur',
                source: 'tok_amex', // obtained with Stripe.js
            })
            .then(function (response) {
                if (response) {
                    res.status(200).json({
                        status: true,
                        message: 'Payment successful',
                        statusCode: 200,
                        responseData: response,
                    })
                } else {
                    res.status(401).json({
                        status: false,
                        message: 'Payment failed',
                        statusCode: 401,
                    })
                }
            })
    } else {
        stripe.charges
            .create({
                amount: amount,
                currency: 'eur',
                source: 'tok_amex', // obtained with Stripe.js
            })
            .then(function (response) {
                if (response) {
                    res.status(200).json({
                        status: true,
                        message: 'Payment successful',
                        statusCode: 200,
                        responseData: response,
                    })
                } else {
                    res.status(401).json({
                        status: false,
                        message: 'Payment failed',
                        statusCode: 401,
                    })
                }
            })
    }
}

exports.reportUser = (req, res) => {
    const reportedUserId = req.body.reportedUserId
    const reportedByUserId = req.body.reportedByUserId
    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        // secure: false,
        requireTLS: process.env.EMAIL_USE_TLS,
        auth: {
            user: process.env.EMAIL_HOST_USER,
            pass: process.env.EMAIL_HOST_PASSWORD,
        },
        // tls: { rejectUnauthorized: true },
    })
    var mailOptions = {
        from: process.env.EMAIL_HOST_USER,
        to: 'tecocraftganesh@gmail.com',
        subject: 'Someone has reported the user',
        text: 'Someone has reported the user',
    }
    transporter.sendMail(mailOptions, function (error, success) {
        if (error) {
            res.status(401).send({
                success: false,
                statusCode: 401,
                message: 'Mail not sent - ' + error,
            })
        } else {
            res.status(200).send({
                success: true,
                statusCode: 200,
                message: 'Mail successfully sent.',
                responseData: user,
            })
        }
    })
}

exports.viewUserSeparateInterestGoals = (req, res) => {
    db.User.findOne({ _id: req.params.user_id }, async function (err, user_data) {
        if (err) {
            return res.status(404).send({
                message: 'User not found',
                status: false,
                statusCode: 404,
            })
        }
        res.interest_crowd = []
        res.goal_crowd = []

        if (user_data) {
            console.log(user_data)
            if (user_data.topics) {
                res.interest_crowd = await db.CrowdsIntersts.find({
                    _id: { $in: user_data.topics },
                })
            }

            if (user_data.goals) {
                res.goal_crowd = await db.CrowdGoals.find({
                    _id: { $in: user_data.goals },
                })
            }
        }

        return res.status(200).send({
            message: 'User interest and goals fetched',
            status: true,
            statusCode: 200,
            responseData: {
                interests: res.interest_crowd,
                goals: res.goal_crowd,
            },
        })
    }).catch((err) => {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            message: '' + err,
        })
    })
}

exports.followUser = (req, res) => {
    jwt.verify(auth_token, secret, async (err, authData) => {
        if (err) {
            res.status(401).send({
                message: 'Invalid Auth Token',
                status: false,
                statusCode: 401,
            })
        } else {
        }
    })
}

exports.checkSubscriptionStatus = (req, res) => {
    const auth_token = req.token
    const secret = '123456'
    jwt.verify(auth_token, secret, async (err, authData) => {
        if (err) {
            res.status(401).send({
                message: 'Invalid Auth Token',
                status: false,
                statusCode: 401,
            })
        } else {
            const coachUserId = req.body.coachUserId
            const loginUserId = authData.id
            db.User.findOne({ _id: coachUserId }).then((couchProfiles) => {
                if (couchProfiles) {
                    db.Subscription.findOne(
                        { coachUserID: coachUserId, learnerUserID: loginUserId },
                        async function (err, subscription_data) {
                            if (err) {
                                res.status(401).send({
                                    success: false,
                                    message: '' + err,
                                    statusCode: 401,
                                })
                            } else {
                                if (subscription_data) {
                                    currentDate = new Date()

                                    if (subscription_data.isActive == true) {
                                        return res.status(401).send({
                                            success: false,
                                            message: 'Learner has already subscribed to this coach.',
                                            statusCode: 401,
                                        })
                                    } else if (subscription_data.endDate >= currentDate) {
                                        return res.status(401).send({
                                            success: false,
                                            message:
                                                "You can't subscribe to this coach at the moment as your last subscription period is not expired.",
                                            statusCode: 401,
                                        })
                                    } else {
                                        return res.status(200).send({
                                            success: true,
                                            message: 'You can subscribe this coach.',
                                            statusCode: 200,
                                        })
                                    }
                                } else {
                                    return res.status(200).send({
                                        success: true,
                                        message: 'You can subscribe this coach.',
                                        statusCode: 200,
                                    })
                                }
                            }
                        }
                    )
                        .sort({ _id: -1 })
                        .limit(1)
                        .catch((error) => {
                            res.status(401).send({
                                success: false,
                                message: '' + error,
                                statusCode: 401,
                            })
                        })
                } else {
                    res.status(401).send({
                        success: false,
                        message: 'couch profile not found!',
                        statusCode: 401,
                    })
                }
            })
        }
    })
}

exports.getSubscriptionCoachList = (req, res) => {
    db.Subscription.find({ learnerUserID: req.params.userId, isActive: true }, 'coachUserID', function (
        err,
        docs
    ) {
        if (err) {
            return res.status(401).send({
                success: false,
                message: '' + error,
                statusCode: 401,
            })
        }
        const coachUserIDs = docs.map((data) => data.coachUserID)
        db.User.find(
            { _id: { $in: coachUserIDs } },
            function (err, docs) {
                if (err) {
                    return res.status(401).send({
                        success: false,
                        message: '' + error,
                        statusCode: 401,
                    })
                }
                const response = docs.map(e => (userResource(e)))
                return res.status(200).send({
                    success: true,
                    message: 'subscription coach list get successfully!',
                    statusCode: 200,
                    responseData: response,
                })
            })
    })
}

exports.updateDeviceToken = async (req, res) => {
    console.log('req.user._id...', req.user);
    let deviceToken = req.body.deviceToken;
    let result = await userService.update(req.user._id, {
        deviceToken: deviceToken,
    });

    if (result) {
        return res.status(200).json({
            success: true,
            message: 'Device token updated successfully!',
            statusCode: 200,
        })
    }

    return res.status(400).json({
        success: false,
        message: 'Device token failed to update!',
        statusCode: 400,
    })
}
