const db = require('../models')
const points = require('./points')
const notifications = require('./notifications')
const async = require('async')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
var uuidv4 = require('uuid/v4')
const AWS = require('aws-sdk')
const { response } = require('express')
const commonHelper = require('./commonHelper')
const logHelper = require('./logHelper')
const userService = require('../services/userService')
const questionResource = require('../resources/questionResource')
const questionService = require('../services/questionService')
const userResource = require('../resources/userResource')
const answerResource = require('../resources/answerResource')
const dateHelper = require('./dateHelper')
const commentResource = require('../resources/commentResource')
const uploadHelper = require('./uploadHelper')
const paginationHelper = require('./paginationHelper')
const S3BUCKETURL = 'https://swattup-app-bucket.s3.eu-west-2.amazonaws.com/'
const answerImagePath = 'questions/answers/images/'
const answerVideoPath = 'questions/answers/videos/'
const commentImagePath = 'questions/comments/images/'
const commentVideoPath = 'questions/comments/videos/'
const AWS_ACCESS_KEY = 'AKIASW4K5WL2ERJS7HG2'
const AWS_SECRET_ACCESS_KEY = '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'
const BUCKET_NAME = 'swattup-app-bucket'
const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
})

function uploadToS3Bucket(filePath, fileName) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
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
      resolve(s3upload)
    }, 500)
  })
}

function deleteFromS3Bucket(fileName) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const params = {
        Bucket: BUCKET_NAME,
        Key: fileName,
      }
      var s3delete = s3.deleteObject(params).promise()
      resolve(s3delete)
    }, 500)
  })
}

// non-premium
const dailyQuestionLimit = 3
const dailyAnswerLimit = 3

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

function sortAnswersByUps(question) {
  question.answers.sort((a, b) => b.ups.length - a.ups.length)

  return question
}

function verifyOrganisationMember(req, question) {
  return new Promise((resolve, reject) => {
    // if not an organisation post, all good
    if (!question.organisation) {
      return resolve(false)
    }

    const params = {
      name: question.subject,
      organisation: true,
    }

    // if user isn't an admin, require they be in users or leaders
    if (req.user.type !== 'admin') {
      params.$or = [{ users: req.token._id }, { leaders: req.token._id }]
    }

    // otherwise, make sure user is in organisation
    db.Crowd.findOne(params)
      .lean()
      .then((crowd) => {
        if (crowd) {
          return resolve(crowd)
        }

        return reject({ unauthorized: true })
      })
      .catch((err) => reject(err))
  })
}

function sortAnswers(answers) {
  return new Promise((resolve, reject) => {
    answers.sort(function (a, b) {
      if (b.upvotes_count - a.upvotes_count === 0) {
        return b.userType == 'Professional' ? 1 : -1
      } else {
        return b.upvotes_count - a.upvotes_count
      }
    })
    resolve(answers)
  })
}

async function getCommentsNestedData(comments) {
  var comment_data = []
  if (comments.length) {
    await Promise.all(
      comments[0].comments.map(async (comments_value, comments_key) => {
        var user_comment_data = await db.User.findOne({
          _id: comments_value.userID,
        })
        var comment_userImage = commonHelper.getProfileImage(user_comment_data.profileImage)
        var comment_username = user_comment_data.username
        var comment_object = {
          _id: comments_value._id,
          userID: comments_value.userID,
          username: comment_username,
          userImage: comment_userImage,
          userType: user_comment_data.type,
          body: comments_value.body,
          video: comments_value.video,
          date: comments_value.date,
          comments: comments_value.comments,
        }
        comment_data.push(comment_object)
      })
    )
  }

  return comment_data
}

async function getQuestionsNestedUserData(questions, currentUserId = null) {
  var response = []
  if (questions) {
    await Promise.all(
      questions.map(async (value, key) => {
        var userImage = commonHelper.getProfileImage(null)
        var username = ''

        var user_data = await db.User.findOne({ _id: value.userID })
        //  console.log('userID', user_data);
        if (!user_data) {
          return response
        }
        userImage = commonHelper.getProfileImage(null)
        username = user_data.username ? user_data.username : ''
        if (user_data.profileImage) {
          userImage = user_data.profileImage
        }

        var answer_data = []
        if (value.answers) {
          await Promise.all(
            value.answers.map(async (answers_value, answers_key) => {
              var user_answer_data = await db.User.findOne({
                _id: answers_value.userID,
              })
              var answer_userImage = commonHelper.getProfileImage(user_answer_data.profileImage)
              var answer_username = user_answer_data.username
                ? user_answer_data.username
                : ''

              var comment_data = []
              if (answers_value.comments) {
                await Promise.all(
                  answers_value.comments.map(
                    async (comments_value, comments_key) => {
                      var user_comment_data = await db.User.findOne({
                        _id: comments_value.userID,
                      })
                      var comment_userImage = commonHelper.getProfileImage(user_comment_data.profileImage)
                      var comment_username = user_comment_data.username
                        ? user_comment_data.username
                        : ''

                      comment_object = {
                        _id: comments_value._id,
                        userID: comments_value.userID,
                        username: comment_username,
                        userImage: comment_userImage,
                        userType: user_comment_data.type,
                        body: comments_value.body,
                        video: comments_value.video,
                        date: comments_value.date,
                        comments: comments_value.comments,
                      }
                      comment_data.push(comment_object)
                    }
                  )
                )
              }

              var following = 0
              if (currentUserId) {
                let follow_query = {
                  userId: answers_value.userID,
                  followerId: currentUserId,
                  status: 1,
                }
                following = await db.Follower.countDocuments(follow_query)
              }

              answer_object = {
                _id: answers_value._id,
                userID: answers_value.userID,
                username: answer_username,
                userImage: answer_userImage,
                followStatus: following > 0 ? true : false,
                self: currentUserId == answers_value.userID ? true : false,
                userType: user_answer_data.type,
                body: answers_value.body,
                video: answers_value.video,
                date: answers_value.date,
                commentsCount: comment_data.length,
                comments: comment_data,
                upvotes_count: answers_value.upvotes.length,
              }
              answer_data.push(answer_object)
            })
          )

          answer_data = await sortAnswers(answer_data)
        }

        var question_object = {
          _id: value._id,
          userID: value.userID,
          username: username,
          userImage: userImage,
          title: value.title,
          description: value.description,
          crowdID: value.crowdID,
          userType: value.userType,
          date: value.date,
          answerCount: answer_data.length,
          answers: answer_data,
        }
        response.push(question_object)
      })
    )
  }

  return response
}

