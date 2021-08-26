const db = require('../models')
const async = require('async')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const moment = require('moment')
const Stripe = require("stripe");
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId;
const commonHelper = require('./commonHelper')

var uuidv4 = require('uuid/v4');
const AWS = require('aws-sdk');
const userResource = require('../resources/userResource')
const logHelper = require('./logHelper')
const reviewService = require('../services/reviewService')
const configHelper = require('./configHelper')
const videoResource = require('../resources/videoResource')
const globalHelper = require('./globalHelper')
const bookResource = require('../resources/bookResource')
const bookCallService = require('../services/bookCallService')
const uploadHelper = require('./uploadHelper')
const paginationHelper = require('./paginationHelper')
const userService = require('../services/userService')
const subscribtionService = require('../services/subscribtionService')
const stripeHelper = require('./stripeHelper')
const questionService = require('../services/questionService')
const Ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const crowdInterestService = require('../services/crowdInterestService')
const crowdGoalService = require('../services/crowdGoalService')
Ffmpeg.setFfmpegPath(ffmpegPath);
Ffmpeg.setFfprobePath(ffprobePath);
const S3BUCKETURL = "https://swattup-app-bucket.s3.eu-west-2.amazonaws.com/";
const coachProfileVideoPath = "coach/profile/videos/";
const coachProfileImagePath = "coach/profile/images/";
const coachVideos = "coach/videos/";
const AWS_ACCESS_KEY = "AKIASW4K5WL2ERJS7HG2";
const AWS_SECRET_ACCESS_KEY = "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";
const BUCKET_NAME = "swattup-app-bucket";
const s3 = new AWS.S3({
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
});


function uploadToS3Bucket(filePath, fileName) {

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const fileContent = fs.readFileSync(filePath);


            const s3 = new AWS.S3({
                accessKeyId: AWS_ACCESS_KEY,
                secretAccessKey: AWS_SECRET_ACCESS_KEY
            });

            const params = {
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: fileContent,
                ACL: 'public-read',
            };
            var s3upload = s3.upload(params).promise();
            resolve(s3upload)
        }, 500);

    });

}

function deleteFromS3Bucket(fileName) {


    return new Promise((resolve, reject) => {
        setTimeout(() => {


            const params = {
                Bucket: BUCKET_NAME,
                Key: fileName,
            };
            var s3delete = s3.deleteObject(params).promise();
            resolve(s3delete)
        }, 500);

    });

}

