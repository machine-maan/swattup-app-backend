const db = require('../models')
const points = require('./points')

const limit = 20
const searchLimit = 50

exports.prepareToFetchQuestions = (req, res) => {
  // if subject = Admin, return all questions in all organisations. otherwise, just specific subject/crowd
  if (req.params.subject === 'Admin' && req.user.type !== 'admin') {
    return res.send({ questions: [], users: [], error: 'unauthorized' })
  }

  const params =
    req.params.subject === 'Admin'
      ? { organisation: true }
      : req.params.type === 'AllSaved'
      ? {}
      : { subject: req.params.subject }

  if (req.params.type === 'AllSaved') {
    // combine saved arrays from each "content" entry into one
    // add on savedOrganisationQuestions array
    let questions = req.user.savedOrganisationQuestions || []

    req.user.content.forEach((item) => {
      questions = questions.concat(item.saved)
    })

    const params = {
      _id: { $in: questions },
    }

    return fetchQuestions(req, res, params)
  }

  // problem: we do also want to be able to save organisation questions, but without the nightmare of req.user.content
  else if (req.params.type === 'Saved') {
    // look in user data for list of saved question ID's for that subject
    const questions =
      req.user.content.find((item) => item.subject === req.params.subject) || {}

    // concat savedOrganisationQuestions with array of strings from req.user.content (in reality only one will be used - savedOrganisationQuestions for organisation and req.user.content otherwise)
    const savedQuestions = (req.user.savedOrganisationQuestions || []).concat(
      questions.saved || []
    )

    // add this to search params for questions: must be in saved questions array
    params._id = { $in: savedQuestions }

    return fetchQuestions(req, res, params)
  } else if (req.params.type === 'Unanswered') {
    // add requirement of having no answers in array
    params['answers.0'] = { $exists: false }

    return fetchQuestions(req, res, params)
  } else if (req.params.type === 'Mine') {
    params.userID = req.token._id

    return fetchQuestions(req, res, params)
  } else if (req.params.type === 'All') {
    // params.official = { $ne: true } // disabled: "all" should show official and non-official
    return fetchQuestions(req, res, params)
  } else if (req.params.type === 'Official') {
    params.official = true
    return fetchQuestions(req, res, params)
  } else {
    return res.send({ error: 'invalid_request' })
  }
}

const fetchQuestions = (req, res, params) => {
  if (!req.params.skip) {
    req.params.skip = 0
  }

  const fields = {
    _id: 1,
    title: 1,
    userID: 1,
    answers: 1,
    date: 1,
    organisation: 1,
    official: 1,
    subject: 1,
  }

  // remove userID if type is AllSaved - not used and questions may be anonymous
  if (req.params.type === 'AllSaved') {
    delete fields.userID
  }

  db.Question.find(params, fields)
    .sort({ date: -1 })
    .skip(Number(req.params.skip))
    .limit(req.params.noLimit ? undefined : limit)
    .lean()
    .then((questions) => {
      // unless type is AllSaved or user is admin:
      // if these are organisation questions, make sure user is in members/leaders
      if (
        req.params.type !== 'AllSaved' &&
        req.user.type !== 'admin' &&
        questions[0] &&
        questions[0].organisation
      ) {
        db.Crowd.findOne({
          name: params.subject,
          organisation: true,
          $or: [{ users: req.token._id }, { leaders: req.token._id }],
        })
          .then((crowd) => {
            if (!crowd) {
              return res.send({ unauthorized: true })
            }

            return sendQuestionsWithUsers(
              req,
              res,
              questions,
              crowd ? crowd.anonymous : false
            )
          })
          .catch((err) => res.send(err))
      } else {
        // not organisation or authorised - all good
        // (for all saved, user has already seen titles of these questions so not sensitive - questions from organisations they're no longer a part of will be filtered on front-end)
        return sendQuestionsWithUsers(req, res, questions)
      }
    })
    .catch((error) => res.send(error))
}

