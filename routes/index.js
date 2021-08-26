//this is my file
const express = require('express')
const router = express.Router()

const login = require('../helpers/login')
const users = require('../helpers/users')
const question = require('../helpers/question')
const questions = require('../helpers/questions')
const crowds = require('../helpers/crowds')
const hotSwatts = require('../helpers/hotSwatts')
const validate = require('../helpers/validate')
const files = require('../helpers/files')
const terms = require('../helpers/terms')
const vouchers = require('../helpers/vouchers')
const adminConfig = require('../helpers/adminConfig')
const adminData = require('../helpers/adminData')
const organisations = require('../helpers/organisations')
const chats = require('../helpers/chats')
const premium = require('../helpers/premium')
const data = require('../helpers/data')
const couchProfile = require('../helpers/couchProfile')
const videoCall = require('../helpers/videoCall')
const follower = require('../helpers/follower')
const goal = require('../helpers/goal')
const crowdsGoals = require('../helpers/crowdsGoals')
const _crowds = require('../helpers/_Crowds')
const crowdsInterests = require('../helpers/crowdsIntersts')
const activityLog = require('../helpers/activityLog')
const settings = require('../helpers/settings')
const bookCall = require('../helpers/bookCall')
const token = require('./token')
const notifications = require('../helpers/notifications')
const jwt = require('jsonwebtoken')

const {
    uploadCouchProfileSchema,
    editUploadProfileSchema,
    signupValidation,
    resendEmail,
    resetPassword,
} = require('../validations/profile.validation')

const { createBookCallSchema } = require('../validations/bookCall.validation')

const { createReviews } = require('../validations/reviews.validation')
const { chatFile } = require('../validations/chatFile.validation')
const baseValidation = require('../validations/baseValidation')

async function verifyToken(req, res, next) {
    // Get auth header value
    const bearerHeader = req.headers['authorization']
    // Check if bearer is undefined
    if (typeof bearerHeader !== 'undefined') {
        // Split at the space
        const bearer = bearerHeader.split(' ')
        // Get token from array
        const bearerToken = bearer[1]
        // Set the token
        req.token = bearerToken

        jwt.verify(bearerToken, configHelper.SECRET_KEY, async (err, user) => {
            if (err) {
                return res.status(401).send({
                    status: false,
                    message: 'Invalid Auth Token',
                    statusCode: 401,
                })
            }
            let userData = await userService.findOne(user.id);

            if (!userData) {
                return res.status(401).send({
                    status: false,
                    message: 'Invalid Auth Token',
                    statusCode: 401,
                })
            }

            req.user = userData
            globalHelper.authUser = userData;

            next()
        });
        // console.log('jwtResult....', jwtResult);
        // next()
        // Next middleware
    } else {
        // Forbidden
        res.status(401).send({
            status: false,
            statusCode: 401,
            message: 'JWT Token required',
        })
    }
} // runs before every route

// router.post('/test1', verifyToken, (req, res) => {

// });

/* router.use((req, res, next) => {
  if (req.url.indexOf('/users/signin') === -1) {
    return token.decode(req, res, next)
  }
  return token.getAuthToken(req, res, next)
}) */ // start limit resetter
premium.resetDailyCounts()

// LOGIN AND SIGNUP

// router
//   .route('/users/signup')
//   .post(login.signup)

// router
//   .route('/users/signin')
//   .post(token.processFirebase,login.signIn)

router.post('/users/signin', token.processFirebase, login.signIn)
// router.post("/users/signup",login.signUp);
router.route('/users/signup').post(signupValidation, login.signUp)

router.route('/viewUserQuestion').post(verifyToken, question.viewUserQuestion)
router.route('/viewAnswers/:questionId').get(verifyToken, question.viewAnswers)
router
    .route('/viewUserLatestQuestion')
    .post(verifyToken, question.viewUserLatestQuestion)
router
    .route('/viewUnansweredQuestion')
    .post(verifyToken, question.viewUnansweredQuestion)
router
    .route('/viewSingleQuestion/:questionId')
    .get(verifyToken, question.viewSingleQuestion)
