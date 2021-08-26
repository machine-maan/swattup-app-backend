const db = require('../models')
const token = require('../routes/token')
const points = require('./points')
const users = require('./users')
const crowds = require('./crowds')
const premium = require('./premium')
const analytics = require('./analytics')
const crypto = require('crypto')
const { getSignedURLsForFiles } = require('../helpers/files')
const async = require('async')
const Cryptr = require('cryptr')
const { Console } = require('console')
const cryptr = new Cryptr('messageappsecretkey')
const bcrypt = require('bcryptjs')
const commonHelper = require('./commonHelper')

var nodemailer = require('nodemailer')
const ID = require('nodejs-unique-numeric-id-generator')
const admin = require('firebase-admin')
const jwt = require('jsonwebtoken')
const randomstring = require("randomstring");
const fs = require('fs')
const path = require('path')
var uuidv4 = require('uuid/v4');
const AWS = require('aws-sdk');
const userResource = require('../resources/userResource')
const configHelper = require('./configHelper')
const userService = require('../services/userService')
const logHelper = require('./logHelper')
const uploadHelper = require('./uploadHelper')
const bookCallService = require('../services/bookCallService')
const dateHelper = require('./dateHelper')
const bookResource = require('../resources/bookResource')
const mailHelper = require('./mailHelper')
const questionService = require('../services/questionService')
const followerService = require('../services/followerService')
const S3BUCKETURL = "https://swattup-app-bucket.s3.eu-west-2.amazonaws.com/";
const userProfileImagePath = "users/profile/";
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

const welcomeMessage =
    'Welcome to SwattUp! Get started by checking out some crowds, or earn some points by uploading an avatar.'

const generateConfig = () => {
    const config = {
        initialPremiumModal: Math.random() < 0.6 ? 'sign_up' : 'second_open',
        variantPopUpA: Math.random() < 0.6 ? 1 : 2,
    }

    return config
}

const processUser = (user) => {
    return new Promise((resolve) => {
        if (!user.config || !user.config.initialPremiumModal) {
            user.config = generateConfig(user)

            analytics.trackAssignedInitialPopUpLocation(
                user,
                user.config.initialPremiumModal
            )
            analytics.trackAssignedPopUpAVariant(user, user.config.variantPopUpA)

            user
                .save()
                .then((userNew) => {
                    return resolve(userNew)
                })
                .catch((err) => {
                    console.log('processUser err')
                    console.log(err)

                    // proceed anyway
                    return resolve(user)
                })
        } else {
            return resolve(user)
        }
    })
}

exports.verifyEmail = async (req, res) => {
    const verificationCode = req.body.verificationCode
    const email = req.body.email;

    let userData = await userService.aggregate([{
        $match: {
            email: email,
        }
    }]);

    if (userData.length) {
        userData = userData[0];
        if (userData.validated == true) {
            return res.status(400).send({
                status: false,
                statusCode: 400,
                message: 'Already verified',
            });
        }

        let lastUpdatedDate = userData.updatedAt;
        if (!lastUpdatedDate) {
            return res.status(400).send({
                status: false,
                statusCode: 400,
                message: 'Please resend email verification code.',
            });
        }
        let dateHelperS = dateHelper();
        let compareDate = dateHelperS.add(lastUpdatedDate, configHelper.SIGNUP_VERIFICATION_CODE_EXPIRY);
        if (!dateHelperS.isDateTimeGreater(compareDate)) {
            return res.status(403).send({
                status: false,
                statusCode: 403,
                message: 'Verification code expired',
            });
        }
    }

    const dataToUpdate = {
        validated: true
    }
    db.User.findOneAndUpdate(
        { email: email, verificationCode: verificationCode },
        { $set: dataToUpdate },
        { new: true }).then((verify) => {
            if (verify) {
                // Remove similar email-user
                // let deleteRes = userService.delete({
                //     email: email,
                //     validated: false,
                // });

                const token = commonHelper.generateToken(verify);

                return res.status(200).send({
                    success: true,
                    statusCode: 200,
                    message: 'Email successfully verified.',
                    responseData: userResource(verify, {
                        token: token,
                        IsVerified: verify.validated,
                    })
                })
            } else {
                return res.status(409).send({
                    success: false,
                    statusCode: 409,
                    message: 'Email or verification code mismatch.',
                })
            }
            /* console.log(verify, 'verify')
            console.log(verify.verificationCode, 'verification code')
            if (verificationCode == verify.verificationCode) {
              res.status(200).send({
                success: true,
                message: 'email successfully verified.',
                statusCode: 200
              })
            } else {
              res.status(401).send({
                success: false,
                message: 'email is not verify.',
                statusCode: 401,
              })
            } */
        })
}

