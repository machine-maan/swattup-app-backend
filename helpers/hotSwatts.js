const randomWords = require('random-words')
const moment = require('moment')

const db = require('../models')
const points = require('./points')
const data = require('../tests/exampleData')

// FIRST BLOCK - FIND USER AND SEARCH WITH SCHOOL
exports.generateHotSwatts = (req, res) => {
  // find user
  db.User.findOne(
    { _id: req.token._id },
    { subjects: 1, school: 1, following: 1 }
  )
    .lean()
    .then((user) => {
      const { following, school, subjects } = user

      // add user's ID to his "following" so he doesn't turn up in his own recommendations
      following.push(req.token._id)

      if (!school) {
        // searchWithoutSchool(req, res, school, subjects, swattsB, excludeB)
        return searchWithoutSchool(req, res, school, subjects, [], following)
      }

      // A: FIND 4 - SAME SCHOOL, SUBJECTS, SORTED BY NEW
      db.User.find(
        {
          _id: { $nin: following },
          school: school,
          subjects: { $in: subjects },
        },
        {
          _id: 1,
          username: 1,
          school: 1,
          points: 1,
          subjects: 1,
          joinDate: 1,
          tutor: 1,
          premium: 1,
        }
      )
        .lean()
        .sort({ joinDate: -1 })
        .limit(4)
        .then((schoolSubjectsNew) => {
          // add these IDs to the exclude list
          const exclude = following.concat(
            schoolSubjectsNew.map((item) => item._id)
          )

          // B: FIND 4 - SAME SCHOOL, SUBJECTS, SORTED BY POINTS. EXCLUDE PREVIOUS
          db.User.find(
            {
              _id: { $nin: exclude },
              school: school,
              subjects: { $in: subjects },
            },
            {
              username: 1,
              school: 1,
              points: 1,
              subjects: 1,
              joinDate: 1,
              tutor: 1,
              premium: 1,
            }
          )
            .lean()
            .sort({ points: -1 })
            .limit(4)
            .then((schoolSubjectsPoints) => {
              // should have 0 to 8 from the same school, mix of high level and/or new
              const swattsB = schoolSubjectsNew.concat(schoolSubjectsPoints)

              // add these IDs to the exclude list
              const excludeB = exclude.concat(
                schoolSubjectsPoints.map((item) => item._id)
              )

              // next step
              searchWithoutSchool(req, res, school, subjects, swattsB, excludeB)

              // res.send({ 1: schoolSubjectsNew, 2: schoolSubjectsPoints})
            })
            .catch((err) => res.send(err))
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

// NEXT BLOCK - FILL IN REMAINING 4-12 WITHOUT SPECIFYING SCHOOL
// (may have skipped here if user had no school)
function searchWithoutSchool(req, res, school, subjects, swattsB, excludeB) {
  const count = swattsB.length

  const toGo = 12 - count

  const takeNew = Math.ceil(toGo / 2)

  const takePoints = toGo - takeNew

  // C: FIND HALF OF REMAINING - SUBJECTS, SORTED BY NEW
  db.User.find(
    {
      _id: { $nin: excludeB },
      subjects: { $in: subjects },
    },
    {
      _id: 1,
      username: 1,
      school: 1,
      points: 1,
      subjects: 1,
      joinDate: 1,
      tutor: 1,
      premium: 1,
    }
  )
    .lean()
    .sort({ joinDate: -1 })
    .limit(takeNew)
    .then((subjectsNew) => {
      const swattsC = swattsB.concat(subjectsNew)

      // add these IDs to the exclude list
      const excludeC = excludeB.concat(subjectsNew.map((item) => item._id))

      // D: FIND REMAINING - SUBJECTS, SORTED BY POINTS
      db.User.find(
        {
          _id: { $nin: excludeC },
          subjects: { $in: subjects },
        },
        {
          _id: 1,
          username: 1,
          school: 1,
          points: 1,
          subjects: 1,
          joinDate: 1,
          tutor: 1,
          premium: 1,
        }
      )
        .lean()
        .sort({ points: -1 })
        .limit(takePoints)
        .then((subjectsPoints) => {
          // all done! should have 12
          const swattsD = swattsC.concat(subjectsPoints)

          finalizeHotSwatts(req, res, school, subjects, swattsD)
        })
        .catch((err) => res.send(err))
    })
    .catch((err) => res.send(err))
}

function finalizeHotSwatts(req, res, school, subjects, swattsD) {
  // look up config for level data
  db.Config.findOne({ name: 'config' })
    .lean()
    .then((config) => {
      // "high level" threshold
      const levelThree = config.levelThresholds[3]

      // "new" threshold
      const weekAgo = moment().subtract(7, 'days').toISOString()

      let pointsCount = 0
      let newCount = 0
      let schoolCount = 0

      // fill in reasons
      for (let i = 0; i < swattsD.length; i++) {
        // delete subjects key (only used for dev, really)
        delete swattsD[i].subjects

        const reasons = []

        if (swattsD[i].joinDate > weekAgo) {
          newCount++
          reasons.push('new')
        }
        if (swattsD[i].points > levelThree) {
          pointsCount++
          reasons.push('high level')
        }
        if (school && swattsD[i].school === school) {
          schoolCount++
          reasons.push('same institution')
        }

        // add on reasons
        swattsD[i].reasons = reasons

        // calculate and add on level
        swattsD[i].level = points.getLevelData(
          swattsD[i].points,
          config.levelThresholds,
          true
        ).level
      }

      return res.send({ pointsCount, newCount, schoolCount, users: swattsD })
    })
    .catch((err) => res.send(err))
}

// //
// RANDOM USER GENERATION
exports.generateRandomUser = (req, res) => {
  db.User.create({
    username: random(),
    school: randomSchool(),
    subjects: randomSubjects(),
    joinDate: randomDate(),
    points: Math.round(Math.random() * 150),

    email: `${random(1)}@${random(1)}.co.uk`,
    password: random(),
  })
    .then((user) => res.send(user))
    .catch((err) => res.send(err))
}

function random(number = 2) {
  return randomWords({ exactly: number, join: '-' })
}

function randomSubjects() {
  const total = data.crowds.length
  const number = Math.random() * 10
  const subjects = []

  for (let i = 0; i < number; i++) {
    const seed = Math.floor(Math.random() * total)

    subjects.push(data.crowds[seed].name)
  }

  return subjects
}

function randomSchool() {
  const total = data.schools.length
  const seed = Math.floor(Math.random() * total)

  return data.schools[seed]
}

function randomDate() {
  const now = moment()

  const seed = Math.round(Math.random() * 30)

  const date = moment(now).subtract(seed, 'days')

  return date.toISOString()
}