exports.createCouchProfile = (req, res) => {
    let reqPayload = commonHelper.filterPayload(req.body, {
        userId: 'userId',
        username: 'username',
        title: 'title',
        aboutMe: 'aboutMe',
        subscriptionPrice: 'subscriptionPrice',
        callPrice: 'callPrice',
        linkdinProfileUrl: 'linkdinProfileUrl',
        facebookProfileUrl: 'facebookProfileUrl',
        instagramProfileUrl: 'instagramProfileUrl',
        twitterProfileUrl: 'twitterProfileUrl',
    });

    //   const userId = req.body.userId;
    db.User
        .findOne({ _id: reqPayload.userId, type: configHelper.USER_TYPE_PROFESSIONAL })
        .then(async (user_data) => {
            if (user_data) {
                const files_param = req.files;
                const couchProfile = reqPayload;

                const proImage = req.files && req.files.image ? req.files.image : [];
                if (req.files && typeof proImage.length === 'undefined') {
                    let proImageFile = await uploadHelper.upload(
                        req.files,
                        'image',
                        'image',
                        './public/couchProfile/image/',
                        uploadHelper.COACH_PROFILE_PATH,
                        [],
                        null,
                        user_data.profileImage
                    );

                    if (proImageFile.status) {
                        couchProfile.profileImage = proImageFile.image;
                    } else {
                        return res.status(422).send({
                            status: false,
                            statusCode: 422,
                            message: proImageFile.message,
                        })
                    }
                }

                const userVideo = req.files && req.files.video ? req.files.video : [];
                if (req.files && typeof userVideo.length === 'undefined') {
                    let userVideoFile = await uploadHelper.upload(
                        req.files,
                        'video',
                        'video',
                        './public/couchProfile/video/',
                        uploadHelper.COACH_PROFILE_VIDEO_PATH,
                        [],
                        null,
                        user_data.video
                    );

                    if (userVideoFile.status) {
                        couchProfile.video = userVideoFile.video;
                    } else {
                        if (couchProfile.profileImage) {
                            uploadHelper.deleteImage(couchProfile.profileImage);
                        }

                        return res.status(422).send({
                            status: false,
                            statusCode: 422,
                            message: userVideoFile.message,
                        })
                    }
                }
                var subscriptionPriceAvailable = couchProfile.subscriptionPrice ? user_data.subscriptionPrice : null;

                db.User.findOneAndUpdate(
                    {
                        _id: reqPayload.userId
                    },
                    {
                        $set: couchProfile
                    },
                    {
                        new: true
                    }
                ).then(async (couchProfile) => {
                    if (couchProfile) {

                        if (subscriptionPriceAvailable && subscriptionPriceAvailable != couchProfile.subscriptionPrice) {
                            stripeHelper.updateSubscriptionPrice(
                                couchProfile._id,
                                couchProfile.subscriptionPrice,
                            );
                        }

                        return res.status(200).json({
                            status: true,
                            statusCode: 200,
                            message: 'Coach profile successfully updated.',
                            // responseData: couchProfile
                            responseData: userResource(couchProfile)
                        })
                    } else {
                        if (couchProfile.profileImage) {
                            uploadHelper.deleteImage(couchProfile.profileImage);
                        }
                        if (couchProfile.video) {
                            uploadHelper.deleteVideo(couchProfile.video);
                        }

                        return res.status(400).json({
                            status: false,
                            statusCode: 400,
                            message: 'Coach profile creation failed.',
                        })
                    }
                })
                    .catch((err) => {
                        if (couchProfile.profileImage) {
                            uploadHelper.deleteImage(couchProfile.profileImage);
                        }
                        if (couchProfile.video) {
                            uploadHelper.deleteVideo(couchProfile.video);
                        }

                        return res.status(400).json({
                            status: false,
                            statusCode: 400,
                            message: err,
                        })
                    });
            } else {
                return res.status(404).json({
                    status: false,
                    statusCode: 404,
                    message: "Coach not found",
                })
            }
        })
        .catch((err) => {
            return res.status(400).json({
                status: false,
                statusCode: 400,
                message: err,
            })
        });
}

exports.viewCouchProfile = (req, res) => {
    const userId = req.body.userId
    db.User
        .findOne({ _id: userId })
        .exec(async (err, couchProfiles) => {
            if (couchProfiles) {
                let follow_query = {
                    userId: userId,
                    followerId: req.user._id,
                    status: 1
                }
                let subscribe_query = {
                    coachUserID: userId,
                    learnerUserID: req.user._id,
                    isActive: 1
                }

                let [
                    following,
                    subscribe,
                    subscriberCount,
                    followerCount,
                    rating,
                    bookingDetails,
                    questionCount,
                ] = await Promise.all([
                    db.Follower.countDocuments(follow_query),
                    db.Subscription.countDocuments(subscribe_query),
                    db.Subscription.countDocuments({
                        coachUserID: userId
                    }),
                    db.Follower.countDocuments({
                        userId: userId
                    }),
                    reviewService.getAvgRatingOfUser(ObjectId(userId)),
                    bookCallService.getLatestBooking(req.user, couchProfiles),
                    questionService.count({
                        userID: userId,
                    }),
                ]);

                return res.status(200).send({
                    success: true,
                    message: 'Couch profile data fetched successfully!',
                    statusCode: 200,
                    responseData: userResource(couchProfiles, {
                        followStatus: following > 0 ? true : false,
                        subscribeStatus: subscribe > 0 ? true : false,
                        subscriberCount: subscriberCount ? subscriberCount : 0,
                        followerCount: followerCount ? followerCount : 0,
                        questionCount: questionCount ? questionCount : 0,
                        rating: rating.avg ? rating.avg : 0,
                        noOfUserRated: rating.total ? rating.total : 0,
                        bookingDetails: bookingDetails.length ? bookResource(bookingDetails[0]) : null,
                    }),
                })
            } else {
                return res.status(404).send({
                    success: false,
                    message: 'Couch profile not found!',
                    statusCode: 404,
                })
            }
        })
}