router.route('/viewCrowdQuestion').post(verifyToken, question.viewCrowdQuestion)
router
    .route('/viewUnansweredUserCrowds')
    .post(verifyToken, baseValidation.viewUnansweredUserCrowds, question.viewUnansweredUserCrowds)

router.route('/users/get').post(verifyToken, login.getUser)

router.route('/editUserProfile').post(verifyToken, baseValidation.editUserProfile, login.editUserProfile)

router.route('/viewUserProfile').post(verifyToken, login.viewUserProfile)

router.route('/insertInterests').post(crowdsInterests.insertInterests)
router.route('/crowds/interests').get(crowdsInterests.getCrowds)

router.route('/crowds/goals').get(crowdsGoals.getGoals)

router.route('/insertGoals').post(crowdsGoals.insertGoals)

router.route('/crowds/specific').post(_crowds.getSpecificCrowds)

//couch profile
router
    .route('/createCouchProfile')
    .post(verifyToken, baseValidation.createCouchProfile, couchProfile.createCouchProfile)

/* router.post(
  '/createCouchProfile',
  uploadCouchProfileSchema,
  couchProfile.createCouchProfile
) */

/* router.post(
  '/editCouchProfile',
  editUploadProfileSchema,
  couchProfile.editCouchProfile
) */

router
    .route('/viewCouchProfile')
    .post(verifyToken, couchProfile.viewCouchProfile)
router.route('/updateStripeAccount').get(couchProfile.updateStripeAccount)
router.route('/subscribeCoach').post(verifyToken, baseValidation.subscribeCoach, users.subscribeCoach)
router.route('/updateSubscription').post(users.updateSubscription)
router
    .route('/getCoachSubscribers')
    .post(verifyToken, couchProfile.getCoachSubscribers)
router.route('/unSubscribeCoach').post(verifyToken, baseValidation.unSubscribeCoach, users.unSubscribeCoach)
router
    .route('/getEarningsAndWallet')
    .get(verifyToken, couchProfile.getEarningsAndWallet)
router.route('/getWalletAmount').post(verifyToken, couchProfile.getWalletAmount)
router
    .route('/withdrawFromWallet')
    .post(verifyToken, baseValidation.withdrawFromWallet, couchProfile.withdrawFromWallet)
router
    .route('/checkSubscriptionStatus')
    .post(verifyToken, users.checkSubscriptionStatus)
router
    .route('/getSubscriptionCoachList/:userId')
    .get(verifyToken, users.getSubscriptionCoachList)

router
    .route('/getPeoplesYouMayLike')
    .post(verifyToken, users.getPeoplesYouMayLike)
router
    .route('/getCoachesYouMayLike')
    .post(verifyToken, couchProfile.getCoachesYouMayLike)
router
    .route('/getAllCoach')
    .get(verifyToken, couchProfile.getAllCoach)
router
    .route('/getFollowedCoach')
    .get(verifyToken, couchProfile.getFollowedCoach)

/**
 * Video Call
 */
router
    .route('/room')
    .post(verifyToken, baseValidation.createRoom, videoCall.createRoom)
router
    .route('/room/:sid')
    .get(videoCall.getSingleRoom)
router
    .route('/room/:sid')
    .post(videoCall.updateRoom)
router
    .route('/room')
    .get(videoCall.getAllRoom)

router
    .route('/participant')
    .post(videoCall.retrieveAllParticipant)
router
    .route('/participant/:pName')
    .post(videoCall.retrieveSingleParticipant)

// router
//     .route('/token')
//     .post(verifyToken, baseValidation.videoToken, videoCall.getAccessToken)

router
    .route('/recording/:roomId')
    .get(videoCall.getRecordingByRoom)

router
    .route('/composition-hook')
    .post(videoCall.createCompositionHook)
router
    .route('/composition-hook')
    .get(videoCall.getAllCompositionHooks)
router
    .route('/composition-hook/:hookId')
    .delete(videoCall.deleteCompositionHooks)

router
    .route('/composition')
    .get(videoCall.getAllComposition)
router
    .route('/composition/:cId')
    .get(videoCall.getSingleComposition)
// router
//     .route('/composition/media/:compId')
//     .get(videoCall.getCompositionMedia)

router
    .route('/room-callback')
    .post(videoCall.roomCallback)