// note: content collection (user.contents) for each subject populated on sign-up or change subject, so should always be found when doing beastly mongoose findOneAndUpdate pushes
exports.fetchFullQuestion = (req, res) => {
  db.Question.findById(req.params._id)
    .lean()
    .then((question) => {
      verifyOrganisationMember(req, question)
        .then((organisation) => {
          const answers = question.answers

          // build array of user id's to fetch the light profile for, starting with poster
          const userList = []

          if (organisation.anonymous) {
            question.anonymous = true
            delete question.userID
          } else {
            // if we can't find the user ID for this answer in userList, add it
            userList.push(question.userID)
          }

          answers.forEach((answer) => {
            console.log('answer', answer)
            if (organisation.anonymous) {
              delete answer.userID
            } else if (!userList.includes(answer.userID)) {
              userList.push(answer.userID)
            }

            answer.comments.forEach((comment) => {
              if (organisation.anonymous) {
                delete comment.userID
              } else if (!userList.includes(comment.userID)) {
                userList.push(comment.userID)
              }
            })
          })

          res
            .send(answers)
            // populate light user data - fetch the config for level data
            // db.Config.findOne({ name: 'config' })
            //   .lean()
            //   .then((config) => {
            //     // if organiser, attach names
            //     points
            //       .fetchLightProfiles(userList, config, req.token.organiser)
            //       .then((userData) => {
            //         res.send(userData)
            //         console.log('userData',userData);
            //         const body = {
            //           question: sortAnswersByUps(question),
            //           users: userData,
            //         }

            //         // if an organisation, then leaders array given, so send this with it
            //         if (
            //           organisation &&
            //           !organisation.anonymous &&
            //           organisation.leaders
            //         ) {
            //           body.leaders = organisation.leaders
            //         }

            //         res.send(body)
            //       })
            //       .catch((error) => res.send(error))
            //   })
            .catch((error) => res.send(error))
        })
        .catch((err) => res.send(err))
    })
    .catch((error) => res.send(error))
}

function verifyOrganisationPost(req) {
  return new Promise((resolve, reject) => {
    // check if crowd is an organisation
    db.Crowd.findOne({ name: req.body.subject })
      .lean()
      .then((crowd) => {
        // not found - reject
        if (!crowd) {
          return reject({ notFound: true })
        }

        // not an organiastion - resolve
        if (!crowd.organisation) {
          return resolve({ organisation: false, official: false })
        }

        // organisation post - check if user is in leaders
        db.Crowd.findOne({
          name: req.body.subject,
          leaders: req.token._id,
          // $or: [{ leaders: req.token._id }, { leaders: mongoose.Types.ObjectId(req.token._id) }]
          // $or: [{ users: req.token._id }, { leaders: req.token._id }]
        })
          .lean()
          .then((crowd) => {
            // match - organisation and official
            if (crowd) {
              return resolve({
                organisation: true,
                official: true,
                anonymous: crowd.anonymous,
              })
            }

            // check if user is in users
            db.Crowd.findOne({
              name: req.body.subject,
              users: req.token._id,
            })
              .lean()
              .then((crowd) => {
                // no match - reject
                if (!crowd) {
                  return reject({ unauthorized: true })
                }

                // all good - resolve
                return resolve({
                  organisation: true,
                  official: false,
                  anonymous: crowd.anonymous,
                })
              })
              .catch((err) => reject(err))
          })
          .catch((err) => reject(err))
      })
      .catch((err) => reject(err))
  })
}