exports.searchQuestions = (req, res) => {
  db.Question.find(
    {
      $text: { $search: req.params.inputSearch },
      subject: req.params.subject,
    },
    {
      score: { $meta: 'textScore' },
    }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(searchLimit)
    .lean()
    .then((questions) => {
      // if these are organisation questions, make sure user is in members/leaders
      if (questions[0] && questions[0].organisation) {
        db.Crowd.findOne({
          name: req.params.subject,
          organisation: true,
          $or: [{ users: req.token._id }, { leaders: req.token._id }],
        })
          .then((crowd) => {
            console.log('crowd',crowd);
            if (!crowd) {r
              return res.send({ unauthorized: true })
            }

            return sendQuestionsWithUsers(req, res, questions, crowd.anonymous)
          })
          .catch((err) => res.send(err))
      } else {
        return sendQuestionsWithUsers(req, res, questions)
      }
    })
    .catch((error) => res.send(error))
}

function sendQuestionsWithUsers(req, res, questions, anonymous) {
  const userList = []
  const questionData = []

  // for each question
  questions.forEach((item) => {
    // generate data object with answerCount field
    questionData.push({
      _id: item._id,
      title: item.title,
      userID: anonymous ? undefined : item.userID,
      date: item.date,
      answerCount: item.answers.length,
      organisation: item.organisation,
      anonymous: anonymous,
      subject: item.subject,
    })

    // if we can't find the user ID for this question in userList...
    if (!anonymous && !userList.find((user) => user === item.userID)) {
      // add it to the list
      userList.push(item.userID)
    }
  })

  // if type is AllSaved, just return questions - don't send user data as we won't show it (and some questions may be anonymous)
  // front-end now re-arranges into question counts for each crowd
  if (req.params.type === 'AllSaved') {
    return res.send({ questions: questionData, users: [] })
  }

  // fetch the config for level data
  db.Config.findOne({ name: 'config' })
    .lean()
    .then((config) => {
      const fields = {
        _id: 1,
        username: 1,
        points: 1,
        tutor: 1,
        premium: 1,
      }

      // if requested, also return names (i.e. fetching from organiser dashboard)
      if (req.params.names) {
        fields.firstName = 1
        fields.lastName = 1
      }

      // find all the users in the userList and get their light profiles
      db.User.find({ _id: { $in: userList } }, fields)
        .lean()
        .then((users) => {
          // create new array with the information we want
          const userData = []

          if (!anonymous) {
            users.forEach((item) => {
              userData.push({
                _id: item._id,
                username: item.username,
                level: points.getLevelData(
                  item.points,
                  config.levelThresholds,
                  true
                ).level,
                tutor: item.tutor,
                premium: item.premium,
                firstName: item.firstName,
                lastName: item.lastName,
              })
            })
          }

          // send questions and users (users light profiles will be stored in client global state)
          res.send({ questions: questionData, users: userData })
        })
        .catch((error) => res.send(error))
    })
    .catch((error) => res.send(error))
}

exports.fetchSummaries = (req, res) => {
  // unanswered questions: match subjects in given body and also with no answer. group them by counts for each subject
  db.Question.aggregate([
    {
      $match: {
        subject: { $in: req.body.subjects },
        'answers.0': { $exists: undefined },
      },
    },
    { $sortByCount: '$subject' },
  ])
    .then((unansweredQuestions) => {
      console.log('hjjfgg',unansweredQuestions);
      // official crowd counts (legacy)
      db.Crowd.aggregate([
        {
          $match: {
            name: { $in: req.body.subjects },
            official: true,
          },
        },
        {
          $project: {
            name: 1,
            users: { $size: '$users' },
          },
        },
      ])
        .then((officialCrowds) => {
          // community crowd counts (legacy)
          db.Crowd.aggregate([
            {
              $match: {
                name: { $in: req.body.subjects },
                official: false,
              },
            },
            {
              $project: {
                name: 1,
                users: { $size: '$users' },
              },
            },
          ])
            .then((communityCrowds) => {
              // all crowds count
              db.Crowd.aggregate([
                {
                  $match: {
                    name: { $in: req.body.subjects, $ne: 'Admin' },
                  },
                },
                {
                  $project: {
                    name: 1,
                    users: { $size: '$users' },
                  },
                },
              ])
                .then((crowds) => {
                  console.log('crowds',crowds);
                  res.send({
                    unansweredQuestions,
                    crowds,
                    officialCrowds,
                    communityCrowds,
                  })
                })
                .catch((err) => res.send(err))
            })
            .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}