exports.resendEmail = async (req, res) => {
    const code = randomstring.generate({
        length: 6,
        charset: 'numeric'
    });
    const email = req.body.email;

    let userData = await userService.aggregate([{
        $match: {
            email: email,
        }
    }]);

    if (userData.length) {
        userData = userData[0];

        if (userData.source != configHelper.SOURCE_PROVIDER_EMAIL) {
            return res.status(400).send({
                success: false,
                statusCode: 400,
                message: 'User source is different',
            })
        }

        if (userData.validated == true) {
            return res.status(400).send({
                success: false,
                statusCode: 400,
                message: 'Already verified',
            })
        }
        
        const mailLimit = configHelper.SIGNUP_EMAIL_VERIFICATION_LIMIT;
        if (userData.verificationCodeCount == mailLimit) {
            return res.status(400).send({
                success: false,
                statusCode: 400,
                message: 'You can resend email ' + mailLimit + ' times per day only',
            })
        }
    }

    db.User.findOneAndUpdate(
        { email: email },
        { $set: { verificationCode: code } },
        { upsert: true, new: true }
    ).then(async (user) => {
        mailHelper.emailVerification(code, user, async (err, success) => {
            if (err) {
                return res.status(400).send({
                    success: false,
                    statusCode: 400,
                    message: "Mail not sent - " + err,
                })
            }

            await userService.update(userData._id, {
                $inc: { verificationCodeCount: 1 }
            });

            return res.status(200).send({
                success: true,
                statusCode: 200,
                message: "Mail successfully sent.",
                responseData: userResource(user),
            })
        });
    })
}

exports.forgotPassword = (req, res) => {
    const email = req.body.email

    db.User.findOne({ email: email, source: 'email' }).then((user) => {
        if (user) {
            const code = randomstring.generate({
                length: 6,
                charset: 'numeric'
            });

            db.User.updateOne(
                { email: email },
                { $set: { verificationCode: code } }
            ).then((result) => {
                mailHelper.forgotPassword(code, user, (error, success) => {
                    if (error) {
                        return res.status(401).send({
                            success: false,
                            statusCode: 401,
                            message: "Email not sent - " + error,
                        })
                    }
                    return res.status(200).send({
                        success: true,
                        statusCode: 200,
                        message: "Email sent successfully.",
                    })
                });
                // let transporter = nodemailer.createTransport({
                //     host: process.env.EMAIL_HOST,
                //     port: process.env.EMAIL_PORT,
                //     secure: false,
                //     requireTLS: process.env.EMAIL_USE_TLS,
                //     auth: {
                //         user: process.env.EMAIL_HOST_USER,
                //         pass: process.env.EMAIL_HOST_PASSWORD,
                //     },
                //     // tls: { rejectUnauthorized: true },
                // })
                // var mailOptions = {
                //     from: process.env.EMAIL_HOST_USER,
                //     to: user.email,
                //     subject: 'SwattUp Password Reset! Your code is:' + `${code}`,
                //     html:
                //         'Hey <b>' +
                //         user.username +
                //         '</b><br>The code to reset your account password is <b>' + code + '</b>. If you ever need help or want to get in touch, send us an email at hello@swattup.com.<br><br>Happy Swatting!<br><b>The SwattUp Team</b>',
                // }
                // transporter.sendMail(mailOptions, function (error, success) {
                //     if (error) {
                //         res.status(401).send({
                //             success: false,
                //             statusCode: 401,
                //             message: "Email not sent - " + error,
                //         })
                //     } else {
                //         res.status(200).send({
                //             success: true,
                //             statusCode: 200,
                //             message: "Email sent successfully.",
                //         })
                //     }
                // })
            })

        } else {
            res.status(401).send({
                success: false,
                statusCode: 401,
                message: "User is not registered with this email address.",
            })
        }
    })
}

