var mongoose = require('mongoose')
var Schema = mongoose.Schema;

var schema = new mongoose.Schema({
  userID: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  crowdID: String,
//   userType: String,
  title: String,
  /* subject: String, */
  description: String,
  /* image: [], */
  /* ups: { type: [], default: [] },
  saves: [], */
  answers: [
    {
      userID: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      body: String,
      /* ups: { type: [], default: [] }, */
      date: {
        type: Date,
        default: Date.now    
      },
      image: String,
      video: String,
      upvotes: [
        {
          userID: {
            type: Schema.Types.ObjectId,
            ref: 'User',
          },
          date: {
            type: Date,
            default: Date.now    
          }
        },
      ],
      comments: [
        {
          userID: {
            type: Schema.Types.ObjectId,
            ref: 'User',
          },
          body: String,
          date: String,
          image: String,
          video: String,
        },
      ],
    },
  ],
  date: {
    type: Date,
    default: Date.now    
  },

 /*  additionalData: String, */ // "hidden" data - currently used to identify "SwattUp Mentoring" introduction posts

  // organisations only
  /* organisation: { type: Boolean, default: false },
  official: { type: Boolean, default: false }, */
})

var Question = mongoose.model('Question', schema)

module.exports = Question