router
    .route('/composition-callback')
    .post(videoCall.compositionCallback)

router
    .route('/knowledgeBank')
    .get(verifyToken, videoCall.getAllKnowledgeBank)

router
    .route('/deleteS3File')
    .post(verifyToken, videoCall.deleteS3File)
/**
 * End Video Call
 */

router
    .route('/bookCall')
    .post(verifyToken, createBookCallSchema, bookCall.bookCall)
router
    .route('/bookCall/:bookId/extend')
    .post(verifyToken, bookCall.extendBookCall)
router
    .route('/bookCall/:bookId/ongoing')
    .post(verifyToken, bookCall.updateBookCallOnGoing)
// router
//   .route('/getLearnerAllBookings')
//   .post(verifyToken, bookCall.getLearnerAllBookings)
// router
//   .route('/getLearnerUpcomingBookings')
//   .post(verifyToken, bookCall.getLearnerUpcomingBookings)
// router
//   .route('/getLearnerPastBookings')
//   .post(verifyToken, bookCall.getLearnerPastBookings)
router
    .route('/getAllBookings')
    .get(verifyToken, bookCall.getAllBookings)
router
    .route('/getUpcomingBookings')
    .get(verifyToken, bookCall.getUpcomingBookings)
router
    .route('/getPastBookings')
    .get(verifyToken, bookCall.getPastBookings)

// router.post("/createFollower",follower.createFollower);
// router.post("/editFollower",follower.editFollower);
router.post('/getFollower', verifyToken, follower.getFollower)
router.post('/getFollowing', verifyToken, follower.getFollowing)
router.post('/followUnfollowUser', verifyToken, baseValidation.followUnfollowUser, follower.followUnfollowUser)
router.post(
    '/getFollowerAndFollowingCount',
    verifyToken,
    follower.getFollowerAndFollowingCount
)
router.post('/fetchUserDetail', verifyToken, users.fetchUserDetail)

router.get(
    '/getUserActivityLog/:userId',
    verifyToken,
    activityLog.getUserActivityLog
)

//couch video

router.post('/addVideo', verifyToken, baseValidation.addVideo, couchProfile.addVideo)

router.post('/removeVideo', verifyToken, couchProfile.removeVideo)
router.post('/getVideo', verifyToken, couchProfile.getVideo)

// pass in type "crowds" to return detailed crowd data (incl. banned crowds) - admin only
router.route('/config/:type?').get(login.getConfig)

router.route('/users/:_id/verify').get(token.matchesID, login.verifyToken)

router.route('/check/email/:email').get(login.checkEmail)

router.route('/users/verifyemail').post(login.verifyEmail)

router.route('/users/resend').post(resendEmail, login.resendEmail)

router.route('/login').post(baseValidation.login, login.login)

router.route('/forgot-password').post(login.forgotPassword)

router.route('/reset-password').post(resetPassword, login.resetPassword)

router.route('/logout').post(verifyToken, login.logout)

router.route('/check/username/:username').get(login.checkUsername)

router.route('/reportUser').post(users.reportUser)

// PREMIUM

router.route('/premium/process_new').post(premium.processNewSubscription)

router.route('/premium/promo/:code').get(token.require, premium.submitPromoCode)

// VALIDATIONS (types: "signup", "forgotpassword", "changeemail")

router.route('/validate/newpassword/:email').post(validate.setNewPassword) // pass in { password: x }

router
    .route('/validate/newemail/:_id')
    .post(token.matchesID, validate.setNewEmail) // pass in { email: x, currentPassword: x }

router
    .route('/validate/:type/:email/:link?')
    .get(validate.createCode)
    .post(validate.checkCode)

// USERS

router.route('/user/topics/:user_id').post(verifyToken, baseValidation.insertTopics, users.setTopics)
router.route('/user/interest-goals/:user_id').get(verifyToken, users.getInterestGoals)
router.route('/user/goals/:user_id').post(verifyToken, baseValidation.insertGoals, users.setGoals)
router.route('/user/interest-goals/:user_id').post(verifyToken, users.setGoalsTopics)
router
    .route('/user/separate-interest-goals/:user_id')
    .get(verifyToken, users.viewUserSeparateInterestGoals)