exports.submitedQuestion = (req, res) => {
  const organisation = req.body.organisation
  const official = req.body.official
  const userID = req.body.userID
  const title = req.body.title
  const body = req.body.body
  const subject = req.body.subject
  const questionData = {
    organisation: organisation,
    official: official,
    userID: userID,
    title: title,
    body: body,
    subject: subject,
  }
  notifications.postQuestion(questionData)
  // notifications.newQuestionData(questionData)
  db.Question.create(questionData)
    .then(function (questionData) {
      if (!questionData) {
        res.json({
          status: false,
          message: 'question data not found!',
        })
      } else {
        res.json({
          status: true,
          message: 'question data inserted!',
          data: questionData,
        })
      }
    })
    .catch((err) => {
      res.status(500).json({
        status: 0,
        message: err.message || 'Some error occurred while creating the user.',
      })
    })
}

exports.submitQuestion = (req, res) => {
    db.User.findOne({ _id: req.body.userID }, function (
        err,
        user_data
    ) {
        if (user_data) {
            req.body.date = new Date().toISOString()

            db.Question.create(req.body)
            .then(async (question) => {
                let userData = await userService.findOne(question.userID);
                question.userData = userData;

                logHelper.log(
                    question.userID,
                    question._id,
                    'Posted a question',
                    'QUESTION'
                )
                
                let relatedUser = await userService.getRandomUserRelatedToCrowd(
                    req.body.crowdID,
                    req.body.userID
                );

                let randomUserProfile = null;
                if (relatedUser.length) {
                    let randomUser = relatedUser[Math.floor(Math.random() * relatedUser.length)];
                    randomUserProfile = commonHelper.getProfileImage(randomUser.profileImage);
                }

                let crowdDetail = await userService.getCrowdDetailById(req.body.crowdID);

                return res.status(200).send({
                    status: true,
                    statusCode: 200,
                    message: 'Question successfully submitted',
                    responseData: questionResource(question, {
                        crowdName: crowdDetail ? crowdDetail.name : '',
                        relatedUserCount: relatedUser.length,
                        randomUserProfile: randomUserProfile,
                    }),
                })
            })
            .catch((error) =>
                res.status(401).send({
                    status: false,
                    statusCode: 401,
                    message: error,
                })
            )
        } else {
            return res.status(401).send({
                message: 'User not found',
                status: false,
                statusCode: 401,
            })
        }
    })
}

exports.submitAnswer = (req, res) => {
    db.User.findOne({ _id: req.body.userID }, async function (
        err,
        user_data
    ) {
        if (user_data) {
            req.body.date = new Date().toISOString() // toISOString for sorting

            db.Question.findOne({ _id: req.body.questionID })
            .then(async (question) => {
                if (question) {
                    const answerImage = req.files && req.files.image ? req.files.image : [];
                    if (req.files && typeof answerImage.length === 'undefined') {
                        let answerImageFile = await uploadHelper.upload(
                            req.files,
                            'image',
                            'image',
                            './public/answers/image/',
                            uploadHelper.ANSWER_IMAGE_FILE_PATH,
                        );

                        if (answerImageFile.status) {
                            req.body.image = answerImageFile.image;
                        } else {
                            return res.status(422).send({
                                status: false,
                                statusCode: 422,
                                message: answerImageFile.message,
                            })
                        }
                    }
                    
                    const answerVideo = req.files && req.files.video ? req.files.video : [];
                    if (req.files && typeof answerVideo.length === 'undefined') {
                        let answerVideoFile = await uploadHelper.upload(
                            req.files,
                            'video',
                            'video',
                            './public/answers/video/',
                            uploadHelper.ANSWER_VIDEO_FILE_PATH,
                        );

                        if (answerVideoFile.status) {
                            req.body.video = answerVideoFile.video;
                        } else {
                            if (req.body.image) {
                                uploadHelper.deleteImage(req.body.image);
                            }

                            return res.status(422).send({
                                status: false,
                                statusCode: 422,
                                message: answerVideoFile.message,
                            })
                        }
                    }

                    question.answers.push({
                        userID: req.body.userID,
                        body: req.body.body,
                        image: req.body.image,
                        video: req.body.video,
                        date: new Date().toISOString(),
                        comments: [],
                    })

                    question
                        .save()
                        .then(async (questionNew) => {
                            logHelper.log(
                                req.body.userID,
                                questionNew._id,
                                'Posted an answer',
                                'QUESTION'
                            )
                            // response_array = []
                            // response_array.push(questionNew)
                            // questions = await getQuestionsNestedUserData(response_array)
                            return res.status(200).send({
                                status: true,
                                statusCode: 200,
                                message: 'Answer successfully submitted',
                                // responseData: questions[0],
                            })
                        })
                        .catch((error) =>{
                            
                            if (req.body.image) {
                                uploadHelper.deleteImage(req.body.image);
                            }
                            if (req.body.video) {
                                uploadHelper.deleteVideo(req.body.video);
                            }

                            return res.status(400).send({
                                status: false,
                                statusCode: 400,
                                message: '' + error,
                            })
                        })
                } else {
                    return res.status(404).send({
                        status: false,
                        statusCode: 404,
                        message: 'Question not found.',
                    })
                }
            })
            .catch((error) => {
                return res.status(500).send({
                    message: '' + error,
                    status: false,
                    statusCode: 500,
                })
            })
        } else {
            return res.status(404).send({
                message: 'User not found',
                status: false,
                statusCode: 404,
            })
        }
    })
}

