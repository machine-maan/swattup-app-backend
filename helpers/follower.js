const db = require('../models')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId;
const async = require('async')
const jwt = require('jsonwebtoken')
const commonHelper = require('./commonHelper')
const logHelper = require('./logHelper')
const followerService = require('../services/followerService')
const userResource = require('../resources/userResource');
const paginationHelper = require('./paginationHelper');

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

exports.followUnfollowUser = (req, res) => {
    var userId = req.body.userId;
    var followerId = req.body.followerId;
    var status = req.body.status;

    if (userId == followerId) {
        return res.status(422).send({
            message: 'User and follower should not be same.',
            status: false,
            statusCode: 422,
        })
    }

    db.User.find(
        {
            _id: { $in: [userId, followerId] },
        },
        function (err, user) {
            if (!user.length) {
                return res.status(422).send({
                    message: 'Follower or following id is invalid',
                    status: false,
                    statusCode: 422,
                })
            } else {
                // Save Records
                var user_follower_set = {
                    userId: userId,
                    followerId: followerId,
                    status: status,
                }
                db.Follower.findOneAndUpdate(
                    {
                    userId: userId,
                    followerId: followerId,
                    },
                    { $set: user_follower_set },
                    { upsert: true, new: true, setDefaultsOnInsert: true },
                    async function (err, updated_follower) {
                        if (err) {
                            return res.status(401).send({
                                message: '' + err,
                                status: false,
                                statusCode: 401,
                            })
                        }
                        var n_message = status == 0 ? 'Unfollow' : 'Following'
                        logHelper.log(
                            userId,
                            followerId,
                            n_message,
                            'FOLLOW'
                        )
                        return res.status(200).send({
                            message: n_message,
                            status: true,
                            statusCode: 200,
                            responseData: updated_follower,
                        })
                    }
                )
            }
        }
    )
}

exports.getFollower = (req, res) => {
    const response_arr = []
    const userId = req.body.userId
    db.User.findOne(
    {
        _id: userId,
    },
    async function (err, user) {
        if (!user) {
            return res.status(404).send({
                message: 'User not found',
                status: false,
                statusCode: 404,
            })
        } else {
            let followerData = await followerService.aggregate([
                {
                    $match: {
                        userId: ObjectId(userId),
                        status: '1',
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "followerId",
                        foreignField: "_id",
                        as: "followerData"
                    }
                },
                { $unwind: '$followerData'},
            ], paginationHelper(req));

            await Promise.all(
                followerData.data = followerData.data.map(e => {
                    return userResource(e.followerData)
                })
            )

            return res.status(200).send({
                message: 'follower data fetched successfully!',
                status: true,
                statusCode: 200,
                responseData: followerData.data,
                metadata: followerData.metadata,
            })
        }
    })
}

exports.getFollowing = (req, res) => {
    const response_arr = []
    const userId = req.body.userId
    db.User.findOne(
    {
        _id: userId,
    },
    async function (err, user) {
        if (!user) {
            return res.status(401).send({
                message: 'User not found',
                status: false,
                statusCode: 401,
            })
        } else {
            let followings = await followerService.aggregate([
                {
                    $match: { followerId: user._id, status: '1' }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'userData',
                    }
                },
                { $unwind: '$userData' }
            ], paginationHelper(req));

            await Promise.all(
                followings.data = followings.data.map(e => userResource(e.userData))
            )

            return res.status(200).send({
                message: 'following data fetched successfully!',
                status: true,
                statusCode: 200,
                responseData: followings.data,
                metadata: followings.metadata,
            })
        }
    })
}

exports.getFollowerAndFollowingCount = (req, res) => {
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
      const userId = req.body.userId
      var followerCount = await db.Follower.countDocuments({
        userId: userId,
        status: 1,
      })
      var followingCount = await db.Follower.countDocuments({
        followerId: userId,
        status: 1,
      })

      var response_arr = {
        followerCount: followerCount,
        followingCount: followingCount,
      }

      return res.status(200).send({
        message: 'follower and following count fetched successfully!',
        status: true,
        statusCode: 200,
        responseData: response_arr,
      })
    }
  })
}