router.route('/user/agreeToTerms').post(token.require, users.agreeToTerms)

router
    .route('/notifications/read')
    .get(token.require, users.markNotificationsRead)

router
    .route('/notifications/:skip?')
    .get(token.require, users.fetchNotifications)

router.route('/users/search').post(token.require, chats.searchUsers)

router.route('/users/username/:username').get(users.fetchFullProfile) // fetch full profile by username

/* router
  .route('/users/:_id')
  .get(token.require, users.fetchFullProfile)
  .patch(token.matchesID, users.updateUser) */

router.route('/addComment').post(users.addComment)

router.route('/editComment').post(users.editComment)

// router
// .route('/getComment')
// .post(users.getComment)

router.route('/getCommentList').post(users.getCommentList)

//comment reply
router.route('/addCommentReply').post(users.addCommentReply)

router.route('/addReview').post(verifyToken, createReviews, users.addReview)

// router.route('/editReview').post(users.editReview)

router.route('/viewReview').post(verifyToken, users.getReview)

router.route('/users/:_id/:action').get(users.followUser)

router.route('/createStripe').get(users.createStripe)

router.route('/data').post(token.require, data.requestData)

router
    .route('/hotswatts') // #deprecated - keep for older versions. we now use /data route
    .get(token.require, hotSwatts.generateHotSwatts)

router.route('/findfriends').post(users.findFriends)

router.route('/invite/:points').get(users.claimInvitePoints)

// QUESTION - INDIVIDUAL

router.route('/submit-question').post(verifyToken, baseValidation.submitQuestion, question.submitQuestion)
router.route('/submit-answer').post(verifyToken, baseValidation.submitAsnwer, question.submitAnswer)
router.route('/upvote-answer').post(verifyToken, baseValidation.upvoteAsnwer, question.upvoteAnswer)
router.route('/submit-comment').post(verifyToken, baseValidation.submitComment, question.submitComment)
/* router.route('/submitted-question').post(question.submitedQuestion) */
router
    .route('/view-answer-comments/:answerId')
    .get(verifyToken, question.getCommentsFromAnswer)

router
    .route('/viewUserPostedQuestions')
    .post(verifyToken, question.viewUserPostedQuestions)
router.route('/checkAppVersion').get(settings.checkAppVersion)

router.route('/question/:_id/:action').get(question.interactQuestion) // save, unsave or 1-up - takes user ID from token

router.route('/question/:_id/:answerID/up').get(question.upAnswer) // 1-up

// QUESTIONS - BROWSE

router.route('/questions/all/summaries').post(questions.fetchSummaries) // unanswered question count and community crowd members

router
    .route('/questions/:subject/search/:inputSearch')
    .get(questions.searchQuestions)

router
    .route('/questions/:subject/:type/:skip?/:noLimit?/:names?')
    .get(token.require, questions.prepareToFetchQuestions)

// CROWDS

router.route('/crowds/:crowdName/:type?').get(crowds.createCrowd) // type "official" allowed if admin token, "organiser" if organiser token

router
    .route('/subscriptions/:crowd/:action') // "add" or "remove"
    .get(token.require, crowds.subscribe)

// router
//   .route('/crowds1/get') // "add" or "remove"
//   .get(crowds.getCrowds)

router.route('/chat/files').post(verifyToken, chatFile, chats.uploadChatFiles)

// IMAGES

router.route('/image/upload/:_id').post(token.require, files.uploadImage) // upload image (for profiles and posts) - get S3 upload URL. client will handle the rest. no viewing URL needed as images are in public bucket

router.route('/images/request').post(token.require, files.requestImages)

// TERMS

router.route('/report').post(terms.reportItem)

router.route('/terms').get(terms.getTerms).post(token.admin, terms.updateTerms)

router
    .route('/privacy')
    .get(terms.getPrivacyPolicy)
    .post(token.admin, terms.updatePrivacyPolicy)

// VOUCHERS

router
    .route('/vouchers')
    .get(token.require, vouchers.getVouchers)
    .post(token.admin, vouchers.addVoucher)

router.route('/vouchers/:_id').delete(token.admin, vouchers.deleteVoucher)

// CHATS - functions will verify token