exports.submitComment = (req, res) => {
    db.User.findOne({ _id: req.body.userID }, async function (
        err,
        user_data
    ) {
        if (user_data) {
            const date = new Date().toISOString()

            let questionData = await questionService.isExist({
                _id: ObjectId(req.body.questionID),
                'answers._id': ObjectId(req.body.answerID),
            });
            if (!questionData) {
                return res.status(404).send({
                    status: false,
                    statusCode: 404,
                    message: 'Question OR Answer not found',
                })
            }

            const image = req.files && req.files.image ? req.files.image : []
            if (req.files && typeof image.length === 'undefined') {
                let commentImageFile = await uploadHelper.upload(
                    req.files,
                    'image',
                    'image',
                    './public/comments/image/',
                    uploadHelper.COMMENT_IMAGE_FILE_PATH,
                );

                if (commentImageFile.status) {
                    req.body.image = commentImageFile.image;
                } else {
                    return res.status(422).send({
                        status: false,
                        statusCode: 422,
                        message: commentImageFile.message,
                    })
                }
            }
            
            const commentVideo = req.files && req.files.video ? req.files.video : [];
            if (req.files && typeof commentVideo.length === 'undefined') {
                let commentVideoFile = await uploadHelper.upload(
                    req.files,
                    'video',
                    'video',
                    './public/comments/video/',
                    uploadHelper.COMMENT_VIDEO_FILE_PATH,
                );

                if (commentVideoFile.status) {
                    req.body.video = commentVideoFile.video;
                } else {
                    if (req.body.image) {
                        uploadHelper.deleteImage(req.body.image);
                    }

                    return res.status(422).send({
                        status: false,
                        statusCode: 422,
                        message: commentVideoFile.message,
                    })
                }
            }

            const commentObject = {
                userID: req.body.userID,
                body: req.body.body,
                date: date,
                image: req.body.image,
                video: req.body.video,
            }
            console.log('commentObject', commentObject)

            db.Question.findOneAndUpdate(
                { _id: req.body.questionID, 'answers._id': req.body.answerID },
                { $addToSet: { 'answers.$.comments': commentObject } },
                { new: true }
            )
            .then(async (question_data) => {
                if (!question_data) {
                    if (req.body.image) {
                        uploadHelper.deleteImage(req.body.image);
                    }
                    if (req.body.video) {
                        uploadHelper.deleteVideo(req.body.video);
                    }

                    return res.status(400).send({
                        status: false,
                        statusCode: 400,
                        message: 'Failed to submit comment',
                    })
                }

                logHelper.log(
                    req.body.userID,
                    question_data._id,
                    'Posted a comment',
                    'QUESTION'
                )

                // response_array = []
                // response_array.push(question_data)
                // questions = await getQuestionsNestedUserData(response_array)
                return res.status(200).send({
                    status: true,
                    statusCode: 200,
                    message: 'Comment successfully submitted',
                    // responseData: questions[0],
                })
            })
            .catch((error) => {
                if (req.body.image) {
                    uploadHelper.deleteImage(req.body.image);
                }
                if (req.body.video) {
                    uploadHelper.deleteVideo(req.body.video);
                }

                return res.status(400).send({
                    status: false,
                    statusCode: 400,
                    message: 'error - ' + error,
                })
            })
        } else {
            return res.status(404).send({
                message: 'User not found',
                status: false,
                statusCode: 404,
            })
        }
    })
}

/* exports.submitQuestion = (req, res) => {  
 
  req.body.date = new Date().toISOString() // toISOString for sorting
  // if (!req.user.validated) {
  //   return res.send({ unauthorized: true })
  // }
  
  // check if user is posting in an organisation - if so, ensure member
  verifyOrganisationPost(req)
    .then(({ organisation, official, anonymous }) => {
     
      // #dev - strict back-end question limit
      // if(!organisation && !req.user.premium && req.user.questionsToday >= dailyQuestionLimit) {
      //     return res.send({ error: "limit_reached", limit: dailyQuestionLimit })
      // }

      if (official) {
        
        req.body.official = true
      } else {
        req.body.official = false
      }

      if (organisation) {
        req.body.organisation = true
      } else {
        req.body.organisation = false
      }
      console.log('organisations',req.body.organisation);

      db.Question.create(req.body)
        .then((question) => {
          console.log('question',question);
          
          const find = organisation
            ? { _id: req.body.userID }
            : { _id: req.body.userID, 'content.subject': req.body.subject }
            console.log('find',find);

          const update = organisation
            ? {}
            : {
                $addToSet: { 'content.$.questions': question._id },
                $inc: { questionsToday: 1 },
              }
              console.log('update',update);

          db.User.findOneAndUpdate(find, update, { new: true })
            .then((user) => { 
              console.log('user',user);            
              if (!user) {
                return res.status(401).send({ 
                  status: false, 
                  statusCode: 401, 
                  message: "User not found", 
                })
              }

              question = question.toObject()
              console.log('question',question, user);

              notifications.postedQuestion(question, user)
              notifications.newQuestion(question, user, anonymous)

              if (anonymous) {
                question.anonymous = true
                question.userID = undefined
              }

              // pass through user's current question count, to update in front-end
              question.questionsToday = user.questionsToday

              notifications.mention(user, req.body.mentions, question)
              res.status(200).send({ 
                status: true, 
                statusCode: 200, 
                message: "Question successfully submitted", 
                responseData: question
              })
            })
            .catch((error) => res.status(401).send({ 
              status: false, 
              statusCode: 401, 
              message: err, 
            }))
        })
        .catch((error) => res.status(401).send({ 
          status: false, 
          statusCode: 401, 
          message: error, 
        }))
    })
    .catch((err) => res.status(401).send({ 
      status: false, 
      statusCode: 401, 
      message: err, 
    }))
 
} */