exports.addVideo = async (req, res) => {
    db.User.findOne({ _id: req.body.userId }, async function (err, coach_data) {
        if (coach_data) {
            const files_param = req.files
            const userId = req.body.userId
            const videoTitle = req.body.videoTitle
            const videoDescription = req.body.videoDescription

            const video_data = {
                userId: userId,
                videoTitle: videoTitle,
                videoDescription: videoDescription,
            }

            const userVideo = req.files && req.files.video ? req.files.video : [];
            if (req.files && typeof userVideo.length === 'undefined') {
                let userVideoFile = await uploadHelper.upload(
                    req.files,
                    'video',
                    'video',
                    './public/couchProfile/video/',
                    uploadHelper.COACH_VIDEO_PATH
                );

                if (userVideoFile.status) {
                    video_data.video = userVideoFile.video;
                } else {
                    return res.status(422).send({
                        status: false,
                        statusCode: 422,
                        message: userVideoFile.message,
                    })
                }
            } else {
                return res.status(422).json({
                    status: 422,
                    message: `"video" is required`,
                })
            }

            db.CouchVideo.create(video_data)
                .then(function (couchVideo) {
                    if (!couchVideo) {
                        if (video_data.video) {
                            uploadHelper.deleteVideo(video_data.video);
                        }

                        return res.status(404).send({
                            status: false,
                            message: 'couch data not found!',
                        })
                    } else {
                        logHelper.log(
                            couchVideo.userId,
                            couchVideo._id,
                            'New Video Added',
                            'ADDVIDEO'
                        )

                        return res.status(200).send({
                            status: true,
                            message: 'couch video data inserted!',
                            data: videoResource(couchVideo),
                        });
                    }
                })
                .catch((err) => {
                    if (video_data.video) {
                        uploadHelper.deleteVideo(video_data.video);
                    }

                    return res.status(500).json({
                        status: 0,
                        message: err.message || 'Some error occurred while creating the user.',
                    })
                })
        } else {
            return res.status(404).send({
                status: false,
                statusCode: 404,
                message: 'couch data not found',
            })
        }
    })
}

exports.removeVideo = (req, res) => {
    var id = req.body.id
    const myquery = { _id: id }
    db.CouchVideo
        .findOneAndDelete(myquery, async function (err, data) {
            if (err) {
                return res.status(400).send({
                    success: false,
                    statusCode: 400,
                    message: err,
                })
            }
            console.log('>Video data: ', data);
            if (data) {
                uploadHelper.deleteVideo(data.video);
                // await deleteFromS3Bucket(data.video.replace(S3BUCKETURL, ""))
                res.status(200).send({
                    success: true,
                    statusCode: 200,
                    message: 'video data deleted!',
                })
            } else {
                res.status(404).send({
                    success: false,
                    statusCode: 404,
                    message: 'video not exist!',
                })
            }
        }).catch((error) =>
            res.status(400).send({
                success: false,
                statusCode: 400,
                message: error,
            })
        );
}