router.route('/chats/fetch').get(token.require, chats.fetchChats)

router.route('/chats/fetch').post(token.require, chats.getChat) // get chat by chat ID (existing chat or group chats) or single recipient (gets or creates)

router.route('/chats/group/create').post(token.require, chats.createGroupChat)

router.route('/chats/group/add').post(token.require, chats.addToGroupChat)

router.route('/chats/group/leave').post(token.require, chats.leaveGroupChat)

router.route('/chats').post(token.require, chats.sendMessage) // send message to _id or [deprecated] recipient, creating new chat if none exists

router
    .route('/chats/blocks') // block or unblock
    .get(token.require, chats.fetchBlockedUsers)

router
    .route('/chats/blocks/:_id/:action') // block or unblock
    .post(token.require, chats.blockUser)

// router.route('/chats/search/:input')
// .get(token.require, chats.searchChats)

// ADMIN

router.route('/admin/signin').post(adminConfig.adminSignIn)

router
    .route('/admin/crowds/:crowdName/:type') // remove (official), ban or unban (community)
    .get(adminConfig.banCrowd)

router.route('/admin/config').post(token.admin, adminConfig.updateConfig)

router
    .route('/stats/:field/:value') // e.g. /school/University of Bristol
    .get(token.admin, adminData.getStats)

router
    .route('/admin/users/find/:email') // find by email or username
    .get(token.admin, adminData.adminFindUser)

router
    .route('/admin/users/fetch/:sort/:skip?')
    .get(token.admin, adminData.adminFetchUsers)

router
    .route('/admin/users/update/:_id')
    .post(token.admin, adminData.adminUpdateUser)

router
    .route('/admin/users/history/:_id')
    .get(token.admin, adminData.adminFetchUserHistory)

router.route('/admin/users/create').post(adminData.adminCreateUser)

router
    .route('/admin/avatar/delete/:_id')
    .get(token.admin, files.adminDeleteImage)

router.route('/admin/emails').get(token.admin, adminConfig.getSubscribedEmails)

router
    .route('/admin/emails_premium')
    .get(token.admin, adminConfig.getPremiumEmails)

// ORGANISATIONS

router
    .route('/organisations')
    .get(token.organiser, organisations.fetchOrganisations)
    .post(token.require, organisations.joinOrganisation)

router
    .route('/organisations/:name/leave')
    .get(token.require, organisations.leaveOrganisation)

router
    .route('/organisations/:name/files')
    .get(token.require, organisations.fetchFiles)

router
    .route('/organisations/:name')
    .get(token.organiser, organisations.fetchOrganisation) // checks if organisation is user's own
    .delete(token.require, organisations.deleteOrganisation)

router
    .route('/organisations/:name/regenerate')
    .get(token.organiser, crowds.regenerateCodes) // checks if organisation is user's own

router
    .route('/organisations/:name/emaillock')
    .post(token.organiser, organisations.changeEmailLock)

router
    .route('/organisations/:name/anonymous')
    .post(token.organiser, organisations.toggleAnonymous)

router
    .route('/organisations/:name/remove/:userID')
    .get(token.organiser, organisations.removeMember)

router.route('/files/upload').post(token.organiser, files.uploadFile)

router.route('/files/request').post(token.require, files.requestFile)

router.route('/files/delete').post(token.organiser, files.deleteFile)

router.route('/deleteFirebaseUsers').get(login.deleteFirebaseUsers)

router.post('/updateDeviceToken', verifyToken, baseValidation.updateDeviceToken, users.updateDeviceToken)

router.route('/notification').get(verifyToken, notifications.getAllNotification)

// acme challenge moved to root server.js

// TESTING AND DEV

const points = require('../helpers/points')
const CrowdsIntersts = require('../models/crowdsIntersts')
const { CouchProfile } = require('../models')
const configHelper = require('../helpers/configHelper')
const globalHelper = require('../helpers/globalHelper')
const userService = require('../services/userService')

// router.route('/test') // #dev
// .get(points.runTest)

// router.route('/dev')
// .get(token.admin, users.devUpdateUser)

// router.route('/admin/random') // create random user
// .get(token.admin, hotSwatts.generateRandomUser)

// export for use in server.js
module.exports = router