// note: remember that in non-organisations this won't work properly if the content doc for the crowd doesn't exist (e.g. if trying to submit answers manually through the API without joining the crowd)
/* exports.submitAnswer = (req, res) => { 
  // if (!req.user.validated) {
  //   return res.send({ unauthorized: true })
  // }
  // find question
  db.Question.findOne({ _id: req.params._id })
    .then((question) => {
      // console.log('question',question);
      // if organisation, check if authorized
      verifyOrganisationMember(req, question)
        .then((organisation) => {
          // #dev - strict back-end answer limit
          // if(!organisation && !req.user.premium && req.user.answersToday >= dailyAnswerLimit) {
          //     return res.send({ error: "limit_reached", limit: dailyAnswerLimit })
          // }

          // authorized - add answer
          question.answers.push({
            userID: req.body.userID,
            body: req.body.body,
            image: req.body.image,
            date: new Date().toISOString(),
            comments: [],
          })

          question
            .save()
            .then((questionNew) => {
              questionNew = questionNew.toObject()

              // if not an organisation
              if (!organisation) {
                // update user content and send notifications
                db.User.findOneAndUpdate(
                  {
                    _id: req.body.userID,
                    'content.subject': questionNew.subject,
                  },
                  {
                    $addToSet: { 'content.$.answers': questionNew._id },
                    $inc: { answersToday: 1 },
                  },
                  { new: true }
                ).then((user) => {                 
                  // notifications.postedAnswer(questionNew, user)
                  // notifications.newAnswer(questionNew, user)
                  // notifications.mention(
                  //   user,
                  //   req.body.mentions,
                  //   questionNew,
                  //   'answer'
                  // )
                  // pass through user's current question count, to update in front-end
                  // questionNew.answersToday = user.answersToday

                  res.send(sortAnswersByUps(questionNew))
                })
              } else {
                // organisation - no need to update content object
                notifications.newAnswer(
                  questionNew,
                  req.user,
                  organisation.anonymous
                )

                if (organisation.anonymous) {
                  questionNew = anonymizeQuestion(questionNew)
                }

                notifications.postedAnswer(questionNew, req.user)
                res.send(sortAnswersByUps(questionNew))
              }
            })
            .catch((err) => res.send(err))
        })
        // .catch((error) => {
        //   return res.send({ unauthorized: true, error })
        // })
    })
    .catch((error) => res.send(error))
} */

/* exports.submitComment = (req, res) => {
  const date = new Date().toISOString()
  // console.log('date',date);

  const commentObject = {
    userID: req.body.userID,
    body: req.body.body,
    date: date,
  }
  console.log('commentObject',commentObject);

  db.Question.findOneAndUpdate(
    { _id: req.body._id, 'answers._id': req.body.answerID },
    { $addToSet: { 'answers.$.comments': commentObject } },
    { new: true }
  )
    .then((question) => {
      console.log('question',question);
    })
    .catch((error) => res.send(error))
}

function anonymizeQuestion(question) {
  question = question.toObject()

  question.anonymous = true
  question.userID = undefined

  question.answers.forEach((answer) => {
    answer.userID = undefined

    answer.comments.forEach((comment) => {
      comment.userID = undefined
    })
  })

  return question
} */

function checkCrowdAndAnonymize(question, callback) {
  db.Crowd.findOne({
    name: question.subject,
  })
    .lean()
    .then((crowd) => {
      if (crowd.anonymous) {
        question = anonymizeQuestion(question)
      }

      callback && callback(question, crowd)
    })
}

exports.interactQuestion = (req, res) => {
  console.log('action', action)
  console.log('params', req.params)
  const { action } = req.params

  if (action === 'up') {
    db.Question.findOneAndUpdate(
      { _id: req.params._id },
      { $addToSet: { ups: req.token._id } },
      { new: true }
    )
      .then((question) => {
        if (question.organisation) {
          return checkCrowdAndAnonymize(
            question,
            (anonymousQuestion, crowd) => {
              notifications.upQuestion(question, req.token._id, crowd.anonymous)
              res.send(sortAnswersByUps(anonymousQuestion))
            }
          )
        } else {
          notifications.upQuestion(question, req.token._id)
          res.send(sortAnswersByUps(question))
        }
      })
      .catch((error) => res.send(error))
  } else if (action === 'save' || action === 'unsave') {
    const pushOrPull = action === 'save' ? '$addToSet' : '$pull' // $addToSet prevents duplicates - lovely

    // update question to add id to saves array
    db.Question.findOneAndUpdate(
      { _id: req.params._id },
      { [pushOrPull]: { saves: req.token._id } }, // <-- note "saves" here
      { new: true }
    )
      .then((question) => {
        // if an organisation, add/remove from savedOrganisationQuestions and anonymise returned if necessary
        if (question.organisation) {
          db.User.findOneAndUpdate(
            {
              _id: req.token._id,
            },
            {
              [pushOrPull]: { savedOrganisationQuestions: question._id },
            }
          )
            .then(() => {
              return checkCrowdAndAnonymize(question, (question) => {
                console.log('question', question)
                res.send(sortAnswersByUps(question))
              })
            })
            .catch((err) => res.send(err))
        }
        // if not organisation, add to content document
        else {
          db.User.findOneAndUpdate(
            { _id: req.token._id, 'content.subject': question.subject },
            { [pushOrPull]: { 'content.$.saved': question._id } } // <-- and "saved" here
          )
            .then(() => {
              res.send(sortAnswersByUps(question))
            })
            .catch((error) => res.send(error))
        }
      })
      .catch((error) => res.send(error))
  }
}