exports.resetPassword = async (req, res) => {
    const email = req.body.email
    const code = req.body.code
    const password = await bcrypt.hash(req.body.password, 10);

    db.User.findOne({ email: email, verificationCode: code }).then((user) => {
        if (user) {
            const code = randomstring.generate({
                length: 6,
                charset: 'numeric'
            });
            db.User.updateOne(
                { email: email },
                { $set: { verificationCode: code, password: password } }
            ).then((result) => {
                mailHelper.resetPassword(user, (error, success) => {
                    if (error) {
                        return res.status(401).send({
                            success: false,
                            statusCode: 401,
                            message: "Email not sent - " + error,
                        })
                    }

                    return res.status(200).send({
                        success: true,
                        statusCode: 200,
                        message: "Password reset successfully.",
                    })
                });
            })

        } else {
            res.status(401).send({
                success: false,
                statusCode: 401,
                message: "Invalid code.",
            })
        }
    })
}

// check token - if we've made it this far, it matches the user ID. send the user info
exports.verifyToken = (req, res) => {
    db.Config.findOne({ name: 'config' })
        .then((config) => {
            db.User.findOne({
                _id: req.token._id,
            })
                .then((user) => {
                    processUser(user).then((userB) => {
                        premium
                            .checkPremium(userB)
                            .then((userC) => {
                                res.send({
                                    user: users.trimUser(userC),
                                    levelData: points.getLevelData(
                                        userC.points,
                                        config.levelThresholds
                                    ), // #DEPRECATED FOR 2.0 (done on FE)
                                })
                            })
                            .catch((err) => res.send(err))
                    })
                })
                .catch((error) => res.send(error))
        })
        .catch((error) => res.send(error))
}

exports.getConfig = (req, res) => {
    // only admin allowed to fetch all crowds (including organisations etc)
    // if (
    //   req.params.type === 'crowds'
    //   &&
    //   (!req.token || req.token.type !== 'admin'
    //   )
    // ) {
    //   return res.send({ unauthorized: true })
    // }

    // also return banned crowds if passed in type is "crowds" (admin dashboard), as well as extra fields
    const filters =
        req.params.type === 'crowds'
            ? {}
            : { banned: { $ne: true }, organisation: { $ne: true } }
    const fields =
        req.params.type === 'crowds'
            ? { name: 1, official: 1, banned: 1, creator: 1, organisation: 1 }
            : { name: 1, official: 1 }

    db.Config.findOne({ name: 'config' })
        .lean()
        .then((config) => {
            db.Crowd.find(filters, fields)
                .lean()
                .sort({ lowercaseName: 1 })
                .then((crowds) => res.send({ config: config, crowds: crowds }))
                .catch((err) => res.send(err))
        })
        .catch((error) => res.send(error))
}