exports.getVideo = (req, res) => {
    var userId = req.body.userId;

    db.User.findOne({ _id: userId }, function (err, coach_data) {
        if (coach_data) {
            db.CouchVideo.find({ userId: userId }, function (err, data) {
                if (err) {
                    return res.status(400).send({
                        success: false,
                        statusCode: 400,
                        message: '' + err,
                    })
                }
                let responseArr = [];
                responseArr = data.map(e => videoResource(e));
                console.log('globalHelper.authUser..', globalHelper.authUser);
                return res.status(200).send({
                    success: true,
                    statusCode: 200,
                    message: 'Videos fetched!',
                    responseData: responseArr,
                })
            });
        } else {
            return res.status(401).send({
                success: false,
                statusCode: 401,
                message: "Coach not found",
            })
        }
    })
}

exports.updateStripeAccount = async (req, res) => {

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const userId = req.query.state
    const stripeAccountId = req.query.code

    db.User.findOne(
        {
            _id: userId,
        },
        async function (err, couch_profile) {
            if (!couch_profile) {
                res.send('<center><h1 style="color: #5e9ca0;">Coach profile not found!</h1><p>Click the <button onclick="self.close()" style="background-color: #2b2301; color: #fff; display: inline-block; padding: 3px 10px; font-weight: bold; border-radius: 5px;">Close</button> button to close this window.</p></center>');
            }

            const response = await stripe.oauth.token({
                grant_type: 'authorization_code',
                code: stripeAccountId,
            });

            var connected_account_id = response.stripe_user_id;

            accounts = await stripe.accounts.retrieve(
                connected_account_id
            );




            // Update Records
            const couchProfile = {
                stripeAccountId: connected_account_id
            }

            db.User.findOneAndUpdate(
                {
                    _id: userId,
                },
                { $set: couchProfile },
                { new: true },
                function (err, couch_profile_data) {
                    if (err) {
                        res.send('<center><h1 style="color: #5e9ca0;">' + err + '!</h1><p>Click the <button onclick="self.close()" style="background-color: #2b2301; color: #fff; display: inline-block; padding: 3px 10px; font-weight: bold; border-radius: 5px;">Close</button> button to close this window.</p></center>');
                    }
                }
            ).exec(function (err, update_couch_profile_data) {
                res.send('<center><h1 style="color: #20C906;">Stripe connected successfully!</h1><p>Click the <button onclick="self.close()" style="background-color: #2b2301; color: #fff; display: inline-block; padding: 3px 10px; font-weight: bold; border-radius: 5px;">Close</button> button to close this window.</p></center>');
            })
        }
    ).lean()

}