exports.upAnswer = (req, res) => {
  db.Question.findOneAndUpdate(
    { _id: req.params._id, 'answers._id': req.params.answerID },
    { $addToSet: { 'answers.$.ups': req.token._id } },
    { new: true }
  )
    .then((question) => {
      if (question.organisation) {
        return checkCrowdAndAnonymize(question, (anonymousQuestion, crowd) => {
          notifications.upAnswer(
            question,
            req.params.answerID,
            req.token._id,
            crowd.anonymous
          )
          res.send(sortAnswersByUps(anonymousQuestion))
        })
      } else {
        notifications.upAnswer(question, req.params.answerID, req.token._id)
        res.send(sortAnswersByUps(question))
      }
    })
    .catch((error) => res.send(error))
}

exports.viewUserQuestion = (req, res) => {
    const userID = req.body.userId
    const crowdID = req.body.crowdId
    db.User.findOne({ _id: userID }, async function (err, user_data) {
        if (err) {
            return res.status(404).send({
                message: 'User not found',
                status: false,
                statusCode: 404,
            })
        }
        // res.interest_crowd = []
        // res.goal_crowd = []

        // if (user_data) {
        //   if (user_data.topics) {
        //     res.interest_crowd = await db.CrowdsIntersts.find({
        //       _id: { $in: user_data.topics },
        //     })
        //   }

        //   if (user_data.goals) {
        //     res.goal_crowd = await db.CrowdGoals.find({
        //       _id: { $in: user_data.goals },
        //     })
        //   }
        // }

        // let primes = res.interest_crowd.concat(res.goal_crowd)
        // var crowd_ids = []

        // await Promise.all(
        //   primes.map(async (value, key) => {
        //     if (value !== undefined) {
        //       crowd_ids.push(value.crowdsId)
        //     }
        //   })
        // )
        let condition = {
            userID: ObjectId(userID)
        }

        if (crowdID) {
            condition.crowdID = crowdID;
        }

        let searchParams = {};
        if (req.query['search'] && req.query['search'] !== '') {
            let searchtext = req.query['search'].trim();
            if (searchtext) {
                searchParams['$or'] = [
                    {
                        title: new RegExp(searchtext, 'i'),
                    },
                    {
                        description: new RegExp(searchtext, 'i'),
                    }
                ]
            }
        }

        let baseQuery = [
            { $lookup: {from: 'users', localField: 'userID', foreignField: '_id', as: 'userData'} },
            { $unwind: '$userData'},
            {
                $match: {
                    $and: [condition],
                    ...searchParams,
                }
            },
            {
                $sort: { date: -1 }
            }
        ];

        let pagination = paginationHelper(req);
        let totalData = await pagination.getTotalDataByModal(db.Question, baseQuery);

        await db.Question
            .aggregate([
                ...baseQuery,
                ...pagination.aggregateQuery(),
            ])
            .then(async function (questions) {
                if (!questions) {
                    return res.status(401).send({
                        message: 'Questions not found',
                        status: false,
                        statusCode: 401,
                    })
                } else {
                    // questions = await getQuestionsNestedUserData(questions)
                    let qRes = [];
                    qRes = questions.map(e => questionResource(e));

                    res.status(200).send({
                        message: 'Questions fetched',
                        status: true,
                        statusCode: 200,
                        responseData: qRes,
                        metadata: pagination.metadata(totalData),
                        // responseData: questions,
                    })
                }
            })
    })
}

exports.viewAnswers = async (req, res) => {
    let baseQuery = [
        {
            $match: {
                _id: ObjectId(req.params.questionId),
            }
        },
        { $unwind: '$answers' },
        {
            $lookup: {
                from: 'users',
                localField: 'answers.userID',
                foreignField: '_id',
                as: 'answers.answerUserData',
            }
        },
        { $unwind: '$answers.answerUserData' },
        // { $group: { "_id": "$_id", answers: { $addToSet: "$answers" }} },
        { $unwind: '$answers' },
        {
            $sort: { 'answers.date': -1 }
        },
        // { $group: { "_id": "$_id", answers: { $push: "$answers" }} },
    ];

    let pagination = paginationHelper(req);
    let totalData = await pagination.getTotalDataByModal(db.Question, baseQuery);
    
    let answers = await questionService.aggregate([
        ...baseQuery,
        // {
        //     $sort: { 'answers.date': -1 }
        // },
        ...pagination.aggregateQuery(),
        { $group: { "_id": "$_id", answers: { $push: "$answers" }} },
    ]);

    let ansRes = [];
    if (answers[0]) {
        if (answers[0].answers) {
            await Promise.resolve(
                answers[0].answers.reduce(async (allCollection, e) => {
                    await allCollection;
                    ansRes.push(await answerResource(e));
                }, {})
            );
        }
    }

    return res.status(200).send({
        message: 'Answers fetched',
        status: true,
        statusCode: 200,
        responseData: ansRes,
        metadata: pagination.metadata(totalData),
    })
}