exports.signIn = (req, res) => {
    // No Firebase User Specified
    if (!req.firebaseUser || !req.firebaseUser.uid) {
        return res.send({ unauthorized: true })
    }

    // fetch config for level thresholds
    db.Config.findOne({ name: 'config' })
        .then((config) => {
            // treat input email as either an email or username
            db.User.findOne({ firebaseUserID: req.firebaseUser.uid })
                .then(async function (user) {
                    if (!user) {
                        user = await registerUser(req.firebaseUser, req)
                    }

                    const levelData = points.getLevelData(
                        user.points,
                        config.levelThresholds
                    )

                    // after checking password is correct, say banned if banned
                    if (user.banned) {
                        return res.send({ banned: true })
                    }

                    // Get Avatar
                    let avatar
                    try {
                        const signedURLs = await getSignedURLsForFiles(`avatar-${user._id}`)
                        if (signedURLs[0].exists) {
                            avatar = signedURLs[0].URL
                        } else {
                            avatar =
                                'https://cookietaker-clients.fra1.cdn.digitaloceanspaces.com/swattupPrivate/images/placeholder-profile.png'
                        }
                    } catch (e) {
                        console.log('Could not retrieve avatar', e)
                    }

                    console.log('logging in, device ID: ' + req.body.deviceID, avatar)

                    return res.send({
                        token: token.getToken(user),
                        user: {
                            ...users.trimUser(user),
                            avatar: avatar,
                        },
                        levelData: levelData, // deprecated with 2.0
                    })
                })
                .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
}

exports.login = (req, res) => {
    var response_arr = {}
    db.User.findOne({
        email: req.body.email,
    }).then((user) => {
        if (user === null) {
            return res.status(401).send({
                success: false,
                statusCode: 401,
                message: 'Invalid email or password',
            })
        }
        if (user.source == configHelper.SOURCE_PROVIDER_EMAIL && user.validated == false) {
            return res.status(403).send({
                success: false,
                statusCode: 403,
                message: 'Email not verified',
            })
        }

        bcrypt.compare(req.body.password, user.password, function (err, resu) {
            if (err) {
                res.status(401).send({
                    success: false,
                    statusCode: 401,
                    message: err,
                })
            }
            if (resu) {
                const token = commonHelper.generateToken(user);

                var flag = "SIGNUP";
                console.log(user.topics);
                if (user.topics.length && user.goals.length) {
                    flag = "SIGNIN";
                }

                userService.update(user._id, {
                    deviceToken: req.body.deviceToken,
                });

                response_arr = {
                    _id: user._id,
                    firebaseUserID: user.firebaseUserID,
                    email: user.email,
                    username: user.username,
                    profileImage: commonHelper.getProfileImage(user.profileImage),
                    joinDate: user.joinDate,
                    type: user.type,
                    IsVerified: user.validated,
                    token: token,
                    deviceToken: req.body.deviceToken,
                    flag: flag
                };
                return res.status(200).send({
                    success: true,
                    statusCode: 200,
                    message: 'login successfully',
                    responseData: response_arr,
                })
            } else {
                return res.status(401).send({
                    success: false,
                    statusCode: 401,
                    message: 'Invalid email or password.',
                })
            }
        })
    })
}

exports.logout = (req, res) => {
    const auth_token = req.token;
    const secret = configHelper.SECRET_KEY;

    if (typeof auth_token == 'string' && typeof secret == 'string' && req.body.uuid) {

        const uuid = req.body.uuid;

        db.User.findOne({
            $or: [{ firebaseUserID: uuid }],
        }).then((user) => {
            if (user === null) {
                return res.status(404).send({
                    success: false,
                    statusCode: 404,
                    message: 'User not found with firebase uid!',
                })
            }

            jwt.verify(auth_token, secret, (err, authData) => {
                if (err) {
                    return res.status(401).send({
                        message: 'Invalid Auth Token',
                        status: false,
                        statusCode: 401,
                    });
                } else {
                    admin
                        .auth()
                        .getUser(uuid)
                        .then((userRecord) => {
                            admin
                                .auth()
                                .revokeRefreshTokens(uuid)
                                .then(() => {
                                    userService.update(user._id, {
                                        deviceToken: null,
                                    });
                                    return res.status(200).send({
                                        message: 'Logout successfully',
                                        status: true,
                                        statusCode: 200,
                                    });
                                })
                                .catch((error) => {
                                    return res.status(400).send({
                                        message: 'Error fetching user data' + error,
                                        status: false,
                                        statusCode: 400,
                                    });
                                });

                        })
                        .catch((error) => {
                            return res.status(400).send({
                                message: 'Error fetching user data' + error,
                                status: false,
                                statusCode: 400,
                            });
                        });
                }
            });
        });
    }
    else {
        return res.status(401).send({
            message: 'Invalid Token',
            status: false,
            statusCode: 401,
        });
    }
}

async function checkFirebaseRecord(firebaseUserID) {
    return admin
    .auth()
    .getUser(firebaseUserID)
    .then(async (userRecord) => {
        // return userRecord;
        return {
            status: true,
            data: userRecord,
            statusCode: 400,
            message: "Firebase account not found for this email.",
        };
        if (userRecord.email != req.body.email) {
            return res.status(400).send({
                success: false,
                statusCode: 400,
                message: "Firebase account not found for this email.",
            });
        }
    })
    .catch((error) => {
        return {
            status: false,
            message: '' + error,
            statusCode: 400,
        };
        // return res.status(400).send({
        //     message: '' + error,
        //     status: false,
        //     statusCode: 400,
        // });
    });
}

exports.signUp = (req, res) => {
    const code = randomstring.generate({
        length: 6,
        charset: 'numeric'
    });
    let reqGoals = req.body.goals;
    let reqInterest = req.body.interests;

    // if (req.body.interests) {
    //     reqInterest = req.body.interests.split(',');
    //     if (reqInterest.length) {
    //         reqInterest = reqInterest.filter(function (e, i, c) {
    //             return c.indexOf(e) === i;
    //         });
    //     }
    // }

    // if (req.body.goals) {
    //     reqGoals = req.body.goals.split(',');
    //     if (reqGoals.length) {
    //         reqGoals = reqGoals.filter(function (e, i, c) {
    //             return c.indexOf(e) === i;
    //         });
    //     }
    // }

    db.User.findOne({
        // $or: [{ email: req.body.email }],
        email: req.body.email,
    }).then(async (user) => {
        if (req.body.source === configHelper.AUTH_PROVIDER_EMAIL) {
            if (user) {
                return res.status(409).send({
                    success: false,
                    statusCode: 409,
                    message: 'Email or username already exists!',
                })
            }
            else {
                // let profileImage = await uploadHelper.upload(
                //     req.files,
                //     'profileImage',
                //     'image',
                //     './public/userProfile/image/',
                //     uploadHelper.USER_PROFILE_PATH
                // );

                // if (!profileImage.status) {
                //     return res.status(422).send({
                //         success: false,
                //         statusCode: 422,
                //         message: profileImage.message,
                //     });
                // }

                admin
                    .auth()
                    .createUser({
                        type: req.body.type,
                        email: req.body.email,
                        username: req.body.username ? req.body.username : '',
                        password: req.body.password,
                        login_type: req.body.login_type,
                        verificationCode: code,
                        joinDate: new Date().toISOString(),
                    })
                    .then(async (user, callback) => {
                        const user_arr = []
                        const uid = user.uid
                        admin
                            .auth()
                            .createCustomToken(uid)
                            .then((customToken) => {
                                console.log(customToken)
                                // Send token back to client
                            })

                        db.User.create({
                            type: req.body.type,
                            email: req.body.email,
                            username: req.body.username ? req.body.username : '',
                            password: req.body.password,
                            source: req.body.source,
                            deviceID: req.body.deviceID,
                            deviceModel: req.body.deviceModel,
                            devicePlatform: req.body.devicePlatform,
                            verificationCode: code,
                            firebaseUserID: uid,
                            joinDate: new Date().toISOString(),
                            topics: reqInterest,
                            goals: reqGoals,
                            //   profileImage: profileImage.profileImage
                            profileImage: req.body.profileImage,
                            timezone: req.body.timezone ? req.body.timezone : '',
                        }).then(async (user_data) => {

                            mailHelper.emailVerification(code, user_data);

                            const token = commonHelper.generateToken(user_data)

                            response_arr = {
                                ...user_data,
                                token: token,
                            };

                            if (user_data.type === configHelper.USER_TYPE_PROFESSIONAL) {
                                logHelper.log(
                                    user_data._id,
                                    user_data._id,
                                    'New Coach Signup',
                                    'COACH-SIGNUP'
                                )
                            } else {
                                let userBanner = await userService.isExist({
                                    type: configHelper.USER_TYPE_LEARNER,
                                    bannerImage: { $ne: null }
                                });
                                if (userBanner && typeof userBanner === 'object' && userBanner !== null) {
                                    userService.update(user_data._id, {
                                        bannerImage: userBanner.bannerImage,
                                    });
                                    response_arr['bannerImage'] = userBanner.bannerImage;
                                }
                            }

                            return res.status(200).send({
                                success: true,
                                statusCode: 200,
                                message: 'Signup successfully!',
                                responseData: userResource(user_data, {
                                    'bannerImage': response_arr.bannerImage,
                                    'token': token,
                                }),
                            })
                        })
                        .catch(async (err) => {
                            // if (profileImage.status) {
                            //     await uploadHelper.deleteImage(profileImage.profileImage);
                            // }

                            return res.status(401).send({
                                success: false,
                                statusCode: 401,
                                message: "" + err,
                            })
                        })

                    })
                    .catch((err) => {
                        return res.status(401).send({
                            success: false,
                            statusCode: 401,
                            message: "" + err,
                        })
                    });
            }
        } else {
            if (req.body.action == "SIGNIN") {
                if (!user) {
                    return res.status(401).send({
                        success: false,
                        statusCode: 401,
                        message: "You must signup before signing in.",
                    });
                } else {
                    const firebaseUserRecord = await checkFirebaseRecord(user.firebaseUserID);
                    console.log('firebaseUserRecord...', firebaseUserRecord);
                    if (firebaseUserRecord.status) {
                        if (firebaseUserRecord.data.email != req.body.email) {
                            return res.status(400).send({
                                success: false,
                                statusCode: 400,
                                message: "Firebase account not found for this email.",
                            });
                        }
                    } else {
                        return res.status(400).send(firebaseUserRecord);
                    }
                }
            }

            if (user) {
                if (user.source == req.body.source && (user.type == req.body.type || req.body.action == "SIGNIN")) {
                    db.User.findOneAndUpdate(
                        {
                            _id: user._id,
                        },
                        {
                            $set: {
                                username: req.body.username ? req.body.username: '',
                                email: req.body.email,
                                deviceID: req.body.deviceID,
                                deviceModel: req.body.deviceModel,
                                devicePlatform: req.body.devicePlatform,
                            }
                        },
                        { new: true },
                        function (err, user_profile_data) {
                            if (err) {
                                return res.status(401).send({
                                    success: false,
                                    statusCode: 401,
                                    message: err,
                                })
                            }
                        }
                    ).exec(function (err, update_user_profile_data) {
                        const token = commonHelper.generateToken(update_user_profile_data)
                        var flag = "SIGNUP";
                        console.log(update_user_profile_data.topics);
                        if (update_user_profile_data.topics.length && update_user_profile_data.goals.length) {
                            flag = "SIGNIN";
                        }

                        response_arr = {
                            _id: update_user_profile_data._id,
                            firebaseUserID: update_user_profile_data.firebaseUserID,
                            email: update_user_profile_data.email,
                            username: update_user_profile_data.username ? update_user_profile_data.username: '',
                            profileImage: commonHelper.getProfileImage(update_user_profile_data.profileImage),
                            joinDate: update_user_profile_data.joinDate,
                            type: update_user_profile_data.type,
                            token: token,
                            flag: flag
                        };
                        return res.status(200).send({
                            success: true,
                            statusCode: 200,
                            message: 'login successfully',
                            responseData: userResource(update_user_profile_data, {
                                token: token,
                                flag: flag,
                            }),
                        })
                    })
                } else {
                    return res.status(401).send({
                        success: false,
                        statusCode: 401,
                        message: "Email is already registered with " + user.source,
                    })
                }

            } else {
                admin
                    .auth()
                    .getUser(req.body.firebaseUserID)
                    .then(async (userRecord) => {
                        if (userRecord.email === req.body.email) {

                            db.User.create({
                                type: req.body.type,
                                email: req.body.email,
                                username: req.body.username ? req.body.username : '',
                                password: req.body.password,
                                source: req.body.source,
                                verificationCode: code,
                                firebaseUserID: req.body.firebaseUserID,
                                deviceID: req.body.deviceID,
                                deviceModel: req.body.deviceModel,
                                devicePlatform: req.body.devicePlatform,
                                profileImage: req.body.profileImage ? req.body.profileImage : null,
                                joinDate: new Date().toISOString(),
                                topics: reqInterest,
                                goals: reqGoals,
                                timezone: req.body.timezone ? req.body.timezone : ''
                            }).then((user_data) => {

                                const token = commonHelper.generateToken(user_data)
                                response_arr = {
                                    _id: user_data._id,
                                    firebaseUserID: user_data.firebaseUserID,
                                    email: user_data.email,
                                    username: user_data.username ? user_data.username : '',
                                    profileImage: commonHelper.getProfileImage(user_data.profileImage),
                                    joinDate: user_data.joinDate,
                                    type: user_data.type,
                                    token: token,
                                    flag: "SIGNUP"
                                };
                                return res.status(200).send({
                                    success: true,
                                    statusCode: 200,
                                    message: 'login successfully',
                                    responseData: userResource(user_data, {
                                        token: token,
                                        flag: 'SIGNUP',
                                    }),
                                })
                            })
                                .catch((err) => res.status(401).send({
                                    success: false,
                                    statusCode: 401,
                                    message: err + "- myerr",
                                }))
                        } else {
                            return res.status(401).send({
                                message: "Firebase id not associated with your email",
                                status: false,
                                statusCode: 401,
                            });
                        }

                    })
                    .catch((error) => {
                        return res.status(401).send({
                            message: '' + error,
                            status: false,
                            statusCode: 401,
                        });
                    });
            }

        }

    })
}

exports.getUser = (req, res) => {
    const response_arr = []
    db.User.find()
        .lean()
        .exec((err, users) => {
            async.forEachOf(
                users,
                (user, key, callback) => {
                    // console.log('users',user.password);
                    response_arr.push({
                        email: user.email,
                        username: user.username,
                        password: user.password,
                        passwordDate: user.passwordDate,
                        deviceID: user.deviceID,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        joinDate: user.joinDate,
                        type: user.type,
                        points: user.points,
                        // firebaseUserID:user.firebaseUserID,
                        // followers:(followers.length > 0) ? followers.length : '',
                        // following:(following.length > 0) ? following.length : '',
                    })
                    callback()
                },
                (err) => {
                    if (err) console.error(err.message)

                    res.send({
                        success: true,
                        statusCode: 200,
                        message: 'user could data get successfully!',
                        data: response_arr,
                    })
                }
            )
        })
    // .sort({ lowercaseName: 1 })
}

exports.editUserProfile = async (req, res) => {
    let reqPayload = commonHelper.filterPayload(req.body, {
        id: '_id',
        username: 'username',
        email: 'email',
        aboutMe: 'aboutMe',
    });
    // const id = req.body.id
    // const username = req.body.username ? req.body.username : ''
    // const email = req.body.email ? req.body.email : ''
    const files_param = req.files
    // const aboutMe = req.body.aboutMe

    var response_arr = []

    db.User.findOne(
        {
            _id: reqPayload._id,
        },
        async function (err, user_profile) {
            if (!user_profile) {
                return res.send({
                    success: false,
                    message: 'user profile not found.',
                    statusCode: 401,
                })
            }

            // Update Records
            const userProfile = reqPayload
            
            const proImage = req.files && req.files.profileImage ? req.files.profileImage : [];
            if (req.files && typeof proImage.length === 'undefined') {
                let proImageFile = await uploadHelper.upload(
                    req.files,
                    'profileImage',
                    'image',
                    './public/userProfile/image/',
                    uploadHelper.USER_PROFILE_PATH,
                    [],
                    null,
                    user_profile.profileImage
                );

                if (proImageFile.status) {
                    userProfile.profileImage = proImageFile.profileImage;
                } else {
                    return res.status(422).send({
                        status: false,
                        statusCode: 422,
                        message: proImageFile.message,
                    })
                }
            }

            let bannerImage = await uploadHelper.upload(
                req.files,
                'bannerImage',
                'image',
                './public/userProfile/image/',
                uploadHelper.USER_PROFILE_PATH,
                ['jpg', 'jpeg', 'png', 'gif'],
                null,
                user_profile.profileImage
            );
            if (bannerImage.status) {
                userProfile.bannerImage = bannerImage.bannerImage;
                //TODO: Update Banner to All User
                userService.updateToAll({
                    type: 'Learner',
                },
                    {
                        bannerImage: bannerImage.bannerImage,
                    });
            }

            //   return false;
            db.User.findOneAndUpdate(
                {
                    _id: reqPayload._id,
                },
                { $set: userProfile },
                { new: true },
                function (err, user_profile_data) {
                    if (err) {
                        res.send({ success: false, message: err })
                        return
                    }
                }
            ).exec(function (err, update_user_profile_data) {
                // response_arr = {
                //     _id: update_user_profile_data._id,
                //     fullName: update_user_profile_data.fullName,
                //     username: update_user_profile_data.username,
                //     email: update_user_profile_data.email,
                //     aboutMe: update_user_profile_data.aboutMe,
                //     profileImage: update_user_profile_data.profileImage,
                // }
                response_arr = userResource(update_user_profile_data);
                res.send({
                    success: true,
                    statusCode: 200,
                    message: 'user profile updated successfully!',
                    responseData: response_arr,
                })
            })
        }
    ).lean()
}

exports.viewUserProfile = (req, res) => {
    const id = req.body.id

    db.User.findOne(
        {
            _id: id,
        },
        async function (err, view_user_profile) {
            if (!view_user_profile) {
                return res.status(404).send({
                    success: false,
                    statusCode: 404,
                    message: 'User not found',
                })
            } else {
                let follow_query = {
                    userId: id,
                    followerId: req.user._id,
                    status: 1
                }
                let subscribe_query = {
                    coachUserID: id,
                    learnerUserID: req.user._id,
                    isActive: 1
                }
                let questionCount_query = {
                    userID: id,
                }
                let [
                    following,
                    subscribe,
                    questionCount,
                    followerCount,
                    followingCount,
                    bookingDetails,
                ] = await Promise.all([
                    db.Follower.countDocuments(follow_query),
                    db.Subscription.countDocuments(subscribe_query),
                    questionService.count(questionCount_query),
                    followerService.count({
                        userId: id,
                        status: '1',
                    }),
                    followerService.count({
                        followerId: id,
                        status: '1',
                    }),
                    bookCallService.getLatestBooking(req.user, view_user_profile),
                ]);

                var response_arr = userResource(view_user_profile, {
                    followStatus: following > 0 ? true : false,
                    subscribeStatus: subscribe > 0 ? true : false,
                    followerCount: followerCount ? followerCount : 0,
                    followingCount: followingCount ? followingCount : 0,
                    questionCount: questionCount ? questionCount : 0,
                    bookingDetails: bookingDetails.length ? bookResource(bookingDetails[0]) : null,
                });

                return res.send({
                    success: true,
                    statusCode: 200,
                    message: 'User profile fetched successfully.',
                    responseData: response_arr
                })

            }
        }
    )
}

function generateRandomUsername(uid) {
    return 'user_' + crypto.createHash('md5').update(uid).digest('hex')
}

function registerUser(firebaseUser, req) {
    // console.log('firebaseUser',firebaseUser);
    // No Firebase User Specified
    if (!firebaseUser || !firebaseUser.uid) {
        throw 'No user details specified'
    }

    return new Promise(function (resolve) {
        // fetch config
        db.Config.findOne({ name: 'config' })
            .then((config) => {
                // populate content collection
                const content = []

                // Get Name
                const [firstName, ...lastName] = firebaseUser.displayName.split(' ')

                db.User.create({
                    email: firebaseUser.email,
                    username: generateRandomUsername(firebaseUser.uid),
                    authProvider: firebaseUser.authProvider,
                    firebaseUserID: firebaseUser.uid,

                    phone: firebaseUser.phone,
                    type: 'user',
                    validated: firebaseUser.emailVerified,

                    deviceID: req.body.deviceID,
                    consentEmails: req.body.consentEmails || false,

                    firstName: firstName,
                    lastName: lastName.join(' '),

                    learningLevel: 'professional',
                    content: content,
                    joinDate: new Date().toISOString(),
                    points: config.pointRewards.signUp,

                    followers: [],
                    following: [],
                    followersSubscribed: [],
                    followingSubscribed: [],

                    blocked: [],
                    blockedBy: [],

                    notifications: [
                        {
                            form: 'custom',
                            message: welcomeMessage,
                            date: new Date(),
                            points: config.pointRewards.signUp,
                        },
                    ],

                    config: generateConfig(),
                })
                    .then((user) => {
                        // console.log('user',user);
                        analytics.trackAssignedInitialPopUpLocation(
                            user,
                            user.config.initialPremiumModal
                        )
                        analytics.trackAssignedPopUpAVariant(
                            user,
                            user.config.variantPopUpA
                        )

                        // crowds.subscribeToCrowds(user._id, req.body.subjects)
                        // crowds.addUserToCrowds(user.subjects, user._id)
                        return resolve(user)
                    })
                    .catch((error) => {
                        throw error
                    })
            })
            .catch((err) => {
                throw err
            })
    })
}

exports.checkEmail = (req, res) => {
    console.log('hdjfdf')
    db.User.findOne({ email: req.params.email.toLowerCase() })
        .lean()
        .then((user) => {
            if (user) {
                res.send({ taken: true })
            } else {
                res.send({ taken: false })
            }
        })
        .catch((error) => res.send(error))
}

exports.checkUsername = (req, res) => {
    db.User.findOne({ username: req.params.username.toLowerCase() })
        .lean()
        .then((user) => {
            if (user) {
                res.send({ taken: true })
            } else {
                res.send({ taken: false })
            }
        })
        .catch((error) => res.send(error))
}


exports.deleteFirebaseUsers = (req, res) => {
    // List batch of users, 1000 at a time.
    admin
        .auth()
        .listUsers(1000)
        .then((listUsersResult) => {
            listUsersResult.users.forEach((userRecord) => {
                console.log(userRecord);
                admin
                    .auth()
                    .deleteUser(userRecord.uid)
                    .then(() => {
                        console.log('Successfully deleted user');
                    })
                    .catch((error) => {
                        console.log('Error deleting user:', error);
                    });
            });
            if (listUsersResult.pageToken) {
                // List next batch of users.
                listAllUsers(listUsersResult.pageToken);
            }
        })
        .catch((error) => {
            console.log('Error listing users:', error);
        });
}