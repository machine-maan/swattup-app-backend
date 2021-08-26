const mongoose = require('mongoose')
var Schema = mongoose.Schema;
const bcrypt = require('bcryptjs')
const models = require('./')

const schema = new mongoose.Schema({
	reviewerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
		required: true, 
    },
	rating: {
		type: Number,
		required: true,    
	},
	description: {
		type: String,
		required: false,    
	}
}, {timestamps: true})
 
const Review = mongoose.model('Review', schema)

module.exports = Review