exports.viewUserLatestQuestion = async (req, res) => {
    const userID = req.body.userId
    db.User
    .findOne({ _id: userID }, async function (err, user_data) {
        if (err) {
            return res.status(401).send({
                message: 'User not found',
                status: false,
                statusCode: 401,
            })
        }

        let questions = await questionService.find({ 
            userID: ObjectId(userID), 
        },[
            { '$limit': 5 }
        ]);

        let letQes = questions.map(e => questionResource(e));

        // var response = await getQuestionsNestedUserData(questions)
        return res.status(200).send({
            message: 'Questions fetched',
            status: true,
            statusCode: 200,
            responseData: letQes,
        })
        // .sort({ _id: -1 })
        // .limit(5)
        // .catch((error) => {
        //     res.status(401).send({
        //         success: false,
        //         message: '' + error,
        //         statusCode: 401,
        //     })
        // })
    })
}

exports.viewUnansweredQuestion = async (req, res) => {
    const crowdId = req.body.crowdId
    let searchParams = {};
    if (req.query['search'] && req.query['search'] !== '') {
        let searchtext = req.query['search'].trim();
        if (searchtext) {
            searchParams['$or'] = [
                {
                    title: new RegExp(searchtext, 'i'),
                },
                {
                    description: new RegExp(searchtext, 'i'),
                }
            ]
        }
    }

    let questions = await questionService.find({ 
        answers: [], 
        crowdID: crowdId,
        ...searchParams
    }, [], paginationHelper(req));
    
    // console.log('questions...', questions);
    // questions = await getQuestionsNestedUserData(questions)
    await Promise.all(
        questions.data = questions.data.map(e => questionResource(e))
    )

    return res.status(200).send({
        message: 'Questions fetched',
        status: true,
        statusCode: 200,
        responseData: questions.data,
        metadata: questions.metadata,
    })
}

exports.viewSingleQuestion = async (req, res) => {
    // const currentUserId = req.user._id
    let questions = await questionService.find({ 
        _id: ObjectId(req.params.questionId), 
    });

    if (questions.length) {
        // response.push(questions)
        // questions = await getQuestionsNestedUserData(
        //     response,
        //     currentUserId
        // )
        let qst = questions[0];

        return res.status(200).send({
            message: 'Questions fetched',
            status: true,
            statusCode: 200,
            responseData: questionResource(qst),
        })
    }
    
    return res.status(200).send({
        message: 'Questions not found.',
        status: false,
        statusCode: 200,
    })
}

exports.viewCrowdQuestion = async (req, res) => {
    const crowdId = req.body.crowdId
    res.interest_crowd = []
    res.goal_crowd = []

    let searchParams = {};
    if (req.query['search'] && req.query['search'] !== '') {
        let searchtext = req.query['search'].trim();
        if (searchtext) {
            searchParams['$or'] = [
                {
                    title: new RegExp(searchtext, 'i'),
                },
                {
                    description: new RegExp(searchtext, 'i'),
                }
            ]
        }
    }

    let questions = await questionService.find({
        crowdID: crowdId,
        ...searchParams,
    }, [], paginationHelper(req));

    // console.log(questions)
    // questions = await getQuestionsNestedUserData(questions)

    await Promise.all(
        questions.data = questions.data.map(e => questionResource(e))
    );

    return res.status(200).send({
        message: 'Questions fetched',
        status: true,
        statusCode: 200,
        responseData: questions.data,
        metadata: questions.metadata,
    })
}

exports.viewUnansweredUserCrowds = async (req, res) => {
    let crowdList = await userService.getListOfCrowdsByUser(req.body.userId);
    let allCrowds = [];

    if (crowdList) {
        let quetionsByTopics = await questionService.getUnansweredUserCrowds(
            'interest',
            crowdList.topics,
            req.body.userId
        );

        let quetionsByGoals = await questionService.getUnansweredUserCrowds(
            'goal',
            crowdList.goals,
            req.body.userId
        );

        allCrowds = [
            ...quetionsByTopics,
            ...quetionsByGoals,
        ];
    }
    var crowd_data = []
    if (allCrowds.length) {
        await Promise.all(
            allCrowds.map(async (value, key) => {
                if (value !== undefined) {
                    let name = value.crowdType == 'interest'
                        ? value.crowdsData.interestName
                        : value.crowdsData.goalsName
                    ;

                    crowd_data.push({
                        _id: value.crowdsData._id,
                        name: name,
                        image: value.crowdsData.image ? value.crowdsData.image : null,
                        unAnsweredCount: value.unanswercount,
                        createdAt: dateHelper().convert(value.crowdsData.createdAt),
                    })
                }
            })
        )
    }
    
    // db._Crowd.find({ _id: { $in: crowd_ids } }, function (err, crowds) {
        if (crowd_data) {
            res.status(200).send({
                message: 'Unanswered crowds fetched',
                status: true,
                statusCode: 200,
                responseData: crowd_data,
            })
        } else {
            res.status(401).send({
                message: 'No unanswered crowds found',
                status: false,
                statusCode: 401,
            })
        }
    // })
}