exports.getCoachesYouMayLike = async (req, res) => {
    let queryParams = await commonHelper.getFilterSortFields(req.query, {
        equal: {
            '_id': {
                'cast': 'ObjectId',
            },
            'price': {
                'key': 'subscriptionPrice',
                'cast': 'number',
                'condition': true,
            }
        },
        like: {
            'username': {},
            'title': {},
        },
        in: {
            'rating': {
                'cast': 'number',
            },
        },
        rel: {
            'topic': ['topics', 'crowdInterst.interestName'],
            'goal': ['goals', 'crowdGoals.goalsName'],
        },
    });


    db.User.findOne({ _id: req.body.userId })
        .then(async (user_data) => {
            if (user_data) {
                if (user_data.topics.length && user_data.goals.length) {
                    const topics = user_data.topics;
                    const goals = user_data.goals;

                    let userData = await userService.aggregate([
                        {
                            $lookup: {
                                from: "reviews",
                                localField: "_id",
                                foreignField: "userId",
                                as: "ratingData"
                            }
                        },
                        {
                            "$project": {
                                "document": "$$ROOT",
                                "noOfUserRated": { $size: "$ratingData" },
                                "rating": {
                                    $avg: {
                                        "$map": {
                                            "input": "$ratingData",
                                            "in": { $avg: "$$this.rating" }
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "$replaceRoot": { newRoot: { $mergeObjects: ["$document", { rating: '$rating' }, { noOfUserRated: '$noOfUserRated' }] } }
                        },
                        {
                            $match: {
                                _id: { $ne: ObjectId(req.body.userId) },
                                $or: [{ topics: { '$in': topics } }, { goals: { '$in': goals } }],
                                type: "Professional",
                                ...queryParams.filter,
                            }
                        },
                        {
                            $sort: queryParams.sort,
                        }
                    ], paginationHelper(req));

                    userData.data = userData.data.map(e => ({
                        ...userResource(e, {
                            'rating': e.rating ? commonHelper.removeDecimals(e.rating) : 0,
                            'noOfUserRated': e.noOfUserRated ? e.noOfUserRated : 0,
                        })
                    })
                    );

                    return res.status(200).json({
                        status: true,
                        statusCode: 200,
                        message: "Coaches you may like",
                        responseData: userData.data,
                        metadata: userData.metadata,
                    });
                } else {
                    return res.status(400).json({
                        status: false,
                        statusCode: 400,
                        message: "User has not selected topics and goals.",
                    })
                }
            } else {
                return res.status(404).json({
                    status: false,
                    statusCode: 404,
                    message: "User not found.",
                })
            }

        });
}

exports.getAllCoach = async (req, res) => {
    // const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    // let uData = await stripe.subscriptions.retrieve('sub_JlTLwPrtVhDscL');
    // return res.send(uData);

    let queryParams = await commonHelper.getFilterSortFields(req.query, {
        equal: {
            '_id': {
                'cast': 'ObjectId',
            },
            'price': {
                'key': 'subscriptionPrice',
                'cast': 'number',
                'condition': true,
            }
        },
        like: {
            'username': {},
            'title': {},
        },
        in: {
            'rating': {
                'cast': 'number',
            },
            'topics': {},
            'goals': {},
        },
        rel: {
            'topic': ['topics', 'crowdInterst.interestName'],
            'goal': ['goals', 'crowdGoals.goalsName'],
        },
    });

    if (req.query.search && req.query.search != '') {
        let topicList = await crowdInterestService.getIdsBySearchText(req.query.search);
        let goalList = await crowdGoalService.getIdsBySearchText(req.query.search);

        queryParams.filter['$or'] = [
            { username: new RegExp(req.query.search, 'i') },
            { title: new RegExp(req.query.search, 'i') },
            { topics: { $in: topicList } },
            { goals: { $in: goalList } },
        ];

        delete queryParams.filter.username;
        delete queryParams.filter.title;
    }

    let baseQuery = [
        {
            $lookup: {
                from: "reviews",
                localField: "_id",
                foreignField: "userId",
                as: "ratingData"
            }
        },
        {
            "$project": {
                "document": "$$ROOT",
                "noOfUserRated": { $size: "$ratingData" },
                "rating": {
                    $avg: {
                        "$map": {
                            "input": "$ratingData",
                            "in": { $avg: "$$this.rating" }
                        }
                    }
                },
            }
        },
        {
            "$replaceRoot": { newRoot: { $mergeObjects: ["$document", { rating: '$rating' }, { noOfUserRated: '$noOfUserRated' }] } }
        },
        {
            $match: {
                _id: { $ne: ObjectId(req.user._id) },
                ...queryParams.filter,
                type: configHelper.USER_TYPE_PROFESSIONAL,
            }
        },
        {
            $sort: queryParams.sort,
        },
    ];

    let pagination = paginationHelper(req);

    let totalData = await pagination.getTotalDataByModal(db.User, baseQuery);
    let pageQuery = db.User.aggregate([
        ...baseQuery,
        ...pagination.aggregateQuery(),
    ]);
    // .sort(queryParams.sort)
    // .skip(perPage * page)
    // .limit(perPage)
    pageQuery.then((coachData) => {
        if (!coachData) {
            res.send({
                success: true,
                message: 'coach data not found!',
                data: [],
            })
        }
        coachData = coachData.map(e => ({
            ...userResource(e, {
                'rating': e.rating ? commonHelper.removeDecimals(e.rating) : 0,
                'noOfUserRated': e.noOfUserRated ? e.noOfUserRated : 0,
            })
        })
        )

        return res.send({
            success: true,
            message: 'coach data get successfully!',
            data: coachData,
            metadata: pagination.metadata(totalData),
        })
    })
}

exports.getFollowedCoach = async (req, res) => {
    let queryParams = await commonHelper.getFilterSortFields(req.query, {
        equal: {
            '_id': {
                'cast': 'ObjectId',
            },
            'price': {
                'key': 'subscriptionPrice',
                'cast': 'number',
                'condition': true,
            }
        },
        like: {
            'username': {},
            'title': {},
        },
        in: {
            'rating': {
                'cast': 'number',
            },
        },
        rel: {
            'topic': ['topics', 'crowdInterst.interestName'],
            'goal': ['goals', 'crowdGoals.goalsName'],
        },
    });

    if (req.query.search && req.query.search != '') {
        queryParams.filter['$or'] = [
            { username: new RegExp(req.query.search, 'i') },
            { title: new RegExp(req.query.search, 'i') },
        ];

        delete queryParams.filter.username;
        delete queryParams.filter.title;
    }

    let baseQuery = [
        {
            $lookup: {
                from: "followers",
                localField: "_id",
                foreignField: "userId",
                as: "followerData"
            }
        },
        { $unwind: '$followerData' },
        {
            $lookup: {
                from: "reviews",
                localField: "_id",
                foreignField: "userId",
                as: "ratingData"
            }
        },
        {
            "$project": {
                "document": "$$ROOT",
                "noOfUserRated": { $size: "$ratingData" },
                "rating": {
                    $avg: {
                        "$map": {
                            "input": "$ratingData",
                            "in": { $avg: "$$this.rating" }
                        }
                    }
                },
            }
        },
        {
            "$replaceRoot": { newRoot: { $mergeObjects: ["$document", { rating: '$rating' }, { noOfUserRated: '$noOfUserRated' }] } }
        },
        {
            $match: {
                _id: { $ne: ObjectId(req.user._id) },
                ...queryParams.filter,
                type: configHelper.USER_TYPE_PROFESSIONAL,
                'followerData.followerId': ObjectId(req.user._id),
                'followerData.status': '1',
            }
        },
        {
            $sort: queryParams.sort,
        },
    ];

    let pagination = paginationHelper(req);

    let totalData = await pagination.getTotalDataByModal(db.User, baseQuery);
    let pageQuery = db.User.aggregate([
        ...baseQuery,
        ...pagination.aggregateQuery(),
    ]);

    pageQuery.then((coachData) => {
        if (!coachData) {
            res.send({
                success: true,
                message: 'Followed coach data not found!',
                data: [],
            })
        }
        coachData = coachData.map(e => ({
            ...userResource(e, {
                'rating': e.rating ? commonHelper.removeDecimals(e.rating) : 0,
                'noOfUserRated': e.noOfUserRated ? e.noOfUserRated : 0,
            })
        })
        )

        return res.send({
            success: true,
            message: 'Followed coach data get successfully!',
            data: coachData,
            metadata: pagination.metadata(totalData),
        })
    })
}

exports.getCoachSubscribers = async (req, res) => {
    // const subscriptions = await db.Subscription.find({coachUserID: req.body.coachUserID}).populate([
    //     {
    //         path: 'learnerUserID',
    //         // select: 'email username profileImage',
    //     },
    // ])
    let subscriptions = await subscribtionService.aggregate([
        {
            $match: {
                coachUserID: ObjectId(req.body.coachUserID),
            }
        },
        {
            $sort: { subscriptionDate: -1 }
        },
        {
            $lookup: {
                from: "users",
                localField: "learnerUserID",
                foreignField: "_id",
                as: "learnerData"
            }
        },
        {
            $unwind: '$learnerData',
        }
    ], paginationHelper(req));

    await Promise.all(
        subscriptions.data = subscriptions.data.map(subscription => {
            return userResource(subscription.learnerData)
            // if (subscription.learnerUserID != null) {
            //     response_arr.push({
            //         _id: subscription.learnerUserID._id,
            //         email: subscription.learnerUserID.email,
            //         username: subscription.learnerUserID.username,
            //         profileImage: commonHelper.getProfileImage(subscription.learnerUserID.profileImage),
            //     })
            // }
        })
    )

    return res.send({
        success: true,
        message: 'subscribers get successfully',
        statusCode: 200,
        data: subscriptions.data,
        metadata: subscriptions.metadata,
    })
}

exports.getWalletAmount = (req, res) => {
    const auth_token = req.token;
    const secret = '123456';
    const coachUserID = req.body.coachUserID;
    jwt.verify(auth_token, secret, (err, authData) => {
        if (err) {
            res.status(401).send({
                message: 'Invalid Auth Token',
                status: false,
                statusCode: 401,
            });
        } else {
            db.User.findOne({ _id: coachUserID }).then((coach_data) => {
                if (coach_data) {
                    db.Wallet.aggregate([
                        {
                            $match: { coachUserId: ObjectId(coachUserID) }
                        },
                        {
                            $group: {
                                _id: "$coachUserId",
                                debit: { $sum: "$debit" },
                                credit: { $sum: "$credit" },
                            }
                        },
                        {
                            $project: {
                                _id: "$coachUserId",
                                balance: { $subtract: ["$credit", "$debit"] },
                            }
                        }

                    ]).then((wallet_data) => {
                        if (wallet_data.length) {
                            res.status(200).send({
                                message: 'Wallet balance fetched.',
                                status: true,
                                statusCode: 200,
                                responseData: wallet_data[0]
                            });
                        } else {
                            res.status(200).send({
                                message: 'Wallet balance fetched.',
                                status: true,
                                statusCode: 200,
                                responseData: {
                                    balance: 0
                                }
                            });
                        }

                    })

                } else {
                    res.status(401).send({
                        message: 'Coach not found.',
                        status: false,
                        statusCode: 401,
                    });
                }
            })
        }
    });
}

exports.getEarningsAndWallet = async (req, res) => {
    var date = new Date();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const coachUserID = req.user._id;

    const monthEarning = await db.Wallet.aggregate([
        {
            $project: {
                walletMonth: { $month: '$createdDate' },
                walletYear: { $year: '$createdDate' },
                coachUserId: 1,
                credit: 1,
                currency: 1,
            }
        },
        {
            $match: {
                coachUserId: ObjectId(coachUserID),
                walletMonth: month,
                walletYear: year,
            }
        },
        {
            $group: {
                _id: "$coachUserId",
                balance: { $sum: "$credit" },
            }
        },

    ]);

    const totalEarning = await db.Wallet.aggregate([
        {
            $project: {
                coachUserId: 1,
                credit: 1,
                currency: 1,
            }
        },
        {
            $match: {
                coachUserId: ObjectId(coachUserID),
            }
        },
        {
            $group: {
                _id: "$coachUserId",
                balance: { $sum: "$credit" },
            }
        },

    ]);

    const walletBalance = await db.Wallet.aggregate([
        {
            $match: { coachUserId: ObjectId(coachUserID) }
        },
        {
            $group: {
                _id: "$coachUserId",
                debit: { $sum: "$debit" },
                credit: { $sum: "$credit" },
            }
        },
        {
            $project: {
                _id: "$coachUserId",
                balance: { $subtract: ["$credit", "$debit"] },
            }
        }

    ]);

    return res.status(200).send({
        message: 'Earning and wallet fetched',
        status: true,
        statusCode: 200,
        responseData: {
            wallet_balance: walletBalance.length ? walletBalance[0].balance : 0,
            month_earning: monthEarning.length ? monthEarning[0].balance : 0,
            total_earning: totalEarning.length ? totalEarning[0].balance : 0,
        }
    });
}

exports.withdrawFromWallet = (req, res) => {
    const coachUserID = req.body.coachUserID;
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    var dSeven = new Date();
    dSeven.setDate(dSeven.getDate() - 7);

    db.User.findOne({ _id: coachUserID }).then((coach_data) => {
        if (coach_data) {
            if (coach_data.stripeAccountId) {
                db.Wallet.aggregate([
                    {
                        $match: {
                            coachUserId: ObjectId(coachUserID),
                            // createdDate: {$gt: dSeven},
                        }
                    },
                    {
                        $group: {
                            _id: "$coachUserId",
                            debit: { $sum: "$debit" },
                            credit: { $sum: "$credit" },
                        }
                    },
                    {
                        $project: {
                            _id: "$coachUserId",
                            balance: { $subtract: ["$credit", "$debit"] },
                        }
                    },
                ]).then(async (wallet_data) => {
                    // console.log('wallet_data...', wallet_data);
                    // return {};
                    if (wallet_data.length) {
                        if (wallet_data[0].balance > 0) {
                            stripe.balance.retrieve(function (err, balance) {
                                var available_balance = 0;
                                console.log('available_balance...', balance, wallet_data[0].balance);
                                balance.available.forEach((value, key) => {
                                    if (value.currency == process.env.STRIPE_CURRENCY) {
                                        available_balance = value.amount
                                    }
                                });
                                // if (available_balance > wallet_data[0].balance) {
                                stripe.transfers.create({
                                    amount: wallet_data[0].balance,
                                    currency: process.env.STRIPE_CURRENCY,
                                    destination: coach_data.stripeAccountId,
                                }).then((transfers) => {
                                    console.log('transfers...', transfers);
                                    const withdrawal_data = {
                                        coachUserId: coachUserID,
                                        transferId: transfers.id,
                                        amount: transfers.amount,
                                        status: 'PAID'
                                    }

                                    db.Withdrawal.create(withdrawal_data)
                                        .then((data) => {
                                            db.Wallet.create({
                                                subscriptionCallId: data._id,
                                                coachUserId: coachUserID,
                                                debit: data.amount,
                                                type: 'WITHDRAW',
                                            }).then((wallet_data) => {
                                                if (wallet_data) {
                                                    res.status(200).send({
                                                        success: true,
                                                        message: "Amount withdrawn successfully",
                                                        responseData: subscriptionData,
                                                        statusCode: 200,
                                                    })
                                                } else {
                                                    res.status(400).send({
                                                        status: false,
                                                        statusCode: 400,
                                                        message: 'Subscribed but failed to manage wallet.',
                                                    })
                                                }
                                            })
                                        })
                                })
                                    .catch((err) => {
                                        return res.status(400).json({
                                            status: false,
                                            statusCode: 400,
                                            message: '' + err,
                                        })
                                    })
                                // } else {
                                //     return res.status(403).send({
                                //         message: 'Please contact support as they have insufficient available balance to their account.',
                                //         status: false,
                                //         statusCode: 403
                                //     });
                                // }
                            });

                        } else {
                            return res.status(403).send({
                                message: 'You have nothing to withdraw.',
                                status: false,
                                statusCode: 403
                            });
                        }
                    } else {
                        return res.status(422).send({
                            message: 'You have nothing to withdraw.',
                            status: false,
                            statusCode: 422
                        });
                    }
                })
            } else {
                res.status(404).send({
                    message: 'Coach stripe account not connected.',
                    status: false,
                    statusCode: 404,
                });
            }
        } else {
            res.status(404).send({
                message: 'Coach not found.',
                status: false,
                statusCode: 404,
            });
        }
    })
}