exports.viewUserPostedQuestions = (req, res) => {
    const userID = req.body.userId
    db.User.findOne({ _id: userID }, async function (err, user_data) {
        if (user_data) {
            let questions = await questionService.find({
                userID: ObjectId(userID),
            }, [{
                $sort : { date: -1}
            }], paginationHelper(req));

            await Promise.all(
                questions.data = questions.data.map(e => questionResource(e))
            )

            if (questions.data) {
                // console.log(questions)
                // questions = await getQuestionsNestedUserData(questions)

                return res.status(200).send({
                    message: 'Questions fetched',
                    status: true,
                    statusCode: 200,
                    responseData: questions.data,
                    metadata: questions.metadata,
                })
            }

            return res.status(404).send({
                message: 'Questions not found',
                status: false,
                statusCode: 404,
            })
        } else {
            return res.status(404).send({
                message: 'User not found',
                status: false,
                statusCode: 404,
            })
        }
    })
}

exports.upvoteAnswer = (req, res) => {
    db.User.findOne({ _id: req.body.userID }, async function (
        err,
        user_data
    ) {
        if (user_data) {
            db.Question.aggregate([
                {
                    $unwind: '$answers',
                },
                /* {
                    $unwind: "$answers.comments"
                }, */
                {
                    $match: {
                        'answers._id': ObjectId(req.body.answerID),
                        'answers.upvotes.userID': ObjectId(req.body.userID),
                    },
                },
                {
                    $project: {
                        upvotes: '$answers.upvotes',
                    },
                },
            ]).then(async (upvote_data) => {
                console.log('upvote_data: ', upvote_data.length)
                if (upvote_data.length) {
                    db.Question.findOneAndUpdate(
                        { 'answers._id': req.body.answerID },
                        { $pull: { 'answers.$.upvotes': { userID: req.body.userID } } },
                        { new: true }
                    ).then(async (question_data) => {
                        logHelper.log(
                            req.body.userID,
                            question_data._id,
                            'Removed upvote from answer',
                            'QUESTION'
                        )
                        // response_array = []
                        // response_array.push(question_data)
                        // questions = await getQuestionsNestedUserData(response_array)
                        return res.status(200).send({
                            status: true,
                            statusCode: 200,
                            message: 'You have removed your upvote from this answer.',
                            // responseData: questions,
                        })
                    })
                } else {
                    const upvoteObject = {
                        userID: req.body.userID,
                    }

                    db.Question.findOneAndUpdate(
                        { 'answers._id': req.body.answerID },
                        { $addToSet: { 'answers.$.upvotes': upvoteObject } },
                        { new: true }
                    ).then(async (question_data) => {
                        logHelper.log(
                            req.body.userID,
                            question_data._id,
                            'Upvoted an answer',
                            'QUESTION'
                        )
                        // response_array = []
                        // response_array.push(question_data)
                        // questions = await getQuestionsNestedUserData(response_array)
                        return res.status(200).send({
                            status: true,
                            statusCode: 200,
                            message: 'Answer successfully upvoted.',
                            // responseData: questions[0],
                        })
                    })
                    .catch((error) => {
                        return res.status(400).send({
                            status: false,
                            statusCode: 400,
                            message: '' + error,
                        })
                    })
                }
            })
        } else {
            return res.status(404).send({
                message: 'User not found',
                status: false,
                statusCode: 404,
            })
        }
    })
}

exports.getCommentsFromAnswer = async (req, res) => {
    let answer_data = await questionService
        .aggregate([
            { $unwind: '$answers' },
            { $unwind: '$answers.comments' },
            /* {
                $unwind: "$answers.comments"
            }, */
            {
                $lookup: {
                    from: 'users',
                    localField: 'answers.comments.userID',
                    foreignField: '_id',
                    as: 'commentUserData',
                }
            },
            { $unwind: '$commentUserData'},
            { $match: { 'answers._id': ObjectId(req.params.answerId) } },
            {
                $project: {
                    _id: '$answers.comments._id',
                    questionId: '$_id',
                    answerId: '$answers._id',
                    body: '$answers.comments.body',
                    image: '$answers.comments.image',
                    video: '$answers.comments.video',
                    date: '$answers.comments.date',
                    user: '$commentUserData',
                },
            },
            { $sort: { date: -1}}
        ], paginationHelper(req));

        if (answer_data.data) {
            // answer_data.data = await getCommentsNestedData(answer_data.data)
            await Promise.all(
                answer_data.data = answer_data.data.map(e => commentResource(e, {
                    user: userResource(e.user),
                }))
            )

            return res.status(200).send({
                status: true,
                statusCode: 200,
                message: 'Comments fetched successfully.',
                responseData: answer_data.data,
                metadata: answer_data.metadata
            })
        }

        return res.status(404).send({
            status: false,
            statusCode: 404,
            message: 'Comments not found.',
        })
}
